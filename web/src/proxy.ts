import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED = ["/dashboard"];
const AUTH_PAGES = ["/login", "/register"];

/**
 * OPTIMISTIC redirect only (cookie presence, no DB hit) for a snappy UX.
 * It is NOT a security boundary: server code calls requireUser() for that.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(getSessionCookie(request));

  if (!hasCookie && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasCookie && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
