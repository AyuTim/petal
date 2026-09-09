import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { deleteAttachment, getItem, getList, updateAttachment } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const patch = await request.json();
  const { getDb } = await import("@/lib/db");
  const row = getDb().prepare("SELECT item_id FROM attachments WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "That attachment is gone." }, { status: 404 });
  const item = getItem(String(row.item_id));
  if (!owner || !item || !ownsList(owner.id, item.listId)) {
    return NextResponse.json({ error: "Only the owner can change attachment privacy." }, { status: 403 });
  }
  updateAttachment(id, patch);
  return NextResponse.json({ list: getList(item.listId) });
}

export async function DELETE(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const { getDb } = await import("@/lib/db");
  const row = getDb().prepare("SELECT item_id FROM attachments WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "That attachment is gone." }, { status: 404 });
  const item = getItem(String(row.item_id));
  if (!owner || !item || !ownsList(owner.id, item.listId)) {
    return NextResponse.json({ error: "Only the owner can remove that file." }, { status: 403 });
  }
  deleteAttachment(id);
  return NextResponse.json({ list: getList(item.listId) });
}
