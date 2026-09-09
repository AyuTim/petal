import { brightenPastel } from "./palette";
import type { ListItem, OwnerProfile, OwnerSettings, PetalList, QuickCapture, Tag } from "./types";

export type ListSummary = PetalList & {
  progress: { complete: number; total: number };
};

export type Bootstrap = {
  settings: OwnerSettings;
  profile: OwnerProfile;
  lists: ListSummary[];
  tags: Tag[];
  captures: QuickCapture[];
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

export function money(amount: number | null | undefined, currency = "USD") {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function typeLabel(type: PetalList["type"]) {
  return (
    {
      bucket: "Bucket",
      wish: "Wish",
      shopping: "Shopping",
      todo: "To-do",
      custom: "List",
    } as const
  )[type];
}

export function listCountLabel(type: PetalList["type"], total: number, complete: number) {
  if (!total) return "No items yet";
  const noun = type === "wish" ? (total === 1 ? "wish" : "wishes") : total === 1 ? "item" : "items";
  if (complete === 0) return `${total} ${noun}`;
  if (complete === total) return `${total} ${noun} · all done`;
  return `${total} ${noun} · ${complete} done`;
}

export function prettyMonth(key: string | null | undefined) {
  if (!key) return null;
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString(undefined, { month: "short" });
}

const QUIET_DESCRIPTIONS = new Set([
  "a short list for the season.",
  "plans for this season.",
  "places, meals, and trips.",
  "gifts and treats.",
  "things to pick up.",
  "things for home.",
  "books, films, and shows.",
  "pieces for home.",
  "groceries and essentials.",
]);

export function showDescription(text: string | null | undefined) {
  const value = text?.trim() ?? "";
  return value.length > 0 && !QUIET_DESCRIPTIONS.has(value.toLowerCase());
}

export function coverStyle(list: Pick<PetalList, "color" | "coverStyle" | "coverImage">) {
  const color = brightenPastel(list.color);
  if (list.coverStyle === "image" && list.coverImage) {
    return { backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(90,70,60,0.18)), url(${list.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  if (list.coverStyle === "gradient") {
    return { background: `linear-gradient(160deg, ${color}, #fafafa 78%)` };
  }
  if (list.coverStyle === "pattern") {
    return {
      backgroundColor: color,
      backgroundImage:
        "radial-gradient(circle at 12px 12px, rgba(255,255,255,0.45) 1.6px, transparent 1.8px)",
      backgroundSize: "22px 22px",
    };
  }
  return { background: color };
}

export function itemVisual(item: ListItem) {
  const image = item.attachments.find((a) => a.type === "image") || item.attachments[0];
  const fromMeta = item.importedMetadata && typeof item.importedMetadata.image === "string" ? item.importedMetadata.image : "";
  return image?.fileUrl || fromMeta || null;
}

export function listCoverImages(list: Pick<PetalList, "coverStyle" | "coverImage" | "items">, max = 3) {
  const images: string[] = [];
  if (list.coverStyle === "image" && list.coverImage) images.push(list.coverImage);
  for (const item of list.items || []) {
    const src = itemVisual(item);
    if (src && !images.includes(src)) images.push(src);
    if (images.length >= max) break;
  }
  return images;
}

export function monthKey(item: ListItem) {
  if (item.targetDate) return item.targetDate.slice(0, 7);
  if (item.targetMonth) return item.targetMonth.slice(0, 7);
  return null;
}

export function tagsUsedOnItems<T extends { id: string }>(
  tags: T[],
  items: { tags: { id: string }[] }[],
  keepId?: string,
) {
  const ids = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) ids.add(tag.id);
  }
  if (keepId) ids.add(keepId);
  return tags.filter((tag) => ids.has(tag.id));
}

export function normalizeSeason(name: string) {
  const value = name.trim().toLowerCase();
  return value === "autumn" ? "fall" : value;
}

export function seasonLabel(name: string) {
  const key = normalizeSeason(name);
  return key === "fall" ? "Autumn" : key ? key[0].toUpperCase() + key.slice(1) : "";
}
