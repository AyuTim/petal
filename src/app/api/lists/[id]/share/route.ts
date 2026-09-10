import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { disableShare, upsertShare } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "Only this list's owner can change sharing." }, { status: 403 });
  const input = await request.json();
  if (input.disable) return NextResponse.json({ share: disableShare(id) });
  const permission = input.permission === "edit" || input.permission === "check" ? input.permission : "view";
  return NextResponse.json({ share: upsertShare(id, permission, Boolean(input.regenerate)) });
}
