import { NextRequest, NextResponse } from "next/server";
import { ownerFor, ownsList } from "@/lib/auth";
import { createItem, deleteCapture, getList, listCaptures, listTags } from "@/lib/db";
import { looksLikeImageUrl } from "@/lib/media";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const owner = ownerFor(request);
  const { id } = await context.params;
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const capture = listCaptures(owner.id).find((entry) => entry.id === id);
  const { listId } = await request.json();
  if (!capture || !ownsList(owner.id, listId)) return NextResponse.json({ error: "Choose one of your own lists." }, { status: 403 });
  const metadata: Record<string, unknown> = { ...(capture.importedMetadata || {}) };
  const savedLink = typeof metadata.link === "string" && /^https?:\/\//i.test(metadata.link) ? metadata.link : null;
  const selectedTagIds = Array.isArray(metadata.tagIds) ? metadata.tagIds.filter((tagId): tagId is string => typeof tagId === "string") : [];
  const tags = listTags(owner.id).filter((tag) => selectedTagIds.includes(tag.id));

  const candidateLink = capture.type === "link" ? capture.content : savedLink;
  const linkIsImage = Boolean(candidateLink && looksLikeImageUrl(candidateLink));
  if (capture.attachmentUrl && typeof metadata.image !== "string") {
    metadata.image = capture.attachmentUrl;
  }
  if (linkIsImage && typeof metadata.image !== "string") {
    metadata.image = candidateLink;
  }

  const contentLooksLikeUrl = /^https?:\/\//i.test(capture.content.trim());
  const item = createItem(listId, {
    // Prefer the Catch note as the item name; only use scraped titles when content is itself a URL.
    title: String((!contentLooksLikeUrl && capture.content.trim()) || metadata.title || capture.content),
    productUrl: linkIsImage ? null : candidateLink,
    notes: metadata.description ? String(metadata.description) : null,
    price: typeof metadata.price === "number" ? metadata.price : null,
    currency: metadata.currency ? String(metadata.currency) : null,
    store: metadata.store ? String(metadata.store) : null,
    importedMetadata: metadata,
    tags,
  });
  deleteCapture(id);
  return NextResponse.json({ list: getList(listId), item, captures: listCaptures(owner.id) });
}
