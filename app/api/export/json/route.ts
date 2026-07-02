import { NextResponse } from "next/server";
import { rawQuery } from "@/lib/db";
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
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [items, packages, packageItems, orders, orderItems] = await Promise.all([
      rawQuery("items"),
      rawQuery("packages"),
      rawQuery("package_items"),
      rawQuery("orders"),
      rawQuery("order_items"),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      items,
      packages,
      packageItems,
      orders,
      orderItems,
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=catering_data_export.json",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "An internal error occurred." }, { status: 500 });
  }
}
