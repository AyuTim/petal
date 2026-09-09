import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, OWNER_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { attachGoogleIdentity, createAuthSession, ensureOwner, getOwner, getOwnerByGoogleSub, id } from "@/lib/db";

export const runtime = "nodejs";

const GOOGLE_STATE_COOKIE = "petals_google_state";

type GoogleIdentity = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

function loginRedirect(request: NextRequest, error?: string) {
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  return url;
}

function appOrigin(request: NextRequest) {
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !state || !expectedState || state !== expectedState || !clientId || !clientSecret) {
    return NextResponse.redirect(loginRedirect(request, "google-sign-in-failed"));
  }

  try {
    const callbackUrl = `${appOrigin(request)}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokens.access_token) throw new Error("Google did not return an access token.");

    const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const identity = (await identityResponse.json()) as GoogleIdentity;
    if (!identityResponse.ok || !identity.sub) throw new Error("Google did not return a profile.");

    const existing = getOwnerByGoogleSub(identity.sub);
    const legacyOwnerId = request.cookies.get(OWNER_COOKIE)?.value;
    const legacyOwner = legacyOwnerId ? getOwner(legacyOwnerId) : null;
    // The first Google sign-in on a device adopts its existing private lists.
    const ownerId = existing?.id ?? (legacyOwner && legacyOwner.profile.provider === "device" ? legacyOwner.id : id());
    if (!existing && !legacyOwner) ensureOwner(ownerId);
    const owner = attachGoogleIdentity(ownerId, {
      googleSub: identity.sub,
      email: identity.email ?? null,
      name: identity.name ?? null,
      avatarUrl: identity.picture ?? null,
    });
    if (!owner) throw new Error("We couldn’t save this account.");

    const session = createAuthSession(owner.id);
    const response = NextResponse.redirect(new URL("/", appOrigin(request)));
    response.cookies.set(SESSION_COOKIE, session.token, authCookieOptions(60 * 60 * 24 * 30));
    response.cookies.set(OWNER_COOKIE, owner.id, authCookieOptions(60 * 60 * 24 * 365 * 5));
    response.cookies.set(GOOGLE_STATE_COOKIE, "", authCookieOptions(0));
    return response;
  } catch {
    return NextResponse.redirect(loginRedirect(request, "google-sign-in-failed"));
  }
}
