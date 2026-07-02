import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("folio_session")?.value;
  
  const session = sessionCookie ? await verifySession(sessionCookie) : null;
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/items/:path*",
    "/api/packages/:path*",
    "/api/orders/:path*",
    "/api/export/:path*",
    "/api/users/:path*",
    "/api/settings/:path*",
    "/api/settings",
    "/api/log",
  ],
};
