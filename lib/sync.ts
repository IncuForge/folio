import { BACKUP_TABLES, type BackupTable, type FolioBackup, validateBackup } from "./backup";

export type SyncRow = Record<string, unknown>;

export interface SyncConflict {
  table: BackupTable;
  key: string;
  base: SyncRow | null;
  local: SyncRow | null;
  remote: SyncRow | null;
}

export interface SyncMergeResult {
  merged: FolioBackup;
  conflicts: SyncConflict[];
}

const keys: Record<BackupTable, readonly string[]> = {
  items: ["id"],
  packages: ["id"],
  package_items: ["package_id", "item_id"],
  orders: ["id"],
  order_items: ["order_id", "item_id"],
  users: ["id"],
  settings: ["key"],
  contacts: ["id"],
  drafts: ["id"],
  attachments: ["id"],
  reminders: ["id"],
  saved_views: ["id"],
  recent_items: ["id"],
  audit_log: ["id"],
  undo_log: ["id"],
  role_permissions: ["role", "capability"],
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

export function syncRowKey(table: BackupTable, row: SyncRow): string {
  const parts = keys[table].map((column) => row[column]);
  if (parts.some((part) => part === undefined || part === null || String(part) === "")) {
    throw new Error(`Sync row in ${table} has no stable key.`);
  }
  return parts.map((part) => encodeURIComponent(String(part))).join(":");
}

function rowsByKey(table: BackupTable, rows: SyncRow[]): Map<string, SyncRow> {
  return new Map(rows.map((row) => [syncRowKey(table, row), row]));
}

function same(left: SyncRow | null, right: SyncRow | null): boolean {
  return canonical(left) === canonical(right);
}

/**
 * Performs a deterministic three-way merge. Non-overlapping edits and deletions
 * merge automatically. Concurrent edits to the same row are reported and the
 * local row is retained in the candidate output until a user resolves them.
 */
export function mergeBackups(baseInput: unknown, localInput: unknown, remoteInput: unknown): SyncMergeResult {
  const base = validateBackup(baseInput);
  const local = validateBackup(localInput);
  const remote = validateBackup(remoteInput);
  const conflicts: SyncConflict[] = [];
  const tables = {} as FolioBackup["tables"];

  for (const table of BACKUP_TABLES) {
    const baseRows = rowsByKey(table, base.tables[table]);
    const localRows = rowsByKey(table, local.tables[table]);
    const remoteRows = rowsByKey(table, remote.tables[table]);
    const allKeys = new Set([...baseRows.keys(), ...localRows.keys(), ...remoteRows.keys()]);
    const mergedRows: SyncRow[] = [];

    for (const key of [...allKeys].sort()) {
      const baseRow = baseRows.get(key) ?? null;
      const localRow = localRows.get(key) ?? null;
      const remoteRow = remoteRows.get(key) ?? null;
      let selected: SyncRow | null;

      if (same(localRow, remoteRow)) selected = localRow;
      else if (same(localRow, baseRow)) selected = remoteRow;
      else if (same(remoteRow, baseRow)) selected = localRow;
      else {
        conflicts.push({ table, key, base: baseRow, local: localRow, remote: remoteRow });
        selected = localRow;
      }
      if (selected) mergedRows.push(selected);
    }
    tables[table] = mergedRows;
  }

  return {
    merged: {
      ...local,
      createdAt: new Date().toISOString(),
      tables,
    },
    conflicts,
  };
}

export function snapshotFingerprint(snapshotInput: unknown): string {
  const snapshot = validateBackup(snapshotInput);
  return canonical({ version: snapshot.version, tables: snapshot.tables });
}
export function resolveMergeConflicts(candidateInput: unknown, conflicts: SyncConflict[], choice: "local" | "remote"): FolioBackup {
  const candidate = validateBackup(candidateInput);
  const tables = { ...candidate.tables };
  for (const table of BACKUP_TABLES) {
    const rows = rowsByKey(table, candidate.tables[table]);
    for (const conflict of conflicts.filter((entry) => entry.table === table)) {
      const selected = choice === "local" ? conflict.local : conflict.remote;
      if (selected) rows.set(conflict.key, selected);
      else rows.delete(conflict.key);
    }
    tables[table] = [...rows.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, row]) => row);
  }
  return { ...candidate, createdAt: new Date().toISOString(), tables };
}