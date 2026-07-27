import type Database from "@tauri-apps/plugin-sql";

type Migration = { version: number; name: string; statements: string[] };

const migrations: Migration[] = [
  {
    version: 1,
    name: "productivity-foundation",
    statements: [
      `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
        address TEXT DEFAULT '', preferences TEXT DEFAULT '', allergens TEXT DEFAULT '[]', notes TEXT DEFAULT '',
        is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)`,
      `CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY, user_id TEXT, draft_type TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, name TEXT NOT NULL,
        mime_type TEXT DEFAULT '', size INTEGER DEFAULT 0, storage_path TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)`,
      `CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT, title TEXT NOT NULL,
        due_at TEXT NOT NULL, status TEXT DEFAULT 'pending', recurrence TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_at)`,
      `CREATE TABLE IF NOT EXISTS saved_views (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, view_type TEXT NOT NULL, name TEXT NOT NULL,
        config TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS recent_items (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        accessed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_recent_unique ON recent_items(user_id, entity_type, entity_id)`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
        before_json TEXT, after_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS undo_log (
        id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, inverse_json TEXT NOT NULL,
        expires_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT NOT NULL, capability TEXT NOT NULL, allowed INTEGER DEFAULT 1,
        PRIMARY KEY(role, capability)
      )`,
      `INSERT OR IGNORE INTO role_permissions(role, capability, allowed) VALUES
        ('admin','manage_users',1),('admin','manage_settings',1),('admin','delete_records',1),
        ('admin','edit_records',1),('admin','view_financials',1),('admin','export_data',1),
        ('manager','manage_users',0),('manager','manage_settings',0),('manager','delete_records',0),
        ('manager','edit_records',1),('manager','view_financials',1),('manager','export_data',1),
        ('viewer','manage_users',0),('viewer','manage_settings',0),('viewer','delete_records',0),
        ('viewer','edit_records',0),('viewer','view_financials',1),('viewer','export_data',0)`
    ],
  },
];

export async function runMigrations(database: Database) {
  await database.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  const applied = new Set((await database.select<Array<{ version: number }>>("SELECT version FROM schema_migrations")).map((row) => Number(row.version)));
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    await database.execute("BEGIN IMMEDIATE");
    try {
      for (const statement of migration.statements) await database.execute(statement);
      await database.execute("INSERT INTO schema_migrations(version,name) VALUES ($1,$2)", [migration.version, migration.name]);
      await database.execute("COMMIT");
    } catch (error) {
      await database.execute("ROLLBACK");
      throw new Error(`Database migration ${migration.version} (${migration.name}) failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}