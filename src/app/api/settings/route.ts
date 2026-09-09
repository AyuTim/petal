import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { updateSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  return NextResponse.json({ settings: updateSettings(owner.id, await request.json()) });
}
