import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { createItem, getList } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner || !ownsList(owner.id, id)) return NextResponse.json({ error: "That list is private to another device." }, { status: 403 });
  const input = await request.json();
  if (!String(input.title || "").trim()) return NextResponse.json({ error: "Your idea needs a title." }, { status: 422 });
  createItem(id, { ...input, title: String(input.title).trim() });
  return NextResponse.json({ list: getList(id) }, { status: 201 });
}
