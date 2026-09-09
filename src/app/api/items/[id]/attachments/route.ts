import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { addAttachment, getItem, getList } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  const item = getItem(id);
  if (!owner || !item || !ownsList(owner.id, item.listId)) return NextResponse.json({ error: "That item is private to another device." }, { status: 403 });
  const input = await request.json();
  if (!input.fileUrl || !input.type) return NextResponse.json({ error: "We need a file or link first." }, { status: 422 });
  addAttachment(id, input);
  return NextResponse.json({ list: getList(item.listId) }, { status: 201 });
}
