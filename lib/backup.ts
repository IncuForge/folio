export const FOLIO_BACKUP_FORMAT = "folio.backup" as const;
export const FOLIO_BACKUP_VERSION = 3;

export const BACKUP_TABLES = [
  "items", "packages", "package_items", "orders", "order_items", "users", "settings",
  "contacts", "drafts", "attachments", "reminders", "saved_views", "recent_items",
  "audit_log", "undo_log", "role_permissions",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface FolioBackup {
  format: typeof FOLIO_BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  source: "web" | "desktop";
  tables: Record<BackupTable, Record<string, unknown>[]>;
}

const VERSION_3_TABLES = new Set<BackupTable>([
  "contacts", "drafts", "attachments", "reminders", "saved_views", "recent_items",
  "audit_log", "undo_log", "role_permissions",
]);

export function validateBackup(input: unknown): FolioBackup {
  if (!input || typeof input !== "object") throw new Error("The selected file is not a Folio backup.");
  const candidate = input as Partial<FolioBackup>;
  if (candidate.format !== FOLIO_BACKUP_FORMAT) throw new Error("The selected file has an unknown backup format.");
  if (candidate.version !== 2 && candidate.version !== FOLIO_BACKUP_VERSION) {
    throw new Error("Unsupported backup version: " + String(candidate.version));
  }
  if (!candidate.createdAt || Number.isNaN(Date.parse(candidate.createdAt))) {
    throw new Error("The backup does not contain a valid creation date.");
  }
  if (!candidate.tables || typeof candidate.tables !== "object") {
    throw new Error("The backup does not contain database tables.");
  }
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(candidate.tables[table])) {
      if (candidate.version === 2 && VERSION_3_TABLES.has(table)) candidate.tables[table] = [];
      else throw new Error("The backup is missing the " + table + " table.");
    }
  }
  if (!candidate.tables.users.some((row) => row.role === "admin")) {
    throw new Error("The backup has no administrator account and cannot be restored.");
  }
  candidate.version = FOLIO_BACKUP_VERSION;
  return candidate as FolioBackup;
}

export function backupFilename(date = new Date()) {
  return "folio-backup-" + date.toISOString().replace(/[:.]/g, "-") + ".folio-backup.json";
}