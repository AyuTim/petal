import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { addAttachment, createItem, createList, getList } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  try {
    const source = await request.json();
    const input = source.list || source;
    if (!input || typeof input.title !== "string" || !input.title.trim()) throw new Error("This backup doesn’t contain a recognizable list title.");
    const list = createList(owner.id, { ...input, title: input.title.trim(), archivedAt: null });
    if (!list) throw new Error("We couldn't create the new list.");
    for (const item of Array.isArray(input.items) ? input.items : []) {
      if (!item?.title) continue;
      const created = createItem(list.id, { ...item, tags: [] });
      if (!created) continue;
      for (const attachment of Array.isArray(item.attachments) ? item.attachments : []) {
        if (attachment?.fileUrl) addAttachment(created.id, attachment);
      }
    }
    return NextResponse.json({ list: getList(list.id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn’t read that backup. Try a Petals JSON export." }, { status: 422 });
  }
}
