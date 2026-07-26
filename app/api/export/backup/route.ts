import { NextResponse } from "next/server";
import { rawQuery } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import {
  BACKUP_TABLES,
  FOLIO_BACKUP_FORMAT,
  FOLIO_BACKUP_VERSION,
  backupFilename,
} from "@/lib/backup";

const SESSION_COOKIE = "folio_session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const rows = await Promise.all(BACKUP_TABLES.map((table) => rawQuery(table)));
    const tables = Object.fromEntries(
      BACKUP_TABLES.map((table, index) => [table, rows[index]])
    );

    const backupData = {
      format: FOLIO_BACKUP_FORMAT,
      version: FOLIO_BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version || "0.1.0",
      source: "web",
      tables,
    };

    const fileBuffer = Buffer.from(JSON.stringify(backupData, null, 2));

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"" + backupFilename() + "\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
