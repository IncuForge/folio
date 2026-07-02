import { NextResponse } from "next/server";
import { items as itemsDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

const SESSION_COOKIE = "folio_session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return await verifySession(raw);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can toggle item availability
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { is_available } = body;

    const existing = await itemsDb.getById(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (is_available === undefined) {
      return NextResponse.json({ error: "is_available state is required" }, { status: 400 });
    }

    const updated = await itemsDb.setAvailability(id, !!is_available);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
