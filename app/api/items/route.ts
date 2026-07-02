import { NextResponse } from "next/server";
import { items as itemsDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { CreateItemRequest } from "@/types/schema";

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

  try {
    const data = await itemsDb.getAll();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can create food library items
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body: CreateItemRequest = await request.json();
    const { name, type, ingredients, style, image, notes, price } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and Type are required." }, { status: 400 });
    }

    const newItem = await itemsDb.create({ name, type, ingredients, style, image, notes, price });
    return NextResponse.json(newItem, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
