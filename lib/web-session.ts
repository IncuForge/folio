import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
export async function webSession(){const raw=(await cookies()).get("folio_session")?.value;return raw?verifySession(raw):null}