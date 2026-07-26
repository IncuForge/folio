export const FOLIO_BACKUP_FORMAT = "folio.backup" as const;
export const FOLIO_BACKUP_VERSION = 2;

export const BACKUP_TABLES = [
  "items",
  "packages",
  "package_items",
  "orders",
  "order_items",
  "users",
  "settings",
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

export function validateBackup(input: unknown): FolioBackup {
  if (!input || typeof input !== "object") {
    throw new Error("The selected file is not a Folio backup.");
  }
  const candidate = input as Partial<FolioBackup>;
  if (candidate.format !== FOLIO_BACKUP_FORMAT) {
    throw new Error("The selected file has an unknown backup format.");
  }
  if (candidate.version !== FOLIO_BACKUP_VERSION) {
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
      throw new Error("The backup is missing the " + table + " table.");
    }
  }
  if (!candidate.tables.users.some((row) => row.role === "admin")) {
    throw new Error("The backup has no administrator account and cannot be restored.");
  }
  return candidate as FolioBackup;
}

export function backupFilename(date = new Date()) {
  return "folio-backup-" + date.toISOString().replace(/[:.]/g, "-") + ".folio-backup.json";
}
