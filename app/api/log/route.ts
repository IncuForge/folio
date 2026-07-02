import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

const LOG_FILE = path.join(process.cwd(), "client_errors.log");
const MAX_LOG_BYTES = 10 * 1024 * 1024; // 10 MB cap to prevent disk exhaustion
const ALLOWED_FIELDS = ["message", "source", "lineno", "colno", "error", "userAgent"];
const SESSION_COOKIE = "folio_session";

export async function POST(request: Request) {
  try {
    // Require an authenticated session — prevent anonymous log spam / injection
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    const session = raw ? await verifySession(raw) : null;
    if (!session) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // Payload size guard
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 8192) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }

    const body = await request.json();

    // Whitelist fields — only log known safe keys
    const sanitized: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        sanitized[key] = typeof body[key] === "string"
          ? body[key].slice(0, 2048) // truncate each field
          : body[key];
      }
    }

    // Cap log file size
    try {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_LOG_BYTES) {
        // Rotate: truncate file and start fresh
        fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Log rotated (exceeded ${MAX_LOG_BYTES} bytes)\n\n`);
      }
    } catch { /* file doesn't exist yet — fine */ }

    const logMessage = `[${new Date().toISOString()}] user:${session.email} ${JSON.stringify(sanitized, null, 2)}\n\n`;
    fs.appendFileSync(LOG_FILE, logMessage, "utf8");
    console.log("\x1b[31m[CLIENT ERROR]\x1b[0m", JSON.stringify(sanitized, null, 2));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false });
  }
}
