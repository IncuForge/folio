import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;

    if (!raw) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await verifySession(raw);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Reject sessions older than 7 days
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.ts > MAX_AGE_MS) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: { id: session.id, email: session.email, role: session.role },
    });
  } catch (err: any) {
    console.error("[auth/check]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
