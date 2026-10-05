import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError } from "../api";
import { getClient } from "../tenant";
import { SESSION_COOKIE, verifySessionToken } from "../session";
import { AdminAuthError, ValidationError, type ActionResult } from "./results";

/** Verifies the signed session cookie and resolves the Client this admin manages. Throws AdminAuthError if not signed in. */
export async function getAdminContext() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new AdminAuthError();
  return { client: await getClient() };
}

/** For pages/layouts: redirects to the login page when not signed in. Cached per request. */
export const requirePageContext = cache(async () => {
  try {
    return await getAdminContext();
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/admin/login");
    throw e;
  }
});

/** Same, but returns null instead of throwing when no client exists yet (lets the layout show a setup message). */
export const getPageContextSafe = cache(async () => {
  try {
    return await requirePageContext();
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
});

/** Maps any thrown error to a friendly, non-leaky result. NEXT_REDIRECT-style errors are re-thrown untouched. */
export function toFailure(e: unknown): ActionResult<never> {
  if (e instanceof AdminAuthError) return { ok: false, message: "Your session has expired. Please sign in again.", authExpired: true };
  if (e instanceof ValidationError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }
  if (e instanceof ApiError) return { ok: false, message: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { ok: false, message: "That value is already in use. Choose a different one." };
    if (e.code === "P2025") return { ok: false, message: "That item no longer exists. Refresh the page." };
  }
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error("[admin]", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

/** Wraps a server action body: authenticates, runs it, and converts errors into friendly results. */
export async function withAdmin<T = undefined>(fn: (ctx: Awaited<ReturnType<typeof getAdminContext>>) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn(await getAdminContext());
  } catch (e) {
    return toFailure(e);
  }
}
