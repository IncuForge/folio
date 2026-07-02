import { NextResponse } from "next/server";
import { packages as packagesDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { CreatePackageRequest } from "@/types/schema";

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
    const data = await packagesDb.getAll();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can create package templates
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body: CreatePackageRequest = await request.json();
    const { name, description, price, itemIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Package name is required" }, { status: 400 });
    }

    const newPkg = await packagesDb.create({ name, description, price, itemIds });
    return NextResponse.json(newPkg, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
