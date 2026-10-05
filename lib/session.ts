// Signed admin session cookie. WebCrypto only, so the SAME code runs in middleware (edge) and Node.
// Token = "v1.<expiry-ms>.<nonce>.<hmac>"; the HMAC key is derived from ADMIN_PASSWORD, so the password
// itself is never stored in the cookie and changing it instantly invalidates every session.

export const SESSION_COOKIE = "cm_admin";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const enc = new TextEncoder();

function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string): Uint8Array | null {
  try {
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(): Promise<CryptoKey | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const material = await crypto.subtle.digest("SHA-256", enc.encode(`catalog-maker/session/v1:${pw}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(now = Date.now()): Promise<string | null> {
  const key = await hmacKey();
  if (!key) return null;
  const nonce = toB64u(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `v1.${now + SESSION_TTL_SECONDS * 1000}.${nonce}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${toB64u(sig)}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 400) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  const key = await hmacKey();
  const sig = fromB64u(parts[3]);
  if (!key || !sig) return false;
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", key, sig as BufferSource, enc.encode(parts.slice(0, 3).join(".")));
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
