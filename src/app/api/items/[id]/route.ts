import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { deleteItem, getItem, getList, updateItem } from "@/lib/db";
import { sectionForType } from "@/lib/sections";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const item = getItem(id);
  if (!owner || !item || !ownsList(owner.id, item.listId)) return NextResponse.json({ error: "That item is private to another device." }, { status: 403 });
  const patch = await request.json();
  if (typeof patch.listId === "string" && patch.listId) {
    if (!ownsList(owner.id, patch.listId)) {
      return NextResponse.json({ error: "Choose one of your own lists." }, { status: 403 });
    }
    const currentList = getList(item.listId);
    const destList = getList(patch.listId);
    if (currentList && destList && sectionForType(currentList.type) !== sectionForType(destList.type)) {
      return NextResponse.json({ error: "Items stay in the same section." }, { status: 400 });
    }
  }
  updateItem(id, patch);
  return NextResponse.json({ list: getList(item.listId) });
}

export async function DELETE(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const item = getItem(id);
  if (!owner || !item || !ownsList(owner.id, item.listId)) return NextResponse.json({ error: "That item is private to another device." }, { status: 403 });
  deleteItem(id);
  return NextResponse.json({ list: getList(item.listId) });
}
