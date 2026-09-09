import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { createTag, deleteTag, listTags, updateTag } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  return NextResponse.json({ tags: listTags(owner.id) });
}
export async function POST(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const { name, color } = await request.json();
  if (!String(name || "").trim()) return NextResponse.json({ error: "Give the tag a name." }, { status: 422 });
  return NextResponse.json({ tag: createTag(owner.id, String(name).trim(), color || "#FFD6E0") }, { status: 201 });
}
export async function PATCH(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const { id, ...patch } = await request.json();
  if (!listTags(owner.id).some((tag) => tag.id === id)) return NextResponse.json({ error: "That tag belongs to another device." }, { status: 403 });
  updateTag(id, patch);
  return NextResponse.json({ tags: listTags(owner.id) });
}
export async function DELETE(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !listTags(owner.id).some((tag) => tag.id === id)) return NextResponse.json({ error: "That tag belongs to another device." }, { status: 403 });
  deleteTag(id);
  return NextResponse.json({ tags: listTags(owner.id) });
}
