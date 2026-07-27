import Database from "@tauri-apps/plugin-sql";
import { BaseDirectory, mkdir, readDir, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { runMigrations } from "./migrations";
import { BACKUP_TABLES, FOLIO_BACKUP_FORMAT, FOLIO_BACKUP_VERSION, validateBackup, type FolioBackup } from "@/lib/backup";

type Row = Record<string, any>;
type SessionUser = { id: string; email: string; role: string };

let database: Database;
let sessionUser: SessionUser | null = null;
const nativeFetch = window.fetch.bind(window);

const schema = [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, ingredients TEXT DEFAULT '',
    style TEXT DEFAULT '', image TEXT DEFAULT '', notes TEXT DEFAULT '', price REAL DEFAULT 0,
    is_available INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', price REAL,
    is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS package_items (
    package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, client_name TEXT NOT NULL, client_phone TEXT DEFAULT '',
    event_name TEXT NOT NULL, event_date TEXT NOT NULL, event_end_date TEXT, event_time TEXT,
    venue TEXT DEFAULT '', guest_count INTEGER DEFAULT 0, notes TEXT DEFAULT '', status TEXT DEFAULT 'pending',
    additional_charges TEXT DEFAULT '[]', booking_paid INTEGER DEFAULT 0, booking_amount REAL DEFAULT 0,
    booking_payment_notes TEXT DEFAULT '', second_paid INTEGER DEFAULT 0, second_amount REAL DEFAULT 0,
    second_payment_notes TEXT DEFAULT '', final_paid INTEGER DEFAULT 0, final_amount REAL DEFAULT 0,
    final_payment_notes TEXT DEFAULT '', package_id TEXT, package_price REAL DEFAULT 0,
    packages_selected TEXT DEFAULT '[]', sessions TEXT DEFAULT '[]', discount_percent REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1, notes TEXT DEFAULT '', PRIMARY KEY (order_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    role TEXT DEFAULT 'manager', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_event_date ON orders(event_date)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
];

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function parseJson(value: unknown, fallback: any[] = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function bodyOf(init?: RequestInit) {
  if (!init?.body) return {};
  if (typeof init.body === "string") return JSON.parse(init.body);
  return JSON.parse(await new Response(init.body).text());
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function authorized(role?: "admin") {
  if (!sessionUser) return json({ error: "Unauthorized" }, 401);
  if (role && sessionUser.role !== role) return json({ error: "Forbidden" }, 403);
  return null;
}

function itemRow(row: Row) {
  return { ...row, is_available: Boolean(row.is_available), is_deleted: Boolean(row.is_deleted) };
}

async function packageRows() {
  const packages = await database.select<Row[]>("SELECT * FROM packages WHERE is_deleted = 0 ORDER BY name");
  for (const pkg of packages) {
    pkg.items = (await database.select<Row[]>(
      "SELECT i.* FROM items i JOIN package_items pi ON pi.item_id = i.id WHERE pi.package_id = $1 AND i.is_deleted = 0",
      [pkg.id],
    )).map(itemRow);
  }
  return packages;
}

async function orderRows(id?: string) {
  const rows = await database.select<Row[]>(
    id ? "SELECT * FROM orders WHERE id = $1" : "SELECT * FROM orders ORDER BY event_date DESC, event_time DESC",
    id ? [id] : [],
  );
  for (const order of rows) {
    order.booking_paid = Boolean(order.booking_paid);
    order.second_paid = Boolean(order.second_paid);
    order.final_paid = Boolean(order.final_paid);
    order.additional_charges = parseJson(order.additional_charges);
    order.packages_selected = parseJson(order.packages_selected);
    order.sessions = parseJson(order.sessions);
    order.items = await database.select<Row[]>(
      `SELECT i.id AS item_id, oi.quantity, oi.notes AS item_notes, i.name, i.type,
       i.ingredients, i.style, i.image, i.is_available, i.price
       FROM order_items oi JOIN items i ON i.id = oi.item_id WHERE oi.order_id = $1`,
      [order.id],
    );
    if (order.sessions.length === 0) {
      order.sessions = [{
        id: "default", name: "Main Event", session_date: order.event_date,
        session_time: order.event_time || "", guest_count: order.guest_count || 50,
        package_id: order.package_id || null, package_price: order.package_price || 0,
        notes: order.notes || "", items: order.items.map((entry: Row) => ({
          itemId: entry.item_id, name: entry.name, type: entry.type, price: entry.price,
          quantity: entry.quantity, notes: entry.item_notes,
        })),
      }];
    }
  }
  return rows;
}

const orderColumns = [
  "client_name", "client_phone", "event_name", "event_date", "event_end_date", "event_time",
  "venue", "guest_count", "notes", "status", "additional_charges", "booking_paid", "booking_amount",
  "booking_payment_notes", "second_paid", "second_amount", "second_payment_notes", "final_paid",
  "final_amount", "final_payment_notes", "package_id", "package_price", "packages_selected", "sessions",
  "discount_percent",
];

function databaseValue(key: string, value: any) {
  if (["additional_charges", "packages_selected", "sessions"].includes(key)) return JSON.stringify(value ?? []);
  if (["booking_paid", "second_paid", "final_paid", "is_available"].includes(key)) return value ? 1 : 0;
  if (["event_end_date", "event_time", "package_id"].includes(key) && value === "") return null;
  return value;
}

async function replaceOrderItems(orderId: string, items: Row[] | undefined) {
  if (items === undefined) return;
  await database.execute("DELETE FROM order_items WHERE order_id = $1", [orderId]);
  for (const item of items) {
    await database.execute(
      "INSERT INTO order_items (order_id, item_id, quantity, notes) VALUES ($1,$2,$3,$4)",
      [orderId, item.itemId, item.quantity ?? 0, item.notes ?? ""],
    );
  }
}

async function saveOrder(payload: Row, id?: string) {
  const orderId = id || crypto.randomUUID();
  const fields = orderColumns.filter((key) => payload[key] !== undefined);
  if (id) {
    if (fields.length) {
      await database.execute(
        "UPDATE orders SET " + fields.map((key, index) => key + " = $" + (index + 1)).join(", ") +
        " WHERE id = $" + (fields.length + 1),
        [...fields.map((key) => databaseValue(key, payload[key])), id],
      );
    }
  } else {
    const insertFields = ["id", ...fields];
    await database.execute(
      "INSERT INTO orders (" + insertFields.join(",") + ") VALUES (" + insertFields.map((_, index) => "$" + (index + 1)).join(",") + ")",
      [orderId, ...fields.map((key) => databaseValue(key, payload[key]))],
    );
  }
  await replaceOrderItems(orderId, payload.items);
  return (await orderRows(orderId))[0];
}

async function allSettings() {
  const rows = await database.select<Array<{ key: string; value: string }>>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function setSettings(values: Row) {
  for (const [key, raw] of Object.entries(values)) {
    const value = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    await database.execute("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value]);
  }
  return allSettings();
}

async function writeAudit(action: string, entityType: string, entityId?: string, before?: unknown, after?: unknown) {
  await database.execute(
    "INSERT INTO audit_log(id,user_id,action,entity_type,entity_id,before_json,after_json) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [crypto.randomUUID(), sessionUser?.id || null, action, entityType, entityId || null, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after)],
  );
}

function contactRow(row: Row) {
  return { ...row, allergens: parseJson(row.allergens), is_deleted: Boolean(row.is_deleted) };
}

async function contacts(search = "") {
  const query = `%${search.trim()}%`;
  const rows = search.trim()
    ? await database.select<Row[]>("SELECT * FROM contacts WHERE is_deleted=0 AND (name LIKE $1 OR phone LIKE $1 OR email LIKE $1 OR address LIKE $1) ORDER BY name", [query])
    : await database.select<Row[]>("SELECT * FROM contacts WHERE is_deleted=0 ORDER BY name");
  return rows.map(contactRow);
}
export async function readSyncSnapshot(): Promise<FolioBackup> {
  const tables = {} as FolioBackup["tables"];
  for (const table of BACKUP_TABLES) tables[table] = await database.select<Row[]>("SELECT * FROM " + table);
  return {
    format: FOLIO_BACKUP_FORMAT, version: FOLIO_BACKUP_VERSION, createdAt: new Date().toISOString(),
    appVersion: "0.1.0", source: "desktop" as const, tables,
  };
}

async function automaticBackup() {
  const configured = await allSettings();
  if (configured.autoBackupEnabled === "false") return { created: false, supported: true, reason: "Automatic backups are disabled." };
  const interval = configured.autoBackupFrequency === "weekly" ? 7 * 86400000 : 86400000;
  const lastRun = Date.parse(configured.lastAutoBackupAt || "");
  if (Number.isFinite(lastRun) && Date.now() - lastRun < interval) {
    return { created: false, supported: true, reason: "The current backup is still recent." };
  }
  const now = new Date();
  const filename = "folio-backup-" + now.toISOString().replace(/[:.]/g, "-") + ".folio-backup.json";
  await mkdir("backups", { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile("backups/" + filename, JSON.stringify(await readSyncSnapshot(), null, 2), { baseDir: BaseDirectory.AppData });
  await setSettings({ lastAutoBackupAt: now.toISOString() });
  const retention = Math.max(3, Math.min(90, Number(configured.autoBackupRetention || 14)));
  const files = (await readDir("backups", { baseDir: BaseDirectory.AppData }))
    .filter((entry) => entry.isFile && entry.name.endsWith(".folio-backup.json"))
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of files.slice(retention)) {
    await remove("backups/" + entry.name, { baseDir: BaseDirectory.AppData });
  }
  return { created: true, supported: true, filename, createdAt: now.toISOString() };
}

export async function createSyncRecoveryBackup(reason: string) {
  const now = new Date();
  const safeReason = reason.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const filename = `sync-recovery-${now.toISOString().replace(/[:.]/g, "-")}-${safeReason}.folio-backup.json`;
  await mkdir("backups/recovery", { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile("backups/recovery/" + filename, JSON.stringify(await readSyncSnapshot(), null, 2), { baseDir: BaseDirectory.AppData });
  const files = (await readDir("backups/recovery", { baseDir: BaseDirectory.AppData }))
    .filter((entry) => entry.isFile && entry.name.endsWith(".folio-backup.json"))
    .sort((left, right) => right.name.localeCompare(left.name));
  for (const entry of files.slice(10)) await remove("backups/recovery/" + entry.name, { baseDir: BaseDirectory.AppData });
  return filename;
}
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return "\"" + text.replace(/"/g, "\"\"") + "\"";
}

async function ordersCsv() {
  const rows = await orderRows();
  const headers = ["Order ID","Client Name","Client Phone","Event","Event Date","Status","Guests","Venue","Booking Amount","Second Amount","Final Amount"];
  const lines = rows.map((order) => [
    order.id, order.client_name, order.client_phone, order.event_name, order.event_date,
    order.status, order.guest_count, order.venue, order.booking_amount, order.second_amount, order.final_amount,
  ].map(csvCell).join(","));
  return "\uFEFF" + [headers.map(csvCell).join(","), ...lines].join("\r\n");
}

const restoreColumns: Record<string, string[]> = {
  items: ["id","name","type","ingredients","style","image","notes","price","is_available","is_deleted","created_at"],
  packages: ["id","name","description","price","is_deleted","created_at"],
  package_items: ["package_id","item_id"],
  orders: ["id", ...orderColumns, "created_at"], order_items: ["order_id","item_id","quantity","notes"],
  users: ["id","email","password","role","created_at"], settings: ["key","value"],
  contacts: ["id","name","phone","email","address","preferences","allergens","notes","is_deleted","created_at","updated_at"],
  drafts: ["id","user_id","draft_type","payload","created_at","updated_at"],
  attachments: ["id","entity_type","entity_id","name","mime_type","size","storage_path","created_at"],
  reminders: ["id","entity_type","entity_id","title","due_at","status","recurrence","created_at","completed_at"],
  saved_views: ["id","user_id","view_type","name","config","created_at","updated_at"],
  recent_items: ["id","user_id","entity_type","entity_id","accessed_at"],
  audit_log: ["id","user_id","action","entity_type","entity_id","before_json","after_json","created_at"],
  undo_log: ["id","user_id","action","inverse_json","expires_at","created_at"],
  role_permissions: ["role","capability","allowed"],
};

export async function applySyncSnapshot(document: unknown) {
  const backup = validateBackup(document);
  const deleteOrder = ["order_items","package_items","attachments","reminders","drafts","saved_views","recent_items","audit_log","undo_log","contacts","orders","packages","items","role_permissions","settings","users"];
  const insertOrder = ["items","packages","users","settings","role_permissions","contacts","orders","package_items","order_items","drafts","attachments","reminders","saved_views","recent_items","audit_log","undo_log"];
  await database.execute("PRAGMA foreign_keys = OFF");
  await database.execute("BEGIN IMMEDIATE");
  try {
    for (const table of deleteOrder) await database.execute("DELETE FROM " + table);
    for (const table of insertOrder) {
      for (const row of backup.tables[table as keyof typeof backup.tables]) {
        const columns = restoreColumns[table].filter((column) => row[column] !== undefined);
        const values = columns.map((column) => databaseValue(column, row[column]));
        await database.execute(
          "INSERT INTO " + table + " (" + columns.join(",") + ") VALUES (" + columns.map((_, index) => "$" + (index + 1)).join(",") + ")",
          values,
        );
      }
    }
    await database.execute("COMMIT");
  } catch (error) {
    await database.execute("ROLLBACK");
    throw error;
  } finally {
    await database.execute("PRAGMA foreign_keys = ON");
  }
}

async function handleApi(path: string, method: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, "http://folio.local");
  const route = url.pathname;
  const payload = method === "GET" ? {} : await bodyOf(init);

  if (route === "/api/setup" && method === "GET") {
    const [{ count }] = await database.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM users");
    return json({ setupRequired: Number(count) === 0 });
  }
  if (route === "/api/sync/bootstrap" && method === "POST") {
    const snapshot = validateBackup(payload.snapshot);
    await Promise.all([
      writeSyncMeta("address", String(payload.address || "")),
      writeSyncMeta("deviceToken", String(payload.deviceToken || "")),
      writeSyncMeta("deviceId", String(payload.deviceId || "")),
      writeSyncMeta("revision", String(Number(payload.revision || 0))),
      writeSyncMeta("baseSnapshot", JSON.stringify(snapshot)),
      writeSyncMeta("dirty", "false"),
      writeSyncMeta("conflicts", "[]"),
    ]);
    return json({ ok: true });
  }
  if (route === "/api/setup/restore" && method === "POST") {
    const [{ count }] = await database.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM users");
    if (Number(count) !== 0) return json({ error: "This Folio installation is already configured." }, 409);
    const backup = validateBackup(payload.backup);
    await applySyncSnapshot(backup);
    return json({ ok: true });
  }
  if (route === "/api/setup" && method === "POST") {
    const [{ count }] = await database.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM users");
    if (Number(count) !== 0) return json({ error: "Folio has already been set up." }, 409);
    const username = String(payload.username || "").trim().toLowerCase();
    const password = String(payload.password || "");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ error: "Enter a valid username." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    await database.execute("INSERT INTO users (id,email,password,role) VALUES ($1,$2,$3,'admin')", [crypto.randomUUID(), username, await sha256(password)]);
    await setSettings({ pdfBrandName: payload.businessName, currencySymbol: payload.currencySymbol || "₹", onboardingVersion: 1, autoBackupEnabled: true, autoBackupFrequency: "daily", autoBackupRetention: 14 });
    return json({ ok: true, username }, 201);
  }
  if (route === "/api/auth/login" && method === "POST") {
    const users = await database.select<Row[]>("SELECT id,email,password,role FROM users WHERE email = $1", [String(payload.email || "").trim().toLowerCase()]);
    if (!users[0] || users[0].password !== await sha256(String(payload.password || ""))) return json({ error: "Invalid username or password." }, 401);
    sessionUser = { id: users[0].id, email: users[0].email, role: users[0].role };
    return json({ ok: true, user: sessionUser });
  }
  if (route === "/api/auth/check") return sessionUser ? json({ authenticated: true, user: sessionUser }) : json({ authenticated: false }, 401);
  if (route === "/api/auth/logout") { sessionUser = null; return json({ ok: true }); }

  const denied = authorized();
  if (denied) return denied;

  if (route === "/api/search" && method === "GET") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (query.length < 2) return json([]);
    const like = `%${query}%`;
    const [contactMatches, itemMatches, orderMatches] = await Promise.all([
      database.select<Row[]>("SELECT id,name,phone,email FROM contacts WHERE is_deleted=0 AND (name LIKE $1 OR phone LIKE $1 OR email LIKE $1) LIMIT 12", [like]),
      database.select<Row[]>("SELECT id,name,type FROM items WHERE is_deleted=0 AND (name LIKE $1 OR type LIKE $1 OR ingredients LIKE $1) LIMIT 12", [like]),
      database.select<Row[]>("SELECT id,client_name,event_name,event_date,venue FROM orders WHERE client_name LIKE $1 OR event_name LIKE $1 OR venue LIKE $1 OR client_phone LIKE $1 LIMIT 12", [like]),
    ]);
    return json([
      ...contactMatches.map((entry) => ({ type: "contact", id: entry.id, title: entry.name, subtitle: entry.phone || entry.email })),
      ...itemMatches.map((entry) => ({ type: "item", id: entry.id, title: entry.name, subtitle: entry.type })),
      ...orderMatches.map((entry) => ({ type: "order", id: entry.id, title: entry.event_name, subtitle: `${entry.client_name} · ${entry.event_date}` })),
    ]);
  }
  if (route === "/api/contacts" && method === "GET") return json(await contacts(String(url.searchParams.get("q") || "")));
  if (route === "/api/contacts" && method === "POST") {
    const id = String(payload.id || crypto.randomUUID());
    const row = [id,String(payload.name||"").trim(),String(payload.phone||""),String(payload.email||"").trim().toLowerCase(),String(payload.address||""),String(payload.preferences||""),JSON.stringify(payload.allergens||[]),String(payload.notes||"")];
    if (!row[1]) return json({error:"Contact name is required."},400);
    await database.execute("INSERT INTO contacts(id,name,phone,email,address,preferences,allergens,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", row);
    const created = contactRow((await database.select<Row[]>("SELECT * FROM contacts WHERE id=$1",[id]))[0]);
    await writeAudit("create","contact",id,undefined,created);
    return json(created,201);
  }
  const contactMatch = route.match(/^\/api\/contacts\/([^/]+)$/);
  if (contactMatch && method === "PATCH") {
    const before = (await database.select<Row[]>("SELECT * FROM contacts WHERE id=$1",[contactMatch[1]]))[0];
    if (!before) return json({error:"Contact not found."},404);
    const allowed=["name","phone","email","address","preferences","allergens","notes"].filter((key)=>payload[key]!==undefined);
    if (allowed.length) await database.execute("UPDATE contacts SET "+allowed.map((key,index)=>key+"=$"+(index+1)).join(",")+",updated_at=CURRENT_TIMESTAMP WHERE id=$"+(allowed.length+1),[...allowed.map((key)=>key==="allergens"?JSON.stringify(payload[key]||[]):payload[key]),contactMatch[1]]);
    const updated=contactRow((await database.select<Row[]>("SELECT * FROM contacts WHERE id=$1",[contactMatch[1]]))[0]);
    await writeAudit("update","contact",contactMatch[1],contactRow(before),updated);
    return json(updated);
  }
  if (contactMatch && method === "DELETE") {
    const before=(await database.select<Row[]>("SELECT * FROM contacts WHERE id=$1",[contactMatch[1]]))[0];
    if(!before)return json({error:"Contact not found."},404);
    await database.execute("UPDATE contacts SET is_deleted=1,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[contactMatch[1]]);
    await database.execute("INSERT INTO undo_log(id,user_id,action,inverse_json,expires_at) VALUES ($1,$2,'restore_contact',$3,$4)",[crypto.randomUUID(),sessionUser?.id||null,JSON.stringify(contactRow(before)),new Date(Date.now()+30000).toISOString()]);
    await writeAudit("delete","contact",contactMatch[1],contactRow(before));
    return json({ok:true,undoAvailableForSeconds:30});
  }
  if (route === "/api/drafts" && method === "GET") return json(await database.select("SELECT * FROM drafts WHERE user_id=$1 ORDER BY updated_at DESC",[sessionUser!.id]));
  if (route === "/api/drafts" && method === "PUT") {
    const id=String(payload.id||crypto.randomUUID());
    await database.execute("INSERT INTO drafts(id,user_id,draft_type,payload) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP",[id,sessionUser!.id,String(payload.draftType||"order"),JSON.stringify(payload.payload||{})]);
    return json({id,updatedAt:new Date().toISOString()});
  }
  const draftMatch=route.match(/^\/api\/drafts\/([^/]+)$/);
  if(draftMatch&&method==="DELETE"){await database.execute("DELETE FROM drafts WHERE id=$1 AND user_id=$2",[draftMatch[1],sessionUser!.id]);return json({ok:true});}
  if(route==="/api/reminders"&&method==="GET")return json(await database.select("SELECT * FROM reminders ORDER BY status,due_at"));
  if(route==="/api/reminders"&&method==="POST"){
    const id=crypto.randomUUID();await database.execute("INSERT INTO reminders(id,entity_type,entity_id,title,due_at,recurrence) VALUES ($1,$2,$3,$4,$5,$6)",[id,payload.entityType||"general",payload.entityId||null,payload.title,payload.dueAt,payload.recurrence||null]);await writeAudit("create","reminder",id);return json({id},201);
  }
  const reminderMatch=route.match(/^\/api\/reminders\/([^/]+)$/);
  if(reminderMatch&&method==="PATCH"){await database.execute("UPDATE reminders SET status=$1,completed_at=$2 WHERE id=$3",[payload.status||"completed",payload.status==="pending"?null:new Date().toISOString(),reminderMatch[1]]);await writeAudit("update","reminder",reminderMatch[1]);return json({ok:true});}
  if(route==="/api/audit"&&method==="GET"){const blocked=authorized("admin");if(blocked)return blocked;return json(await database.select("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500"));}
  if(route==="/api/system/integrity"&&method==="GET"){const result=await database.select<Array<{integrity_check:string}>>("PRAGMA integrity_check");return json({ok:result.every((row)=>row.integrity_check==="ok"),details:result});}  if (route === "/api/settings" && method === "GET") return json(await allSettings());
  if (route === "/api/settings" && method === "POST") {
    const blocked = authorized("admin"); if (blocked) return blocked;
    return json(await setSettings(payload));
  }
  if (route === "/api/items" && method === "GET") return json((await database.select<Row[]>("SELECT * FROM items WHERE is_deleted = 0 ORDER BY type,name")).map(itemRow));
  if (route === "/api/items" && method === "POST") {
    const blocked = authorized("admin"); if (blocked) return blocked;
    const id = crypto.randomUUID();
    await database.execute("INSERT INTO items (id,name,type,ingredients,style,image,notes,price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [id,payload.name,payload.type,payload.ingredients||"",payload.style||"",payload.image||"",payload.notes||"",payload.price||0]);
    return json(itemRow((await database.select<Row[]>("SELECT * FROM items WHERE id=$1", [id]))[0]), 201);
  }
  const itemMatch = route.match(/^\/api\/items\/([^/]+)$/);
  if (itemMatch && method === "PATCH") {
    const blocked = authorized("admin"); if (blocked) return blocked;
    const allowed = ["name","type","ingredients","style","image","notes","price","is_available"].filter((key) => payload[key] !== undefined);
    await database.execute("UPDATE items SET " + allowed.map((key,index) => key+"=$"+(index+1)).join(",") + " WHERE id=$"+(allowed.length+1), [...allowed.map((key) => databaseValue(key,payload[key])),itemMatch[1]]);
    return json(itemRow((await database.select<Row[]>("SELECT * FROM items WHERE id=$1", [itemMatch[1]]))[0]));
  }
  if (itemMatch && method === "DELETE") { const blocked=authorized("admin"); if(blocked)return blocked; await database.execute("UPDATE items SET is_deleted=1 WHERE id=$1",[itemMatch[1]]); return json({success:true}); }
  const availabilityMatch = route.match(/^\/api\/items\/([^/]+)\/availability$/);
  if (availabilityMatch && method === "PATCH") { const blocked=authorized("admin"); if(blocked)return blocked; await database.execute("UPDATE items SET is_available=$1 WHERE id=$2",[payload.is_available?1:0,availabilityMatch[1]]); return json(itemRow((await database.select<Row[]>("SELECT * FROM items WHERE id=$1",[availabilityMatch[1]]))[0])); }

  if (route === "/api/packages" && method === "GET") return json(await packageRows());
  if (route === "/api/packages" && method === "POST") {
    const blocked=authorized("admin"); if(blocked)return blocked; const id=crypto.randomUUID();
    await database.execute("INSERT INTO packages (id,name,description,price) VALUES ($1,$2,$3,$4)",[id,payload.name,payload.description||"",payload.price??null]);
    for(const itemId of payload.itemIds||[]) await database.execute("INSERT INTO package_items (package_id,item_id) VALUES ($1,$2)",[id,itemId]);
    return json((await packageRows()).find((entry)=>entry.id===id),201);
  }
  const packageMatch=route.match(/^\/api\/packages\/([^/]+)$/);
  if(packageMatch && method==="PUT") { const blocked=authorized("admin");if(blocked)return blocked;await database.execute("UPDATE packages SET name=$1,description=$2,price=$3 WHERE id=$4",[payload.name,payload.description||"",payload.price??null,packageMatch[1]]);await database.execute("DELETE FROM package_items WHERE package_id=$1",[packageMatch[1]]);for(const itemId of payload.itemIds||[])await database.execute("INSERT INTO package_items (package_id,item_id) VALUES ($1,$2)",[packageMatch[1],itemId]);return json((await packageRows()).find((entry)=>entry.id===packageMatch[1])); }
  if(packageMatch && method==="DELETE") { const blocked=authorized("admin");if(blocked)return blocked;await database.execute("UPDATE packages SET is_deleted=1 WHERE id=$1",[packageMatch[1]]);return json({success:true}); }

  if(route==="/api/orders" && method==="GET") return json(await orderRows());
  if(route==="/api/orders" && method==="POST") return json(await saveOrder(payload),201);
  const orderMatch=route.match(/^\/api\/orders\/([^/]+)$/);
  if(orderMatch && method==="GET") { const order=(await orderRows(orderMatch[1]))[0];return order?json(order):json({error:"Order not found"},404); }
  if(orderMatch && method==="PATCH") return json(await saveOrder(payload,orderMatch[1]));
  if(orderMatch && method==="DELETE") { const blocked=authorized("admin");if(blocked)return blocked;const order=(await orderRows(orderMatch[1]))[0];if(!order)return json({error:"Order not found"},404);const eventDate=new Date(order.event_date);const today=new Date();today.setHours(0,0,0,0);eventDate.setHours(0,0,0,0);const days=Math.ceil((eventDate.getTime()-today.getTime())/86400000);if(days>=0&&days<=3&&url.searchParams.get("override")!=="true")return json({error:"cancellation_lock",message:"This event is within the 3-day preparation window."},400);await database.execute("DELETE FROM orders WHERE id=$1",[orderMatch[1]]);return json({success:true}); }
  const cloneMatch=route.match(/^\/api\/orders\/([^/]+)\/clone$/);
  if(cloneMatch && method==="POST") { const original=(await orderRows(cloneMatch[1]))[0];if(!original)return json({error:"Order not found"},404);const clone:Row={...original,client_name:original.client_name+" (Copy)",status:"pending",booking_paid:false,booking_amount:0,second_paid:false,second_amount:0,final_paid:false,final_amount:0,items:original.items.map((entry:Row)=>({itemId:entry.item_id,quantity:entry.quantity,notes:entry.item_notes}))};delete clone.id;delete clone.created_at;return json(await saveOrder(clone),201); }

  if(route==="/api/users"&&method==="GET") { const blocked=authorized("admin");if(blocked)return blocked;return json(await database.select("SELECT id,email,role,created_at FROM users ORDER BY created_at")); }
  if(route==="/api/users"&&method==="POST") { const blocked=authorized("admin");if(blocked)return blocked;const id=crypto.randomUUID();await database.execute("INSERT INTO users (id,email,password,role) VALUES ($1,$2,$3,$4)",[id,String(payload.email).toLowerCase(),await sha256(payload.password),payload.role]);return json({id,email:payload.email,role:payload.role},201); }
  const userMatch=route.match(/^\/api\/users\/([^/]+)$/);
  if(userMatch&&method==="PATCH") { if(sessionUser!.role!=="admin"&&sessionUser!.id!==userMatch[1])return json({error:"Forbidden"},403);await database.execute("UPDATE users SET password=$1 WHERE id=$2",[await sha256(payload.newPassword),userMatch[1]]);return json({ok:true}); }
  if(userMatch&&method==="DELETE") { const blocked=authorized("admin");if(blocked)return blocked;if(userMatch[1]===sessionUser!.id)return json({error:"You cannot delete your own account."},400);await database.execute("DELETE FROM users WHERE id=$1",[userMatch[1]]);return json({ok:true}); }

  if(route==="/api/export/backup") return json(await readSyncSnapshot(),200,{"Content-Disposition":"attachment; filename=folio-backup.folio-backup.json"});
  if(route==="/api/export/json") return json(await readSyncSnapshot(),200,{"Content-Disposition":"attachment; filename=folio-export.json"});
  if(route==="/api/export/csv") return new Response(await ordersCsv(),{status:200,headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=folio-orders.csv"}});
  if(route==="/api/backup/restore"&&method==="POST") { const blocked=authorized("admin");if(blocked)return blocked;const backup=validateBackup(payload.backup);const summary=Object.fromEntries(Object.entries(backup.tables).map(([table,rows])=>[table,rows.length]));if(payload.confirm!==true)return json({valid:true,requiresConfirmation:true,createdAt:backup.createdAt,appVersion:backup.appVersion,summary});await applySyncSnapshot(backup);return json({ok:true,summary}); }
  if(route==="/api/backup/automatic"&&method==="POST") return json(await automaticBackup());
  if(route==="/api/system/erase"&&method==="POST") {
    const blocked=authorized("admin"); if(blocked)return blocked;
    await database.execute("PRAGMA foreign_keys = OFF");
    try {
      await database.execute("BEGIN");
      for (const table of ["order_items","package_items","attachments","reminders","drafts","saved_views","recent_items","audit_log","undo_log","contacts","orders","packages","items","role_permissions","settings","users"]) {
        await database.execute("DELETE FROM " + table);
      }
      await database.execute("COMMIT");
    } catch (error) {
      await database.execute("ROLLBACK");
      throw error;
    } finally {
      await database.execute("PRAGMA foreign_keys = ON");
    }
    await database.execute("VACUUM");
    try {
      for (const entry of await readDir("backups", { baseDir: BaseDirectory.AppData })) {
        if (entry.isFile) await remove("backups/" + entry.name, { baseDir: BaseDirectory.AppData });
      }
    } catch { /* No backup directory exists yet. */ }
    sessionUser = null;
    return json({ok:true});
  }
  if(route==="/api/log") return json({ok:true});
  return json({error:"Desktop endpoint not implemented: "+method+" "+route},404);
}

export async function installDesktopApi() {
  database = await Database.load("sqlite:folio.db");
  await database.execute("PRAGMA foreign_keys = ON");
  await database.execute("PRAGMA journal_mode = WAL");
  for (const statement of schema) await database.execute(statement);
  await runMigrations(database);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!path.startsWith("/api/")) return nativeFetch(input, init);
    try {
      const method = (init?.method || "GET").toUpperCase();
      const response = await handleApi(path, method, init);
      const pathname = new URL(path, "http://folio.local").pathname;
      const syncable = method !== "GET" && response.ok && /^\/api\/(settings|items|packages|orders|users|contacts|drafts|reminders)(\/|$)/.test(pathname);
      if (syncable) window.dispatchEvent(new CustomEvent("folio-data-changed"));
      return response;
    }
    catch (error) { console.error("[desktop-api]", error); return json({error:error instanceof Error?error.message:"Desktop operation failed."},500); }
  };
}

export async function readSyncMeta(key: string): Promise<string | null> {
  const rows = await database.select<Array<{ value: string }>>("SELECT value FROM sync_meta WHERE key=$1", [key]);
  return rows[0]?.value ?? null;
}

export async function writeSyncMeta(key: string, value: string): Promise<void> {
  await database.execute("INSERT INTO sync_meta (key,value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value]);
}

export async function removeSyncMeta(key: string): Promise<void> {
  await database.execute("DELETE FROM sync_meta WHERE key=$1", [key]);
}