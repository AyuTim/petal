import type { ListItem, PetalList } from "./types";

export const GENERAL_DESCRIPTION = "Everything on your bucket lists this year (archived lists stay out).";
export const LEGACY_GENERAL_DESCRIPTION = "A catch-all. Tag items onto a season when they belong somewhere.";

export function isGeneralList(list: Pick<PetalList, "title" | "type">) {
  return list.type === "bucket" && list.title.trim().toLowerCase() === "general";
}

export function generalYear(list?: Pick<PetalList, "title" | "description"> | null) {
  const fromTitle = list?.title.match(/\b(20\d{2})\b/);
  if (fromTitle) return Number(fromTitle[1]);
  const fromDesc = list?.description?.match(/\b(20\d{2})\b/);
  if (fromDesc) return Number(fromDesc[1]);
  return new Date().getFullYear();
}

function isOtherYearList(list: Pick<PetalList, "title">, year: number) {
  const exact = list.title.trim().match(/^(20\d{2})$/);
  return Boolean(exact && Number(exact[1]) !== year);
}

/** Active Bucket-section lists that General should pull from. Wish, shopping, and to-do never qualify. */
export function isActiveBucketSource(list: Pick<PetalList, "type" | "title" | "archivedAt">, year: number) {
  if (list.archivedAt) return false;
  if (list.type !== "bucket" && list.type !== "custom") return false;
  if (isOtherYearList(list, year)) return false;
  return true;
}

export function aggregateBucketItems(lists: PetalList[], general?: PetalList | null): ListItem[] {
  const year = generalYear(general);
  const byId = new Map<string, ListItem>();
  for (const entry of lists) {
    if (!isActiveBucketSource(entry, year)) continue;
    for (const item of entry.items || []) {
      byId.set(item.id, item);
    }
  }
  if (general) {
    for (const item of general.items || []) {
      byId.set(item.id, item);
    }
  }
  const customOrder = new Map((general?.generalItemOrder || []).map((id, position) => [id, position]));
  return [...byId.values()].sort((a, b) => {
    const aOrder = customOrder.get(a.id);
    const bOrder = customOrder.get(b.id);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.position - b.position;
  });
}

export function withGeneralAggregation<T extends PetalList>(list: T, lists: PetalList[]): T {
  if (!isGeneralList(list)) return list;
  const items = aggregateBucketItems(lists, list);
  const complete = items.filter((item) => item.completed).length;
  const next = { ...list, items };
  if ("progress" in list) {
    return { ...next, progress: { complete, total: items.length } };
  }
  return next;
}
