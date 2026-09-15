/**
 * NextAuth middleware — protects all /platform/* routes.
 * Unauthenticated requests are redirected to /login.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPlatformRoute = req.nextUrl.pathname.startsWith("/platform");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isAuthRoute =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");

  if (isPlatformRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/platform/dashboard", req.url));
  }

  if (isApiRoute && req.nextUrl.pathname.startsWith("/api/ai") && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/platform/:path*",
    "/login",
    "/register",
    "/api/ai/:path*",
  ],
};
