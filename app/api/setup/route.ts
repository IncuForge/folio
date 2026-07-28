import { NextResponse } from "next/server";
import { users, settings } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getCurrencySymbol, resolveCurrencyCode } from "@/lib/currencies";

const LEGACY_SEEDED_USERS = new Set(["admin1@cater.com", "admin2@cater.com"]);

async function setupState() {
  const existing = await users.getAll();
  const legacySetup = existing.length > 0 && existing.every((user) => LEGACY_SEEDED_USERS.has(user.email));
  return { existing, setupRequired: existing.length === 0 || legacySetup, legacySetup };
}

export async function GET() {
  try {
    const state = await setupState();
    return NextResponse.json({ setupRequired: state.setupRequired, legacySetup: state.legacySetup });
  } catch {
    return NextResponse.json({ error: "Unable to inspect setup state." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const state = await setupState();
    if (!state.setupRequired) {
      return NextResponse.json({ error: "Folio has already been set up." }, { status: 409 });
    }

    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const currencyCode = resolveCurrencyCode(typeof body.currencyCode === "string" ? body.currencyCode : body.currencySymbol);
    const currencySymbol = getCurrencySymbol(currencyCode);

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!businessName) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    for (const legacyUser of state.legacySetup ? state.existing : []) {
      await users.delete(legacyUser.id);
    }

    const owner = await users.create({
      email: username,
      password: await hashPassword(password),
      role: "admin",
    });
    if (!owner) {
      return NextResponse.json({ error: "Could not create the owner account." }, { status: 409 });
    }

    await settings.set("pdfBrandName", businessName);
    await settings.set("currencyCode", currencyCode);
    await settings.set("currencySymbol", currencySymbol);
    await settings.set("onboardingVersion", "1");
    await settings.set("autoBackupEnabled", "true");
    await settings.set("autoBackupFrequency", "daily");
    await settings.set("autoBackupRetention", "14");

    return NextResponse.json({ ok: true, username: owner.email }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Initial setup failed." }, { status: 500 });
  }
}
