import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { createCapture, deleteCapture, listCaptures, updateCapture } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  return NextResponse.json({ captures: listCaptures(owner.id) });
}

export async function POST(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const input = await request.json();
  if (!String(input.content || "").trim()) return NextResponse.json({ error: "Add a note or a link to save it." }, { status: 422 });
  const type = ["text", "link", "photo", "file"].includes(input.type) ? input.type : "text";
  return NextResponse.json({ capture: createCapture(owner.id, { type, content: String(input.content).trim(), attachmentUrl: input.attachmentUrl || null, importedMetadata: input.importedMetadata || null }) }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !listCaptures(owner.id).some((capture) => capture.id === id)) return NextResponse.json({ error: "That capture belongs to another device." }, { status: 403 });
  deleteCapture(id);
  return NextResponse.json({ captures: listCaptures(owner.id) });
}

export async function PATCH(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const current = id ? listCaptures(owner.id).find((capture) => capture.id === id) : null;
  if (!current) return NextResponse.json({ error: "That capture belongs to another device." }, { status: 403 });
  const input = await request.json();
  const content = typeof input.content === "string" ? input.content.trim() : current.content;
  if (!content) return NextResponse.json({ error: "Give this capture a title before saving." }, { status: 422 });
  const metadata = input.importedMetadata && typeof input.importedMetadata === "object" && !Array.isArray(input.importedMetadata)
    ? input.importedMetadata
    : current.importedMetadata;
  const capture = updateCapture(current.id, { content, importedMetadata: metadata });
  return NextResponse.json({ capture, captures: listCaptures(owner.id) });
}
