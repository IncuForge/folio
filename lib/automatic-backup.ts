import fs from "fs/promises";
import path from "path";
import {
  BACKUP_TABLES,
  FOLIO_BACKUP_FORMAT,
  FOLIO_BACKUP_VERSION,
  backupFilename,
} from "./backup";
import { isDirectPg, rawQuery, settings } from "./db";

const BACKUP_DIRECTORY = path.join(process.cwd(), "data", "backups");

export async function runAutomaticBackup(force = false) {
  if (!isDirectPg) {
    return { created: false, supported: false, reason: "Automatic filesystem backups require self-hosted or desktop mode." };
  }

  const configured = await settings.getAll();
  if (!force && configured.autoBackupEnabled === "false") {
    return { created: false, supported: true, reason: "Automatic backups are disabled." };
  }

  const frequency = configured.autoBackupFrequency === "weekly" ? "weekly" : "daily";
  const intervalMs = frequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const lastRun = Date.parse(configured.lastAutoBackupAt || "");
  if (!force && Number.isFinite(lastRun) && Date.now() - lastRun < intervalMs) {
    return { created: false, supported: true, reason: "The current backup is still recent." };
  }

  const rows = await Promise.all(BACKUP_TABLES.map((table) => rawQuery(table)));
  const tables = Object.fromEntries(
    BACKUP_TABLES.map((table, index) => [table, rows[index]])
  );
  const now = new Date();
  const document = {
    format: FOLIO_BACKUP_FORMAT,
    version: FOLIO_BACKUP_VERSION,
    createdAt: now.toISOString(),
    appVersion: process.env.npm_package_version || "0.1.0",
    source: "web",
    tables,
  };

  await fs.mkdir(BACKUP_DIRECTORY, { recursive: true });
  const filename = backupFilename(now);
  await fs.writeFile(path.join(BACKUP_DIRECTORY, filename), JSON.stringify(document, null, 2), "utf8");
  await settings.set("lastAutoBackupAt", now.toISOString());

  const retention = Math.max(3, Math.min(90, Number(configured.autoBackupRetention || 14)));
  const files = (await fs.readdir(BACKUP_DIRECTORY))
    .filter((file) => file.endsWith(".folio-backup.json"))
    .sort()
    .reverse();
  for (const expired of files.slice(retention)) {
    await fs.unlink(path.join(BACKUP_DIRECTORY, expired));
  }

  return { created: true, supported: true, filename, createdAt: now.toISOString() };
}
