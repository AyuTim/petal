import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { completeOwnerOnboarding, updateOwnerProfile } from "@/lib/db";

export const runtime = "nodejs";

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
