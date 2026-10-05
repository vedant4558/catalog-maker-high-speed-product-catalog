import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// Short edge cache + stale-while-revalidate: browsing feels instant, data stays fresh.
export const CACHE_LIST = "public, s-maxage=30, stale-while-revalidate=300";
export const CACHE_DETAIL = "public, s-maxage=60, stale-while-revalidate=600";
export const CACHE_CONFIG = "public, s-maxage=60, stale-while-revalidate=600";

export function json<T>(data: T, cache?: string, status = 200) {
  const res = NextResponse.json(data, { status });
  if (cache) res.headers.set("Cache-Control", cache);
  return res;
}

/** Wraps a handler so customers never see raw server errors (assignment §16). */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, "no-store", e.status);
      if (e instanceof ZodError) return json({ error: { code: "bad_request", message: "Invalid query parameters." } }, "no-store", 400);
      console.error("[api]", e);
      return json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, "no-store", 500);
    }
  };
}
