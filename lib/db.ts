/**
 * lib/db.ts — Unified Database Adapter
 *
 * Determines the database driver at startup:
 *  - If DATABASE_URL is set → use direct `pg` Pool (self-hosted Docker mode)
 *  - Otherwise             → use Supabase JS client (cloud / Vercel mode)
 *
 * All API routes import from this file only. Zero Supabase SDK imports elsewhere.
 */

import { Pool } from "pg";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Driver Selection
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;

let pgPool: Pool | null = null;
let supabase: SupabaseClient | null = null;

if (DATABASE_URL && !DATABASE_URL.startsWith("file:")) {
  pgPool = new Pool({ connectionString: DATABASE_URL });
} else if ((global as any).db) {
  pgPool = {} as any; // Dummy non-null object to satisfy check branches during SQLite unit testing
} else {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[db] Neither DATABASE_URL nor Supabase credentials are configured. " +
        "Database calls will fail."
    );
  } else {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
}

export function initDb() {
  const db = (global as any).db;
  if (!db) return;

  // Create tables in test sqlite database
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ingredients TEXT,
      style TEXT,
      image TEXT,
      notes TEXT,
      price REAL DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL DEFAULT NULL,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS package_items (
      package_id TEXT,
      item_id TEXT,
      PRIMARY KEY (package_id, item_id),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_end_date TEXT,
      event_time TEXT,
      venue TEXT,
      guest_count INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      additional_charges TEXT DEFAULT '[]',
      booking_paid INTEGER DEFAULT 0,
      booking_amount REAL DEFAULT 0,
      booking_payment_notes TEXT DEFAULT '',
      second_paid INTEGER DEFAULT 0,
      second_amount REAL DEFAULT 0,
      second_payment_notes TEXT DEFAULT '',
      final_paid INTEGER DEFAULT 0,
      final_amount REAL DEFAULT 0,
      final_payment_notes TEXT DEFAULT '',
      package_id TEXT,
      package_price REAL DEFAULT 0,
      packages_selected TEXT DEFAULT '[]',
      sessions TEXT DEFAULT '[]',
      discount_percent REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec("ALTER TABLE orders ADD COLUMN event_end_date TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE orders ADD COLUMN packages_selected TEXT DEFAULT '[]';");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec("ALTER TABLE orders ADD COLUMN sessions TEXT DEFAULT '[]';");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec("ALTER TABLE orders ADD COLUMN discount_percent REAL DEFAULT 0;");
  } catch (e) {
    // Column already exists, ignore
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT,
      item_id TEXT,
      quantity INTEGER,
      notes TEXT,
      PRIMARY KEY (order_id, item_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  // Create settings table in SQLite
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  
  // Seed default settings if empty
  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get() as any;
  if (settingsCount.count === 0) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES
      ('pdfBrandName', 'Cater Flow Premium Catering'),
      ('currencySymbol', '₹'),
      ('paymentMethods', '["UPI", "Cash", "Card", "Bank Transfer", "Cheque"]')
    `).run();
  }

  // Seed default test items if items table is empty
  const countObj = db.prepare("SELECT COUNT(*) as count FROM items").get() as any;
  if (countObj.count === 0) {
    db.prepare(`
      INSERT INTO items (id, name, type, ingredients, style, image, notes, price, is_available, is_deleted)
      VALUES 
      ('1', 'Paneer Tikka', 'Appetizer', 'Paneer', 'Buffet', '', '', 150.00, 1, 0),
      ('2', 'Hara Bhara Kabab', 'Appetizer', 'Spinach', 'Buffet', '', '', 120.00, 1, 0),
      ('3', 'Veg Biryani', 'Main Course', 'Rice', 'Buffet', '', '', 220.00, 1, 0),
      ('4', 'Gulab Jamun', 'Dessert', 'Sugar', 'Buffet', '', '', 80.00, 1, 0)
    `).run();

    db.prepare(`
      INSERT INTO packages (id, name, description, price, is_deleted)
      VALUES ('pkg-1', 'Royal Veg Buffet Platter', 'Premium veggie combo', NULL, 0)
    `).run();

    db.prepare(`
      INSERT INTO package_items (package_id, item_id)
      VALUES 
      ('pkg-1', '1'),
      ('pkg-1', '2'),
      ('pkg-1', '3'),
      ('pkg-1', '4')
    `).run();
  }
}

// ---------------------------------------------------------------------------
// Generic helper: run a raw SQL query (pg pool only)
// ---------------------------------------------------------------------------
async function pgQuery<T = any>(
  sql: string,
  values?: any[]
): Promise<T[]> {
  if ((global as any).db) {
    let sqliteSql = sql;
    let params = values ?? [];

    // Reorder values array for SQLite positional parameters (?) if they appear out of order in the original SQL
    if (sql.includes("$") && values && values.length > 0) {
      const matches = sql.match(/\$\d+/g);
      if (matches) {
        const indices = matches.map(m => parseInt(m.substring(1), 10));
        params = indices.map(idx => values[idx - 1]);
      }
    }

    // Intercept complex Postgres JSON aggregation queries
    const db = (global as any).db;

    // Settings table interceptors
    if (sql.includes("FROM settings") && sql.includes("WHERE key =")) {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(params[0]);
      return row ? [row] : [];
    }

    if (sql.includes("FROM settings") && !sql.includes("WHERE")) {
      return db.prepare("SELECT key, value FROM settings").all();
    }

    if (sql.includes("INSERT INTO settings")) {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(params[0], params[1]);
      return [];
    }

    // 1. packages.getAll()
    if (sql.includes("FROM packages p") && !sql.includes("p.id =")) {
      const pkgs = db.prepare("SELECT * FROM packages WHERE is_deleted = 0 ORDER BY name ASC").all();
      for (const pkg of pkgs) {
        const pkgItems = db.prepare(`
          SELECT i.* FROM items i
          JOIN package_items pi ON pi.item_id = i.id
          WHERE pi.package_id = ? AND i.is_deleted = 0
        `).all(pkg.id);
        pkg.items = pkgItems.map((it: any) => ({ ...it, is_available: it.is_available === 1 }));
      }
      return pkgs as T[];
    }

    // 2. packages.getById(id)
    if (sql.includes("FROM packages p") && sql.includes("p.id =")) {
      const pkg = db.prepare("SELECT * FROM packages WHERE id = ?").get(params[0]);
      if (!pkg) return [] as T[];
      const pkgItems = db.prepare(`
        SELECT i.* FROM items i
        JOIN package_items pi ON pi.item_id = i.id
        WHERE pi.package_id = ? AND i.is_deleted = 0
      `).all(pkg.id);
      pkg.items = pkgItems.map((it: any) => ({ ...it, is_available: it.is_available === 1 }));
      return [pkg] as T[];
    }

    // 3. orders.getAll()
    if (sql.includes("FROM orders o") && !sql.includes("o.id =")) {
      const ords = db.prepare("SELECT * FROM orders ORDER BY event_date DESC, event_time DESC").all();
      for (const ord of ords) {
        if (typeof ord.additional_charges === "string") {
          try { ord.additional_charges = JSON.parse(ord.additional_charges); } catch { ord.additional_charges = []; }
        }
        ord.booking_paid = ord.booking_paid === 1;
        ord.second_paid = ord.second_paid === 1;
        ord.final_paid = ord.final_paid === 1;

        const orderItems = db.prepare(`
          SELECT oi.quantity, oi.notes,
                 i.id, i.name, i.type, i.ingredients, i.style, i.image, i.price, i.is_available
          FROM order_items oi
          JOIN items i ON i.id = oi.item_id
          WHERE oi.order_id = ?
        `).all(ord.id);
        ord.order_items = orderItems.map((oi: any) => ({
          quantity: oi.quantity,
          notes: oi.notes,
          items: {
            id: oi.id,
            name: oi.name,
            type: oi.type,
            ingredients: oi.ingredients,
            style: oi.style,
            image: oi.image,
            price: oi.price,
            is_available: oi.is_available === 1
          }
        }));
      }
      return ords as T[];
    }

    // 4. orders.getById(id)
    if (sql.includes("FROM orders o") && sql.includes("o.id =")) {
      const ord = db.prepare("SELECT * FROM orders WHERE id = ?").get(params[0]);
      if (!ord) return [] as T[];
      if (typeof ord.additional_charges === "string") {
        try { ord.additional_charges = JSON.parse(ord.additional_charges); } catch { ord.additional_charges = []; }
      }
      ord.booking_paid = ord.booking_paid === 1;
      ord.second_paid = ord.second_paid === 1;
      ord.final_paid = ord.final_paid === 1;

      const orderItems = db.prepare(`
        SELECT oi.quantity, oi.notes,
               i.id, i.name, i.type, i.ingredients, i.style, i.image, i.price, i.is_available
        FROM order_items oi
        JOIN items i ON i.id = oi.item_id
        WHERE oi.order_id = ?
      `).all(ord.id);
      ord.order_items = orderItems.map((oi: any) => ({
        quantity: oi.quantity,
        notes: oi.notes,
        items: {
          id: oi.id,
          name: oi.name,
          type: oi.type,
          ingredients: oi.ingredients,
          style: oi.style,
          image: oi.image,
          price: oi.price,
          is_available: oi.is_available === 1
        }
      }));
      return [ord] as T[];
    }

    // Intercept INSERT queries that don't specify "id" and prepend a generated UUID
    if (sql.trim().toLowerCase().startsWith("insert into") && !sql.toLowerCase().includes("(id,") && !sql.toLowerCase().includes("package_items") && !sql.toLowerCase().includes("order_items")) {
      const firstParenIndex = sql.indexOf("(");
      const insertKeywordIndex = sql.toLowerCase().indexOf("values");
      const valuesParenIndex = sql.indexOf("(", insertKeywordIndex);

      if (firstParenIndex !== -1 && valuesParenIndex !== -1) {
        const sqlPart1 = sql.substring(0, firstParenIndex + 1);
        const sqlPart2 = sql.substring(firstParenIndex + 1, insertKeywordIndex);
        const sqlPart3 = sql.substring(insertKeywordIndex, valuesParenIndex + 1);
        const sqlPart4 = sql.substring(valuesParenIndex + 1);

        sqliteSql = `${sqlPart1}id, ${sqlPart2}${sqlPart3}?, ${sqlPart4}`;
        const newId = require("crypto").randomUUID();
        params = [newId, ...params];
      }
    }

    // Convert parameter syntax from pg ($1, $2) to sqlite (?)
    sqliteSql = sqliteSql.replace(/\$\d+/g, "?");
    // Convert boolean literals for SQLite compatibility
    sqliteSql = sqliteSql.replaceAll("true", "1").replaceAll("false", "0");
    // Map JS booleans to 1 / 0 for SQLite safety
    params = params.map(p => typeof p === "boolean" ? (p ? 1 : 0) : p);

    if (sql.trim().toLowerCase().startsWith("select") || sql.includes("RETURNING")) {
      return db.prepare(sqliteSql).all(...params) as T[];
    } else {
      db.prepare(sqliteSql).run(...params);
      return [] as T[];
    }
  }
  if (!pgPool) throw new Error("pg pool is not initialised");
  const res = await pgPool.query(sql, values);
  return res.rows as T[];
}

// ---------------------------------------------------------------------------
// Supabase fluent query helper — wraps the SDK so callers can `await` it
// ---------------------------------------------------------------------------
function sb() {
  if (!supabase) throw new Error("Supabase client is not initialised");
  return supabase;
}

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
export const items = {
  async getAll() {
    if (pgPool) {
      return pgQuery(
        `SELECT * FROM items WHERE is_deleted = false ORDER BY name ASC`
      );
    }
    const { data, error } = await sb()
      .from("items")
      .select("*")
      .eq("is_deleted", false)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string) {
    if (pgPool) {
      const rows = await pgQuery(`SELECT * FROM items WHERE id = $1`, [id]);
      return rows[0] ?? null;
    }
    const { data, error } = await sb()
      .from("items")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(payload: {
    name: string;
    type: string;
    ingredients?: string;
    style?: string;
    image?: string;
    notes?: string;
    price?: number;
  }) {
    if (pgPool) {
      const rows = await pgQuery(
        `INSERT INTO items (name, type, ingredients, style, image, notes, price, is_available, is_deleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,false)
         RETURNING *`,
        [
          payload.name,
          payload.type,
          payload.ingredients ?? "",
          payload.style ?? "",
          payload.image ?? "",
          payload.notes ?? "",
          payload.price ?? 0.00,
        ]
      );
      return rows[0];
    }
    const { data, error } = await sb()
      .from("items")
      .insert({ ...payload, price: payload.price ?? 0.00, is_available: true, is_deleted: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: Record<string, unknown>) {
    if (pgPool) {
      const allowedCols = ["name", "type", "ingredients", "style", "image", "notes", "price", "is_available", "is_deleted"];
      const keys = Object.keys(payload).filter(k => allowedCols.includes(k));
      if (keys.length === 0) return items.getById(id);
      
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
      const values = [id, ...keys.map((k) => payload[k])];
      const rows = await pgQuery(
        `UPDATE items SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      return rows[0];
    }
    const { data, error } = await sb()
      .from("items")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async softDelete(id: string) {
    if (pgPool) {
      const rows = await pgQuery(
        `UPDATE items SET is_deleted = true WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0];
    }
    const { data, error } = await sb()
      .from("items")
      .update({ is_deleted: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setAvailability(id: string, is_available: boolean) {
    if (pgPool) {
      const rows = await pgQuery(
        `UPDATE items SET is_available = $2 WHERE id = $1 RETURNING *`,
        [id, is_available]
      );
      return rows[0];
    }
    const { data, error } = await sb()
      .from("items")
      .update({ is_available })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ---------------------------------------------------------------------------
// PACKAGES
// ---------------------------------------------------------------------------
export const packages = {
  async getAll() {
    if (pgPool) {
      // Fetch packages + linked item ids
      const pkgs = await pgQuery(
        `SELECT p.*, 
                COALESCE(json_agg(i.*) FILTER (WHERE i.id IS NOT NULL AND i.is_deleted = false), '[]') AS items
         FROM packages p
         LEFT JOIN package_items pi ON pi.package_id = p.id
         LEFT JOIN items i ON i.id = pi.item_id
         WHERE p.is_deleted = false
         GROUP BY p.id
         ORDER BY p.name ASC`
      );
      return pkgs;
    }
    const { data, error } = await sb()
      .from("packages")
      .select(`*, package_items(items(*))`)
      .eq("is_deleted", false)
      .order("name", { ascending: true });
    if (error) throw error;
    // flatten nested join
    return (data ?? []).map((pkg: any) => {
      const flatItems = (pkg.package_items ?? [])
        .map((pi: any) => pi.items)
        .filter((i: any) => i && !i.is_deleted);
      const { package_items, ...rest } = pkg;
      return { ...rest, items: flatItems };
    });
  },

  async getById(id: string) {
    if (pgPool) {
      const rows = await pgQuery(
        `SELECT p.*,
                COALESCE(json_agg(i.*) FILTER (WHERE i.id IS NOT NULL AND i.is_deleted = false), '[]') AS items
         FROM packages p
         LEFT JOIN package_items pi ON pi.package_id = p.id
         LEFT JOIN items i ON i.id = pi.item_id
         WHERE p.id = $1
         GROUP BY p.id`,
        [id]
      );
      return rows[0] ?? null;
    }
    const { data, error } = await sb()
      .from("packages")
      .select(`*, package_items(items(*))`)
      .eq("id", id)
      .single();
    if (error) throw error;
    const flatItems = (data.package_items ?? [])
      .map((pi: any) => pi.items)
      .filter((i: any) => i && !i.is_deleted);
    const { package_items, ...rest } = data;
    return { ...rest, items: flatItems };
  },

  async create(payload: { name: string; description?: string; price?: number | null; itemIds?: string[] }) {
    if (pgPool) {
      const rows = await pgQuery(
        `INSERT INTO packages (name, description, price, is_deleted)
         VALUES ($1, $2, $3, false)
         RETURNING *`,
        [payload.name, payload.description ?? "", payload.price ?? null]
      );
      const pkg = rows[0];
      if (payload.itemIds && payload.itemIds.length > 0) {
        const vals = payload.itemIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(", ");
        await pgQuery(
          `INSERT INTO package_items (package_id, item_id) VALUES ${vals}`,
          [pkg.id, ...payload.itemIds]
        );
      }
      return packages.getById(pkg.id);
    }
    const { data: pkg, error: pkgErr } = await sb()
      .from("packages")
      .insert({ name: payload.name, description: payload.description ?? "", price: payload.price ?? null, is_deleted: false })
      .select()
      .single();
    if (pkgErr) throw pkgErr;
    if (payload.itemIds && payload.itemIds.length > 0) {
      const links = payload.itemIds.map((item_id) => ({ package_id: pkg.id, item_id }));
      const { error: linkErr } = await sb().from("package_items").insert(links);
      if (linkErr) throw linkErr;
    }
    return packages.getById(pkg.id);
  },

  async update(id: string, payload: { name?: string; description?: string; price?: number | null; itemIds?: string[] }) {
    if (pgPool) {
      if (payload.name !== undefined || payload.description !== undefined || payload.price !== undefined) {
        const fields: string[] = [];
        const vals: any[] = [id];
        if (payload.name !== undefined) { fields.push(`name = $${vals.length + 1}`); vals.push(payload.name); }
        if (payload.description !== undefined) { fields.push(`description = $${vals.length + 1}`); vals.push(payload.description); }
        if (payload.price !== undefined) { fields.push(`price = $${vals.length + 1}`); vals.push(payload.price); }
        await pgQuery(`UPDATE packages SET ${fields.join(", ")} WHERE id = $1`, vals);
      }
      if (payload.itemIds !== undefined) {
        await pgQuery(`DELETE FROM package_items WHERE package_id = $1`, [id]);
        if (payload.itemIds.length > 0) {
          const vals2 = payload.itemIds.map((_, i) => `($1, $${i + 2})`).join(", ");
          await pgQuery(
            `INSERT INTO package_items (package_id, item_id) VALUES ${vals2}`,
            [id, ...payload.itemIds]
          );
        }
      }
      return packages.getById(id);
    }
    // Supabase path
    if (payload.name !== undefined || payload.description !== undefined || payload.price !== undefined) {
      const updates: Record<string, unknown> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.description !== undefined) updates.description = payload.description;
      if (payload.price !== undefined) updates.price = payload.price;
      const { error } = await sb().from("packages").update(updates).eq("id", id);
      if (error) throw error;
    }
    if (payload.itemIds !== undefined) {
      const { error: delErr } = await sb().from("package_items").delete().eq("package_id", id);
      if (delErr) throw delErr;
      if (payload.itemIds.length > 0) {
        const links = payload.itemIds.map((item_id) => ({ package_id: id, item_id }));
        const { error: insErr } = await sb().from("package_items").insert(links);
        if (insErr) throw insErr;
      }
    }
    return packages.getById(id);
  },

  async softDelete(id: string) {
    if (pgPool) {
      const rows = await pgQuery(
        `UPDATE packages SET is_deleted = true WHERE id = $1 RETURNING *`,
        [id]
      );
      return rows[0];
    }
    const { data, error } = await sb()
      .from("packages")
      .update({ is_deleted: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------

type OrderPayload = {
  client_name: string;
  client_phone?: string;
  event_name: string;
  event_date: string;
  event_end_date?: string | null;
  event_time?: string;
  venue?: string;
  guest_count?: number;
  notes?: string;
  status?: string;
  additional_charges?: any[];
  booking_paid?: boolean;
  booking_amount?: number;
  booking_payment_notes?: string;
  second_paid?: boolean;
  second_amount?: number;
  second_payment_notes?: string;
  final_paid?: boolean;
  final_amount?: number;
  final_payment_notes?: string;
  package_id?: string | null;
  package_price?: number;
  packages_selected?: any[];
  sessions?: any[];
  items?: Array<{ itemId: string; quantity: number; notes?: string }>;
  discount_percent?: number;
};

// Normalise rows from both pg and supabase into a consistent shape
function flattenOrder(order: any): any {
  const orderItems = order.order_items ?? [];
  const items = orderItems.map((oi: any) => {
    const item = oi.items ?? {};
    return {
      item_id: item.id,
      quantity: oi.quantity,
      item_notes: oi.notes,
      name: item.name,
      type: item.type,
      ingredients: item.ingredients,
      style: item.style,
      image: item.image,
      is_available: item.is_available,
      price: item.price ?? 0,
    };
  });
  const { order_items, ...clean } = order;

  let charges = [];
  if (typeof clean.additional_charges === "string") {
    try {
      charges = JSON.parse(clean.additional_charges);
    } catch {
      charges = [];
    }
  } else if (Array.isArray(clean.additional_charges)) {
    charges = clean.additional_charges;
  }

  let pkgsSel = [];
  if (typeof clean.packages_selected === "string") {
    try {
      pkgsSel = JSON.parse(clean.packages_selected);
    } catch {
      pkgsSel = [];
    }
  } else if (Array.isArray(clean.packages_selected)) {
    pkgsSel = clean.packages_selected;
  }

  let sessionsArr: any[] = [];
  if (typeof clean.sessions === "string") {
    try {
      sessionsArr = JSON.parse(clean.sessions);
    } catch {
      sessionsArr = [];
    }
  } else if (Array.isArray(clean.sessions)) {
    sessionsArr = clean.sessions;
  }

  // Backward compatibility: If no sessions are present, build a default session from order details
  if (sessionsArr.length === 0) {
    sessionsArr = [
      {
        id: "default",
        name: "Main Event",
        session_date: clean.event_date || "",
        session_time: clean.event_time || "",
        guest_count: clean.guest_count || 50,
        package_id: clean.package_id || null,
        package_price: clean.package_price || 0,
        notes: clean.notes || "",
        items: items.map((it: any) => ({
          itemId: it.item_id,
          name: it.name,
          type: it.type,
          price: it.price,
          quantity: it.quantity,
          notes: it.item_notes
        }))
      }
    ];
  }

  // Populate top-level items array from all sessions if empty (e.g. for multi-session orders)
  let consolidatedItems = items;
  if (consolidatedItems.length === 0 && sessionsArr.length > 0) {
    const itemMap = new Map<string, any>();
    for (const sess of sessionsArr) {
      if (Array.isArray(sess.items)) {
        for (const it of sess.items) {
          const key = `${it.itemId}-${it.notes || ""}`;
          if (itemMap.has(key)) {
            const existing = itemMap.get(key);
            existing.quantity += it.quantity;
          } else {
            itemMap.set(key, {
              item_id: it.itemId,
              quantity: it.quantity,
              item_notes: it.notes || "",
              name: it.name || "",
              type: it.type || "",
              price: it.price ?? 0,
            });
          }
        }
      }
    }
    consolidatedItems = Array.from(itemMap.values());
  }

  return { 
    ...clean, 
    items: consolidatedItems, 
    additional_charges: charges,
    packages_selected: pkgsSel,
    sessions: sessionsArr
  };
}

export const orders = {
  async getAll() {
    if (pgPool) {
      // Fetch orders + items via JSON aggregation
      const rows = await pgQuery(
        `SELECT o.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'quantity', oi.quantity,
                      'notes', oi.notes,
                      'items', json_build_object(
                        'id', i.id, 'name', i.name, 'type', i.type,
                        'ingredients', i.ingredients, 'style', i.style,
                        'image', i.image, 'is_available', i.is_available,
                        'price', i.price
                      )
                    )
                  ) FILTER (WHERE oi.order_id IS NOT NULL), '[]'
                ) AS order_items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN items i ON i.id = oi.item_id
         GROUP BY o.id
         ORDER BY o.event_date DESC, o.event_time DESC`
      );
      return rows.map(flattenOrder);
    }
    const { data, error } = await sb()
      .from("orders")
      .select(`*, order_items(quantity, notes, items(id,name,type,ingredients,style,image,is_available,price))`)
      .order("event_date", { ascending: false })
      .order("event_time", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(flattenOrder);
  },

  async getById(id: string) {
    if (pgPool) {
      const rows = await pgQuery(
        `SELECT o.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'quantity', oi.quantity,
                      'notes', oi.notes,
                      'items', json_build_object(
                        'id', i.id, 'name', i.name, 'type', i.type,
                        'ingredients', i.ingredients, 'style', i.style,
                        'image', i.image, 'is_available', i.is_available,
                        'price', i.price
                      )
                    )
                  ) FILTER (WHERE oi.order_id IS NOT NULL), '[]'
                ) AS order_items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN items i ON i.id = oi.item_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [id]
      );
      return rows[0] ? flattenOrder(rows[0]) : null;
    }
    const { data, error } = await sb()
      .from("orders")
      .select(`*, order_items(quantity, notes, items(id,name,type,ingredients,style,image,is_available,price))`)
      .eq("id", id)
      .single();
    if (error) throw error;
    return flattenOrder(data);
  },

  async create(payload: OrderPayload) {
    const {
      client_name, client_phone, event_name, event_date, event_end_date, event_time,
      venue, guest_count, notes, status, additional_charges,
      booking_paid, booking_amount, booking_payment_notes,
      second_paid, second_amount, second_payment_notes,
      final_paid, final_amount, final_payment_notes,
      package_id, package_price, packages_selected, sessions, discount_percent,
      items: itemList,
    } = payload;

    if (pgPool) {
      const rows = await pgQuery(
        `INSERT INTO orders
           (client_name,client_phone,event_name,event_date,event_end_date,event_time,venue,guest_count,
            notes,status,additional_charges,
            booking_paid,booking_amount,booking_payment_notes,
            second_paid,second_amount,second_payment_notes,
            final_paid,final_amount,final_payment_notes,
            package_id, package_price, packages_selected, sessions, discount_percent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING *`,
        [
          client_name, client_phone ?? "", event_name,
          (event_date && event_date.trim() !== "") ? event_date : null,
          (event_end_date && event_end_date.trim() !== "") ? event_end_date : null,
          (event_time && event_time.trim() !== "") ? event_time : null,
          venue ?? "", guest_count ?? 0, notes ?? "", status ?? "pending",
          JSON.stringify(additional_charges ?? []),
          !!booking_paid, booking_amount ?? 0, booking_payment_notes ?? "",
          !!second_paid, second_amount ?? 0, second_payment_notes ?? "",
          !!final_paid, final_amount ?? 0, final_payment_notes ?? "",
          (package_id && package_id.trim() !== "") ? package_id : null, package_price ?? 0,
          JSON.stringify(packages_selected ?? []),
          JSON.stringify(sessions ?? []),
          discount_percent ?? 0,
        ]
      );
      const order = rows[0];
      if (Array.isArray(itemList) && itemList.length > 0) {
        for (const it of itemList) {
          await pgQuery(
            `INSERT INTO order_items (order_id, item_id, quantity, notes) VALUES ($1,$2,$3,$4)`,
            [order.id, it.itemId, it.quantity ?? 0, it.notes ?? ""]
          );
        }
      }
      return orders.getById(order.id);
    }

    // Supabase path
    console.log("[db] orders.create inserting payload:", {
      client_name, client_phone, event_name, event_date, event_end_date, event_time,
      package_id, packages_selected, sessions
    });

    const { data: newOrder, error: orderErr } = await sb()
      .from("orders")
      .insert({
        client_name, client_phone: client_phone ?? "", event_name,
        event_date: (event_date && event_date.trim() !== "") ? event_date : null,
        event_end_date: (event_end_date && event_end_date.trim() !== "") ? event_end_date : null,
        event_time: (event_time && event_time.trim() !== "") ? event_time : null,
        venue: venue ?? "", guest_count: guest_count ?? 0,
        notes: notes ?? "", status: status ?? "pending",
        additional_charges: additional_charges ?? [],
        booking_paid: !!booking_paid, booking_amount: booking_amount ?? 0, booking_payment_notes: booking_payment_notes ?? "",
        second_paid: !!second_paid, second_amount: second_amount ?? 0, second_payment_notes: second_payment_notes ?? "",
        final_paid: !!final_paid, final_amount: final_amount ?? 0, final_payment_notes: final_payment_notes ?? "",
        package_id: (package_id && package_id.trim() !== "") ? package_id : null, package_price: package_price ?? 0,
        packages_selected: packages_selected ?? [],
        sessions: sessions ?? [],
        discount_percent: discount_percent ?? 0,
      })
      .select()
      .single();
    if (orderErr) {
      console.error("[db] orders.create failed:", orderErr);
      throw orderErr;
    }
    if (Array.isArray(itemList) && itemList.length > 0) {
      const links = itemList.map((it) => ({
        order_id: newOrder.id, item_id: it.itemId,
        quantity: it.quantity ?? 0, notes: it.notes ?? "",
      }));
      const { error: linkErr } = await sb().from("order_items").insert(links);
      if (linkErr) throw linkErr;
    }
    return orders.getById(newOrder.id);
  },

  async update(id: string, payload: Partial<OrderPayload>) {
    const { items: itemList, ...fields } = payload;

    if (pgPool) {
      const allowedCols = [
        "client_name", "client_phone", "event_name", "event_date", "event_end_date", "event_time",
        "venue", "guest_count", "notes", "status", "additional_charges",
        "booking_paid", "booking_amount", "booking_payment_notes",
        "second_paid", "second_amount", "second_payment_notes",
        "final_paid", "final_amount", "final_payment_notes",
        "package_id", "package_price", "packages_selected", "sessions", "discount_percent"
      ];
      const keys = Object.keys(fields).filter(k => allowedCols.includes(k));
      if (keys.length > 0) {
        const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
        const values = [
          id, 
          ...keys.map((k) => {
            const val = (fields as any)[k];
            if ((k === "package_id" || k === "event_end_date" || k === "event_date" || k === "event_time") && typeof val === "string" && val.trim() === "") {
              return null;
            }
            return (k === "additional_charges" || k === "packages_selected" || k === "sessions") && typeof val !== "string"
              ? JSON.stringify(val ?? [])
              : val;
          })
        ];
        await pgQuery(`UPDATE orders SET ${setClause} WHERE id = $1`, values);
      }
      if (itemList !== undefined) {
        await pgQuery(`DELETE FROM order_items WHERE order_id = $1`, [id]);
        for (const it of itemList) {
          await pgQuery(
            `INSERT INTO order_items (order_id, item_id, quantity, notes) VALUES ($1,$2,$3,$4)`,
            [id, it.itemId, it.quantity ?? 0, it.notes ?? ""]
          );
        }
      }
      return orders.getById(id);
    }

    // Supabase path
    if (Object.keys(fields).length > 0) {
      const updates: Record<string, any> = {};
      const allowed = [
        "client_name", "client_phone", "event_name", "event_date", "event_end_date", "event_time",
        "venue", "guest_count", "notes", "status", "additional_charges",
        "booking_paid", "booking_amount", "booking_payment_notes",
        "second_paid", "second_amount", "second_payment_notes",
        "final_paid", "final_amount", "final_payment_notes",
        "package_id", "package_price", "packages_selected", "sessions", "discount_percent"
      ];
      for (const k of allowed) {
        if ((fields as any)[k] !== undefined) {
          let val = (fields as any)[k];
          if ((k === "package_id" || k === "event_end_date" || k === "event_date" || k === "event_time") && typeof val === "string" && val.trim() === "") {
            val = null;
          }
          updates[k] = val;
        }
      }
      console.log("[db] orders.update updates object:", updates);
      const { error } = await sb().from("orders").update(updates).eq("id", id);
      if (error) {
        console.error("[db] orders.update failed:", error);
        throw error;
      }
    }
    if (itemList !== undefined) {
      const { error: delErr } = await sb().from("order_items").delete().eq("order_id", id);
      if (delErr) throw delErr;
      if (itemList.length > 0) {
        const links = itemList.map((it) => ({
          order_id: id, item_id: it.itemId,
          quantity: it.quantity ?? 0, notes: it.notes ?? "",
        }));
        const { error: insErr } = await sb().from("order_items").insert(links);
        if (insErr) throw insErr;
      }
    }
    return orders.getById(id);
  },

  async delete(id: string) {
    if (pgPool) {
      await pgQuery(`DELETE FROM orders WHERE id = $1`, [id]);
      return;
    }
    const { error } = await sb().from("orders").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// USERS  (application-level auth — NOT Supabase Auth)
// ---------------------------------------------------------------------------
export const users = {
  async getAll() {
    if (pgPool) {
      return pgQuery(
        `SELECT id, email, role, created_at FROM users ORDER BY created_at ASC`
      );
    }
    const { data, error } = await sb()
      .from("users")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByEmail(email: string) {
    if (pgPool) {
      const rows = await pgQuery(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );
      return rows[0] ?? null;
    }
    const { data, error } = await sb()
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(payload: { email: string; password: string; role: "admin" | "manager" }) {
    if (pgPool) {
      const rows = await pgQuery(
        `INSERT INTO users (email, password, role) VALUES ($1,$2,$3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role, created_at`,
        [payload.email, payload.password, payload.role]
      );
      return rows[0] ?? null;
    }
    const { data, error } = await sb()
      .from("users")
      .insert(payload)
      .select("id, email, role, created_at")
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    if (pgPool) {
      await pgQuery(`DELETE FROM users WHERE id = $1`, [id]);
      return;
    }
    const { error } = await sb().from("users").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// SYSTEM SETTINGS
// ---------------------------------------------------------------------------
export const settings = {
  async getAll(): Promise<Record<string, string>> {
    if (pgPool) {
      const rows = await pgQuery(`SELECT key, value FROM settings`);
      const res: Record<string, string> = {};
      for (const row of rows) {
        res[row.key] = row.value;
      }
      return res;
    }
    const { data, error } = await sb().from("settings").select("key, value");
    if (error) throw error;
    const res: Record<string, string> = {};
    if (data) {
      for (const row of data) {
        res[row.key] = row.value;
      }
    }
    return res;
  },

  async set(key: string, value: string): Promise<void> {
    if (pgPool) {
      await pgQuery(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
      return;
    }
    const { error } = await sb().from("settings").upsert({ key, value });
    if (error) throw error;
  }
};

// ---------------------------------------------------------------------------
// Re-export raw clients and dynamic query helper for exporters
// ---------------------------------------------------------------------------
export { pgPool, supabase };

/** True when running against direct Postgres (Docker / self-hosted mode) */
export const isDirectPg = !!pgPool;

export async function rawQuery(table: string) {
  const allowedTables = ["items", "packages", "package_items", "orders", "order_items", "users", "settings"];
  if (!allowedTables.includes(table)) {
    throw new Error("Invalid table query");
  }
  if (pgPool) {
    return pgQuery(`SELECT * FROM ${table}`);
  }
  const { data, error } = await sb().from(table).select("*");
  if (error) throw error;
  return data ?? [];
}
