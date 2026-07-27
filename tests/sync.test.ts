import test from "node:test";
import assert from "node:assert/strict";
import { mergeBackups, resolveMergeConflicts, syncRowKey } from "../lib/sync";
import { BACKUP_TABLES, FOLIO_BACKUP_FORMAT, FOLIO_BACKUP_VERSION, type FolioBackup } from "../lib/backup";

function backup(overrides: Partial<FolioBackup["tables"]> = {}): FolioBackup {
  const tables = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as unknown as FolioBackup["tables"];
  tables.users = [{ id: "owner", email: "admin", password: "hash", role: "admin" }];
  return { format: FOLIO_BACKUP_FORMAT, version: FOLIO_BACKUP_VERSION, createdAt: "2026-01-01T00:00:00.000Z", appVersion: "0.1.0", source: "desktop", tables: { ...tables, ...overrides } };
}

test("sync keys are stable for entity and relation tables", () => {
  assert.equal(syncRowKey("items", { id: "dish/1" }), "dish%2F1");
  assert.equal(syncRowKey("package_items", { package_id: "p1", item_id: "i1" }), "p1:i1");
});

test("three-way merge combines edits to different records", () => {
  const base = backup({ items: [{ id: "a", name: "A", type: "main" }, { id: "b", name: "B", type: "main" }] });
  const local = backup({ items: [{ id: "a", name: "Local A", type: "main" }, { id: "b", name: "B", type: "main" }] });
  const remote = backup({ items: [{ id: "a", name: "A", type: "main" }, { id: "b", name: "Remote B", type: "main" }] });
  const result = mergeBackups(base, local, remote);
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(result.merged.tables.items.map((row) => row.name), ["Local A", "Remote B"]);
});

test("three-way merge preserves an uncontested deletion", () => {
  const base = backup({ items: [{ id: "a", name: "A", type: "main" }] });
  const local = backup({ items: [] });
  const remote = backup({ items: [{ id: "a", name: "A", type: "main" }] });
  const result = mergeBackups(base, local, remote);
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(result.merged.tables.items, []);
});

test("three-way merge reports concurrent edits without silently selecting remote data", () => {
  const base = backup({ items: [{ id: "a", name: "A", type: "main" }] });
  const local = backup({ items: [{ id: "a", name: "Local", type: "main" }] });
  const remote = backup({ items: [{ id: "a", name: "Remote", type: "main" }] });
  const result = mergeBackups(base, local, remote);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].table, "items");
  assert.equal(result.merged.tables.items[0].name, "Local");
});
test("conflicts can be resolved explicitly toward either device", () => {
  const base = backup({ items: [{ id: "a", name: "A", type: "main" }] });
  const local = backup({ items: [{ id: "a", name: "Local", type: "main" }] });
  const remote = backup({ items: [{ id: "a", name: "Remote", type: "main" }] });
  const result = mergeBackups(base, local, remote);
  assert.equal(resolveMergeConflicts(result.merged, result.conflicts, "local").tables.items[0].name, "Local");
  assert.equal(resolveMergeConflicts(result.merged, result.conflicts, "remote").tables.items[0].name, "Remote");
});