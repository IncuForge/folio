import { NextResponse } from "next/server";
import { orders as ordersDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { UpdateOrderRequest } from "@/types/schema";

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

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const order = await ordersDb.getById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body: UpdateOrderRequest = await request.json();

    const existing = await ordersDb.getById(id);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await ordersDb.update(id, body as any);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admins can delete orders
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const override = url.searchParams.get("override") === "true";

    const order = await ordersDb.getById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Cancellation window check (3 days before event)
    const eventDate = new Date(order.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3 && !override) {
      return NextResponse.json(
        {
          error: "cancellation_lock",
          message: `This event is scheduled for ${order.event_date} (in ${diffDays} days). Raw ingredients may have already been ordered or prepared. Are you sure you want to proceed?`,
        },
        { status: 400 }
      );
    }

    await ordersDb.delete(id);
    return NextResponse.json({ success: true, message: "Order deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
