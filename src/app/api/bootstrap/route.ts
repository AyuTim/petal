import { NextRequest, NextResponse } from "next/server";
import { OWNER_COOKIE, SESSION_COOKIE, newOwnerId, ownerIdFrom } from "@/lib/auth";
import { activityFor, ensureOwner, getList, listCaptures, listSummaries, listTags, markSeeded } from "@/lib/db";
import { ensureDayTags, ensureSeasonTags, ensureSeasonalLists, seedOwner } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let ownerId = ownerIdFrom(request);
  if (request.cookies.get(SESSION_COOKIE)?.value && !ownerId) {
    return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
  }
  const created = !ownerId;
  if (!ownerId) ownerId = newOwnerId();
  const owner = ensureOwner(ownerId);
  if (owner && !owner.seeded) {
    seedOwner(ownerId);
    markSeeded(ownerId);
  } else if (owner) {
    ensureSeasonalLists(ownerId);
    ensureSeasonTags(ownerId);
    ensureDayTags(ownerId);
  }
  const lists = listSummaries(ownerId).map((summary) => {
    const list = getList(summary.id)!;
    const complete = list.items?.filter((item) => item.completed).length ?? 0;
    return { ...list, progress: { complete, total: list.items?.length ?? 0 }, recentActivity: activityFor(list.id).slice(0, 3) };
  });
  const response = NextResponse.json({
    settings: owner?.settings,
    profile: owner?.profile,
    lists,
    tags: listTags(ownerId),
    captures: listCaptures(ownerId),
    created,
  });
  if (created) response.cookies.set(OWNER_COOKIE, ownerId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
  return response;
}
