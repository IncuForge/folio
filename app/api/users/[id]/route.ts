import { NextResponse } from "next/server";
import { users } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession, hashPassword } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";

// The preview demo account that should never have its password changed
const PROTECTED_EMAIL = "admin2@cater.com";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

// PATCH /api/users/[id] — change a user's password
// - Admin can change any user's password (except the protected preview account)
// - A user can change their own password (except if they ARE the protected account)
export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isAdmin = session.role === "admin";
  const isSelf = session.id === id;

  // Only admins can change others' passwords; anyone can change their own
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Fetch the target user to check if it's the protected account
    const targetUser = await users.getByEmail(
      // We need the email — fetch by ID first
      await (async () => {
        const all = await users.getAll();
        return all.find((u: any) => u.id === id)?.email ?? "";
      })()
    );

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Block password changes on any admin account
    if (targetUser.role === "admin") {
      return NextResponse.json(
        { error: "Password modifications are disabled for administrator accounts." },
        { status: 403 }
      );
    }

    const hashed = await hashPassword(newPassword);
    await users.updatePassword(id, hashed);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[users/patch]", err);
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

// DELETE /api/users/[id] — delete user (admin only, cannot delete self)
export async function DELETE(
  _request: Request,
  { params }: RouteParams
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === session.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  try {
    await users.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
