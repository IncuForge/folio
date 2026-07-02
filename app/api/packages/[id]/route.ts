import { NextResponse } from "next/server";
import { packages as packagesDb } from "@/lib/db";
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

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can edit package templates
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, itemIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Package name is required" }, { status: 400 });
    }

    const existing = await packagesDb.getById(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const updated = await packagesDb.update(id, {
      name,
      description,
      price: price !== undefined && price !== "" ? parseFloat(price) : null,
      itemIds
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can delete package templates
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const existing = await packagesDb.getById(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    await packagesDb.softDelete(id);
    return NextResponse.json({ success: true, message: "Package template deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
