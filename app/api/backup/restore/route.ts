import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { restoreBackup } from "@/lib/db";
import { validateBackup } from "@/lib/backup";

const SESSION_COOKIE = "folio_session";
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = raw ? await verifySession(raw) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup files are limited to 50 MB." }, { status: 413 });
  }

  try {
    const payload = await request.json();
    const backup = validateBackup(payload.backup);
    const summary = Object.fromEntries(
      Object.entries(backup.tables).map(([table, rows]) => [table, rows.length])
    );

    if (payload.confirm !== true) {
      return NextResponse.json({
        valid: true,
        requiresConfirmation: true,
        createdAt: backup.createdAt,
        appVersion: backup.appVersion,
        summary,
      });
    }

    await restoreBackup(backup);
    return NextResponse.json({ ok: true, restoredAt: new Date().toISOString(), summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
