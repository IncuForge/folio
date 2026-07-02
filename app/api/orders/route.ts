import { NextResponse } from "next/server";
import { orders as ordersDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { CreateOrderRequest } from "@/types/schema";

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
    const data = await ordersDb.getAll();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: CreateOrderRequest = await request.json();
    const { client_name, event_name, event_date } = body;

    if (!client_name || !event_name || !event_date) {
      return NextResponse.json(
        { error: "Client Name, Event Name, and Event Date are required." },
        { status: 400 }
      );
    }

    const newOrder = await ordersDb.create(body as any);
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
