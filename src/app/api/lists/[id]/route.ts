import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { activityFor, deleteList, getList, updateList, versionsFor } from "@/lib/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "That list is private to another device." }, { status: 403 });
  return NextResponse.json({ list: getList(id), activity: activityFor(id), versions: versionsFor(id) });
}

export async function PATCH(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "That list is private to another device." }, { status: 403 });
  const patch = await request.json();
  const list = updateList(id, patch);
  return NextResponse.json({ list });
}

export async function DELETE(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "That list is private to another device." }, { status: 403 });
  deleteList(id);
  return NextResponse.json({ ok: true });
}
