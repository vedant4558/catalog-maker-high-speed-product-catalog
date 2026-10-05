import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// First gate for the admin area. Runs ONLY for /admin and /api/admin (customer catalog is untouched, no added latency).
// This is a fast redirect/401 layer; every page, server action and API route re-verifies on its own.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const valid = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (valid) return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    // Bearer-token callers are verified by the route itself.
    if (req.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return NextResponse.next();
    return NextResponse.json({ error: { code: "unauthorized", message: "Unauthorized." } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
