import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { listSummaries, reorderLists } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const owner = ownerFor(request);
  if (!owner) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const { ids } = await request.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "We couldn’t save that order." }, { status: 422 });
  reorderLists(owner.id, ids.map(String));
  return NextResponse.json({ lists: listSummaries(owner.id) });
}
