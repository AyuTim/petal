import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "petals_session";

/**
 * Petals is an account-first workspace. Public share links remain available,
 * while every private app page begins at the sign-in screen.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAsset = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(pathname);
  if (pathname === "/login" || pathname.startsWith("/s/") || pathname.startsWith("/api/") || isPublicAsset) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
