import { mkdirSync } from "node:fs";
import path from "node:path";

// @ts-expect-error node:sqlite ships with the Node 22 runtime used by Folio CI/local mode.
import { DatabaseSync } from "node:sqlite";

const databasePath = path.resolve(
  process.env.FOLIO_LOCAL_SQLITE_PATH || path.join("data", "folio-local.db"),
);
mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA journal_mode = WAL;");
database.exec("PRAGMA busy_timeout = 5000;");
(globalThis as typeof globalThis & { db?: unknown }).db = database;

const { initDb } = await import("./lib/db");
initDb();
console.info(`[folio] Local SQLite mode: ${databasePath}`);
