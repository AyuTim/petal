import { NextRequest, NextResponse } from "next/server";
import { activityFor, createItem, deleteItem, getItem, getList, reorderItems, shareByToken, updateItem } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

function access(token: string) {
  const share = shareByToken(token);
  if (!share) return null;
  return { share, list: getList(share.listId, { hidePrivate: true, sharedOnly: true }) };
}

export async function GET(_request: NextRequest, context: Context) {
  const { token } = await context.params;
  const result = access(token);
  if (!result?.list) return NextResponse.json({ error: "This shared list is no longer available." }, { status: 404 });
  return NextResponse.json({ list: result.list, permission: result.share.permission, activity: result.share.permission === "edit" ? activityFor(result.list.id) : [] });
}

export async function POST(request: NextRequest, context: Context) {
  const { token } = await context.params;
  const result = access(token);
  if (!result?.list || result.share.permission !== "edit") return NextResponse.json({ error: "This link is view-only." }, { status: 403 });
  const input = await request.json();
  const guestName = String(input.guestName || "Guest").slice(0, 40);
  if (input.action === "create") {
    if (!String(input.item?.title || "").trim()) return NextResponse.json({ error: "Your idea needs a title." }, { status: 422 });
    createItem(result.list.id, { ...input.item, title: String(input.item.title).trim(), privateNotes: null }, "guest", guestName);
  }
  if (input.action === "update") {
    const item = getItem(input.itemId);
    if (!item || item.listId !== result.list.id) return NextResponse.json({ error: "We couldn’t find that item." }, { status: 404 });
    const patch = input.patch || {};
    delete patch.privateNotes;
    updateItem(item.id, patch, "guest", guestName);
  }
  if (input.action === "delete") {
    const item = getItem(input.itemId);
    if (!item || item.listId !== result.list.id) return NextResponse.json({ error: "We couldn’t find that item." }, { status: 404 });
    deleteItem(item.id, "guest", guestName);
  }
  if (input.action === "reorder" && Array.isArray(input.ids)) reorderItems(result.list.id, input.ids, "guest", guestName);
  return NextResponse.json({ list: getList(result.list.id, { hidePrivate: true, sharedOnly: true }), activity: activityFor(result.list.id) });
}
