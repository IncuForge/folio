import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { runAutomaticBackup } from "@/lib/automatic-backup";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("folio_session")?.value;
  const session = raw ? await verifySession(raw) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await runAutomaticBackup(false));
  } catch {
    return NextResponse.json({ error: "Automatic backup failed." }, { status: 500 });
  }
}
