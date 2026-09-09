import { NextRequest, NextResponse } from "next/server";
import { signedInOwnerFor } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const owner = signedInOwnerFor(request);
  return NextResponse.json({ authenticated: Boolean(owner), profile: owner?.profile ?? null });
}
