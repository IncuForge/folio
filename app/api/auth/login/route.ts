import { NextResponse } from "next/server";
import { users } from "@/lib/db";
import { cookies } from "next/headers";
import { hashPassword, signSession } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await users.getByEmail(email.toLowerCase().trim());

    if (!user || user.password !== await hashPassword(password)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionPayload = await signSession({ id: user.id, email: user.email, role: user.role, ts: Date.now() });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err: any) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
