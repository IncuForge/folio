import { NextResponse } from "next/server";
import { items as itemsDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { UpdateItemRequest } from "@/types/schema";

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
  // Only admins can edit food library items
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body: UpdateItemRequest = await request.json();

    const existing = await itemsDb.getById(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    const fields = ["name", "type", "ingredients", "style", "image", "notes", "price", "is_available"] as const;
    for (const f of fields) {
      if (body[f] !== undefined) patch[f] = body[f];
    }

    const updated = await itemsDb.update(id, patch);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can delete food library items
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const existing = await itemsDb.getById(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await itemsDb.softDelete(id);
    return NextResponse.json({ success: true, message: "Item deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
