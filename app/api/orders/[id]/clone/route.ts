import { NextResponse } from "next/server";
import { orders as ordersDb } from "@/lib/db";
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

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const original = await ordersDb.getById(id);
    if (!original) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build the item list from the fetched order (already flattened)
    const itemList = (original.items ?? []).map((item: any) => ({
      itemId: item.item_id,
      quantity: item.quantity,
      notes: item.item_notes ?? "",
    }));

    const cloned = await ordersDb.create({
      client_name: `${original.client_name} (Copy)`,
      client_phone: original.client_phone ?? "",
      event_name: original.event_name,
      event_date: original.event_date,
      event_time: original.event_time ?? "",
      venue: original.venue ?? "",
      guest_count: original.guest_count,
      notes: original.notes ?? "",
      status: "pending",
      additional_charges: original.additional_charges ?? [],
      booking_paid: false,
      booking_amount: 0,
      booking_payment_notes: "",
      second_paid: false,
      second_amount: 0,
      second_payment_notes: "",
      final_paid: false,
      final_amount: 0,
      final_payment_notes: "",
      package_id: original.package_id ?? null,
      package_price: original.package_price ?? 0,
      packages_selected: original.packages_selected ?? [],
      sessions: original.sessions ?? [],
      discount_percent: original.discount_percent ?? 0,
      items: itemList,
    });

    return NextResponse.json(cloned, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
