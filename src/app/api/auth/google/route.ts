import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

const GOOGLE_STATE_COOKIE = "petals_google_state";

function appOrigin(request: NextRequest) {
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", request.url));
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const callbackUrl = `${appOrigin(request)}/api/auth/google/callback`;
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, authCookieOptions(10 * 60));
  return response;
}
