import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, ownerFor, signedInOwnerFor, OWNER_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { completeOwnerOnboarding, deleteAccount, updateOwnerProfile } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Please delete your account from Settings." }, { status: 403 });
  }
  const owner = signedInOwnerFor(request);
  if (!owner) return NextResponse.json({ error: "Sign in again to delete your account." }, { status: 401 });
  const input = await request.json().catch(() => null);
  if (input?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 422 });
  }
  deleteAccount(owner.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", authCookieOptions(0));
  response.cookies.set(OWNER_COOKIE, "", authCookieOptions(0));
  return response;
}

export async function GET(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Sign in to view this profile." }, { status: 401 });
  return NextResponse.json({ profile: owner.profile });
}

export async function PATCH(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Sign in to update this profile." }, { status: 401 });
  const input = await request.json();
  const profile = input.onboardingCompleted === true
    ? completeOwnerOnboarding(owner.id)
    : updateOwnerProfile(owner.id, { name: typeof input.name === "string" ? input.name : undefined });
  return NextResponse.json({ profile });
}
