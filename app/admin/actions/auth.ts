"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session";
import type { ActionResult } from "@/lib/admin/results";

// Best-effort brute-force brake (per server instance; serverless instances don't share memory, so this slows
// guessing but is not a hard limit. A strong ADMIN_PASSWORD is the real protection).
const attempts = new Map<string, { n: number; until: number }>();
const MAX_TRIES = 5, WINDOW_MS = 15 * 60 * 1000;

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return { ok: false, message: "Admin sign-in is not configured on this server." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.n >= MAX_TRIES) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

  const password = String(formData.get("password") ?? "");
  if (!password || !safeEqual(password, secret)) {
    const cur = rec && rec.until > now ? rec : { n: 0, until: now + WINDOW_MS };
    attempts.set(ip, { n: cur.n + 1, until: cur.until });
    await new Promise((r) => setTimeout(r, 600)); // slows automated guessing
    return { ok: false, message: "Incorrect password." }; // same message whatever went wrong
  }

  const token = await createSessionToken();
  if (!token) return { ok: false, message: "Admin sign-in is not configured on this server." };
  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  redirect("/admin/login");
}
