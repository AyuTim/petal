import { NextRequest, NextResponse } from "next/server";
import { activeSharePresence, shareByToken, touchSharePresence } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { token } = await context.params;
  const share = shareByToken(token);
  if (!share) return NextResponse.json({ error: "This shared list is no longer available." }, { status: 404 });
  return NextResponse.json({ viewers: activeSharePresence(share.listId) });
}

export async function POST(request: NextRequest, context: Context) {
  const { token } = await context.params;
  const share = shareByToken(token);
  if (!share) return NextResponse.json({ error: "This shared list is no longer available." }, { status: 404 });
  const input = await request.json().catch(() => null);
  const sessionId = typeof input?.sessionId === "string" ? input.sessionId : "";
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)) return NextResponse.json({ error: "Invalid viewer session." }, { status: 422 });
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 40) : "";
  const viewers = touchSharePresence(share.listId, sessionId, name || null, Boolean(input?.showName) && Boolean(name));
  return NextResponse.json({ viewers });
}
