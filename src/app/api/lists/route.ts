import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { createList, listSummaries } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Your private device session is unavailable. Refresh and try again." }, { status: 401 });
  const input = await request.json();
  if (!String(input.title || "").trim()) return NextResponse.json({ error: "Give this list a title first." }, { status: 422 });
  const list = createList(owner.id, { ...input, title: String(input.title).trim() });
  return NextResponse.json({ list }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Not signed in on this device." }, { status: 401 });
  return NextResponse.json({ lists: listSummaries(owner.id) });
}
