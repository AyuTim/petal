import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { duplicateList } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) {
    return NextResponse.json({ error: "Only this list’s owner can duplicate it." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const list = duplicateList(id, owner.id, body.title ? String(body.title) : undefined);
  if (!list) return NextResponse.json({ error: "We couldn’t duplicate that list." }, { status: 404 });
  return NextResponse.json({ list }, { status: 201 });
}
