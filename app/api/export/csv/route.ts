import { NextResponse } from "next/server";
import { orders as ordersDb } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

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
    // Use the fully-populated orders from the adapter (includes nested items)
    const allOrders = await ordersDb.getAll();

    // CSV Headers
    const headers = [
      "Order ID", "Client Name", "Client Phone", "Event Name", "Event Date",
      "Event Time", "Venue", "Guest Count", "Status", "Items (Quantity)",
      "Booking Paid", "Booking Amount", "Booking Payment Notes",
      "Second Paid", "Second Amount", "Second Payment Notes",
      "Final Paid", "Final Amount", "Final Payment Notes",
      "Additional Charges Total", "Total Revenue", "Created At"
    ];

    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(",")];

    for (const order of allOrders) {
      const itemsList = (order.items ?? []).map(
        (it: any) => `${it.name ?? "Unknown"} (${it.quantity})`
      );
      const itemsStr = itemsList.join(" | ");

      const charges = Array.isArray(order.additional_charges) ? order.additional_charges : [];
      const additionalChargesTotal = charges.reduce((s: number, c: any) => s + (c.amount ?? 0), 0);

      const totalRevenue =
        (order.booking_paid ? Number(order.booking_amount) : 0) +
        (order.second_paid ? Number(order.second_amount) : 0) +
        (order.final_paid ? Number(order.final_amount) : 0) +
        additionalChargesTotal;

      const row = [
        sanitize(order.id), sanitize(order.client_name), sanitize(order.client_phone),
        sanitize(order.event_name), sanitize(order.event_date), sanitize(order.event_time),
        sanitize(order.venue), order.guest_count, sanitize(order.status), sanitize(itemsStr),
        order.booking_paid ? "Yes" : "No", order.booking_amount, sanitize(order.booking_payment_notes),
        order.second_paid ? "Yes" : "No", order.second_amount, sanitize(order.second_payment_notes),
        order.final_paid ? "Yes" : "No", order.final_amount, sanitize(order.final_payment_notes),
        additionalChargesTotal, totalRevenue, sanitize(order.created_at)
      ];

      rows.push(row.join(","));
    }

    const csvContent = "\ufeff" + rows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=catering_orders_report.csv",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
