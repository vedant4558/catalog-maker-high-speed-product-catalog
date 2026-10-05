import { timingSafeEqual, createHash } from "node:crypto";
import { ApiError } from "./api";
import { SESSION_COOKIE, readCookie, verifySessionToken } from "./session";

/** Constant-time string comparison (hashes first so length differences leak nothing). */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Guard for /api/admin/*. Accepts EITHER
 *  - `Authorization: Bearer <ADMIN_PASSWORD>` (scripts, curl; Part 2 behaviour preserved), OR
 *  - the signed admin session cookie set by the login page.
 * Cookie-authenticated mutations must come from the same origin (CSRF defence in depth on top of SameSite=Lax).
 * Fails closed: with no ADMIN_PASSWORD configured, nothing is reachable.
 */
export async function requireAdmin(req: Request) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new ApiError(503, "not_configured", "Admin access is not configured.");

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (bearer) {
    if (safeEqual(bearer, secret)) return;
    throw new ApiError(401, "unauthorized", "Unauthorized.");
  }

  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (token && (await verifySessionToken(token))) {
    if (!SAFE_METHODS.has(req.method.toUpperCase())) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      let ok = false;
      try {
        ok = !!origin && !!host && new URL(origin).host === host;
      } catch {
        ok = false;
      }
      if (!ok) throw new ApiError(403, "forbidden", "Cross-site request blocked.");
    }
    return;
  }
  throw new ApiError(401, "unauthorized", "Unauthorized.");
}

/** Scheduled sync endpoint: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically). */
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "not_configured", "Cron is not configured.");
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !safeEqual(token, secret)) throw new ApiError(401, "unauthorized", "Unauthorized.");
}
