import { NextResponse } from "next/server";
import { settings } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

// GET /api/settings
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const allSettings = await settings.getAll();
    return NextResponse.json(allSettings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/settings — write settings (admin only)
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const payload = await request.json();
    
    // Validate and update key-value pairs
    for (const key of Object.keys(payload)) {
      let val = payload[key];
      if (val !== undefined && val !== null) {
        if (typeof val === "object") {
          val = JSON.stringify(val);
        } else {
          val = String(val);
        }
        await settings.set(key, val);
      }
    }

    const updated = await settings.getAll();
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
