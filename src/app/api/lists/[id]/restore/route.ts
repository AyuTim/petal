import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { getList, restoreVersion } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const { versionId } = await request.json();
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "Only the list owner can restore history." }, { status: 403 });
  const list = restoreVersion(versionId);
  if (!list || list.id !== id) return NextResponse.json({ error: "That version is no longer available." }, { status: 404 });
  return NextResponse.json({ list: getList(id) });
}
