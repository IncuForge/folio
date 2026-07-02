import { NextResponse } from "next/server";
import { users } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession, hashPassword } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

// GET /api/users — list all users (admin only)
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const list = await users.getAll();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users — create new user (admin only)
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { email, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (!["admin", "manager"].includes(role)) {
      return NextResponse.json({ error: "Role must be 'admin' or 'manager'." }, { status: 400 });
    }

    const newUser = await users.create({
      email: email.toLowerCase().trim(),
      password: await hashPassword(password),
      role,
    });

    if (!newUser) {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
