const DEFAULT_SECRET = "default_fallback_session_secret_change_in_prod";
const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_SECRET;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Abort startup if SESSION_SECRET is weak or missing in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
    throw new Error(
      "[Folio] FATAL: SESSION_SECRET is not set or is using the default fallback value. " +
      "Set a strong random secret (e.g. `openssl rand -hex 32`) in your environment variables before deploying."
    );
  }
} else if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
  console.warn(
    "\x1b[33m[Folio] WARNING: SESSION_SECRET is using the default fallback value. " +
    "Set a strong random secret before deploying to production.\x1b[0m"
  );
}

/**
 * Hashes a password using SHA-256 for basic internal security.
 */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a signed session token: base64(payload).signature
 */
export async function signSession(payload: { id: string; email: string; role: string; ts: number }): Promise<string> {
  const data = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  // Convert signature to base64url
  const hashArray = Array.from(new Uint8Array(signature));
  const base64 = btoa(String.fromCharCode(...hashArray));
  const signatureBase64Url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${data}.${signatureBase64Url}`;
}

/**
 * Verifies a signed session token and returns the decoded payload, or null if invalid/tampered/expired.
 * Enforces the 7-day expiry on every call, not just at /api/auth/check.
 */
export async function verifySession(token: string): Promise<{ id: string; email: string; role: string; ts: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  
  const [data, signature] = parts;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    // Decode base64url signature back to array buffer
    const base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    const binaryStr = atob(base64);
    const sigBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      sigBytes[i] = binaryStr.charCodeAt(i);
    }
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(data)
    );
    if (!isValid) return null;
    
    const payload = JSON.parse(atob(data)) as { id: string; email: string; role: string; ts: number };

    // Enforce session expiry — reject tokens older than 7 days
    if (!payload.ts || Date.now() - payload.ts > SESSION_MAX_AGE_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
