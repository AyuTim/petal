import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { getList, reorderGeneralItems, reorderItems, reorderLists, reorderMood } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "That list is private to another device." }, { status: 403 });
  const { ids, kind } = await request.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "We couldn’t save that order." }, { status: 422 });
  if (kind === "lists") reorderLists(owner.id, ids);
  else if (kind === "general") reorderGeneralItems(id, owner.id, ids.map(String));
  else if (kind === "mood") reorderMood(id, ids);
  else reorderItems(id, ids);
  return NextResponse.json({ list: getList(id) });
}
