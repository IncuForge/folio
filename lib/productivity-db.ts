import { isSqlDatabase, sqlQuery, supabase } from "@/lib/db";

const allowedTables = new Set(["contacts", "drafts", "attachments", "reminders", "saved_views", "recent_items", "audit_log", "undo_log", "items", "orders"]);

function safeTable(table: string) {
  if (!allowedTables.has(table)) throw new Error("Invalid productivity table");
  return table;
}

function sqlValue(value: unknown) {
  if ((global as any).db && value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

function hydrateRow(row: Record<string, unknown>) {
  for (const key of ["payload", "allergens", "config", "before_json", "after_json", "inverse_json"]) {
    if (typeof row[key] === "string") {
      try { row[key] = JSON.parse(row[key] as string); } catch { /* retain legacy text */ }
    }
  }
  return row;
}

export async function selectRows(table: string, filter?: Record<string, unknown>) {
  safeTable(table);
  if (isSqlDatabase) {
    const entries = Object.entries(filter || {});
    const where = entries.length ? " WHERE " + entries.map(([key], index) => `"${key}"=$${index + 1}`).join(" AND ") : "";
    const rows = await sqlQuery<Record<string, unknown>>(`SELECT * FROM "${table}"${where}`, entries.map(([, value]) => sqlValue(value)));
    return rows.map(hydrateRow);
  }
  let query = supabase!.from(table).select("*");
  for (const [key, value] of Object.entries(filter || {})) query = query.eq(key, value);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function insertRow(table: string, row: Record<string, unknown>) {
  safeTable(table);
  if (isSqlDatabase) {
    const keys = Object.keys(row), values = Object.values(row).map(sqlValue);
    const result = await sqlQuery<Record<string, unknown>>(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(",")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`, values);
    return hydrateRow(result[0]);
  }
  const { data, error } = await supabase!.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table: string, id: string, row: Record<string, unknown>) {
  safeTable(table);
  if (isSqlDatabase) {
    const keys = Object.keys(row), values = Object.values(row).map(sqlValue);
    const result = await sqlQuery<Record<string, unknown>>(`UPDATE "${table}" SET ${keys.map((key, index) => `"${key}"=$${index + 1}`).join(",")} WHERE id=$${keys.length + 1} RETURNING *`, [...values, id]);
    return hydrateRow(result[0]);
  }
  const { data, error } = await supabase!.from(table).update(row).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table: string, id: string) {
  safeTable(table);
  if (isSqlDatabase) { await sqlQuery(`DELETE FROM "${table}" WHERE id=$1`, [id]); return; }
  const { error } = await supabase!.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function searchProductivity(term: string) {
  if (isSqlDatabase) {
    const query = `%${term}%`;
    const [contacts, items, orders] = await Promise.all([
      sqlQuery("SELECT id,name,phone,email FROM contacts WHERE is_deleted=FALSE AND (LOWER(name) LIKE LOWER($1) OR LOWER(phone) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1)) LIMIT 12", [query]),
      sqlQuery("SELECT id,name,type FROM items WHERE is_deleted=FALSE AND (LOWER(name) LIKE LOWER($1) OR LOWER(type) LIKE LOWER($1) OR LOWER(ingredients) LIKE LOWER($1)) LIMIT 12", [query]),
      sqlQuery("SELECT id,client_name,event_name,event_date,venue FROM orders WHERE LOWER(client_name) LIKE LOWER($1) OR LOWER(event_name) LIKE LOWER($1) OR LOWER(venue) LIKE LOWER($1) OR LOWER(client_phone) LIKE LOWER($1) LIMIT 12", [query]),
    ]);
    return { contacts, items, orders };
  }
  const pattern = `%${term}%`;
  const [contacts, items, orders] = await Promise.all([
    supabase!.from("contacts").select("id,name,phone,email").eq("is_deleted", false).or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`).limit(12),
    supabase!.from("items").select("id,name,type").eq("is_deleted", false).or(`name.ilike.${pattern},type.ilike.${pattern},ingredients.ilike.${pattern}`).limit(12),
    supabase!.from("orders").select("id,client_name,event_name,event_date,venue").or(`client_name.ilike.${pattern},event_name.ilike.${pattern},venue.ilike.${pattern},client_phone.ilike.${pattern}`).limit(12),
  ]);
  return { contacts: contacts.data || [], items: items.data || [], orders: orders.data || [] };
}
