import { GENERAL_DESCRIPTION, LEGACY_GENERAL_DESCRIPTION } from "./lists";
import { DAY_TAGS, SEASON_TAGS } from "./palette";
import {
  addAttachment,
  createItem,
  createList,
  createTag,
  deleteList,
  getList,
  listSummaries,
  listTags,
  updateList,
} from "./db";

/** Adds the demo Fall bucket list when this owner does not already have one titled "Fall". */
export function ensureFallDemo(ownerId: string) {
  const fall = listSummaries(ownerId).find((list) => list.title === "Fall");
  if (!fall) {
    seedFallList(ownerId);
    return;
  }
  if (["#9aabc0", "#e0b09a"].includes(fall.color.toLowerCase())) {
    updateList(fall.id, { color: "#FFD4C2" });
  }
}

export function ensureSeasonTags(ownerId: string) {
  const existing = new Set(listTags(ownerId).map((tag) => tag.name.toLowerCase()));
  for (const tag of SEASON_TAGS) {
    if (!existing.has(tag.name)) createTag(ownerId, tag.name, tag.color);
  }
}

export function ensureDayTags(ownerId: string) {
  const existing = new Set(listTags(ownerId).map((tag) => tag.name.toLowerCase()));
  for (const tag of DAY_TAGS) {
    if (!existing.has(tag.name.toLowerCase())) createTag(ownerId, tag.name, tag.color);
  }
}

export function ensureSeasonalLists(ownerId: string) {
  ensureFallDemo(ownerId);
  pruneEmptySeedSeasons(ownerId);
  const general = ensureNamedBucket(ownerId, "General", {
    color: "#FFD6E0",
    description: GENERAL_DESCRIPTION,
    isPinned: true,
  });
  const description = general?.description?.trim() ?? "";
  if (general && (description === "" || description === LEGACY_GENERAL_DESCRIPTION)) {
    updateList(general.id, { description: GENERAL_DESCRIPTION });
  }
  ensureWeeklyTodo(ownerId);
}

/** Ensures a pinned Weekly to-do list exists for day-tagged planning. */
export function ensureWeeklyTodo(ownerId: string) {
  ensureDayTags(ownerId);
  const existing = listSummaries(ownerId).find(
    (list) => list.type === "todo" && list.title.trim().toLowerCase() === "weekly",
  );
  if (existing) return existing;

  const tagsByName = new Map(listTags(ownerId).map((tag) => [tag.name.toLowerCase(), tag]));
  const day = (name: string) => {
    const tag = tagsByName.get(name.toLowerCase());
    return tag ? [tag] : [];
  };

  const weekly = createList(ownerId, {
    title: "Weekly",
    emoji: "",
    type: "todo",
    color: "#D4E8FF",
    coverStyle: "solid",
    isPinned: true,
    description: "Plans for the week — tag items by day.",
  })!;

  createItem(weekly.id, { title: "Plan the week", tags: day("Sun") });
  createItem(weekly.id, { title: "Groceries or errands", tags: day("Wed") });
  createItem(weekly.id, { title: "Something soft for Friday", tags: day("Fri") });
  return weekly;
}

/** One-time cleanup: drop empty Winter/Spring buckets left from an earlier seed. */
function pruneEmptySeedSeasons(ownerId: string) {
  for (const title of ["Winter", "Spring"]) {
    const list = listSummaries(ownerId).find((entry) => entry.title.toLowerCase() === title.toLowerCase());
    if (!list) continue;
    const items = getList(list.id)?.items ?? [];
    if (items.length === 0) deleteList(list.id);
  }
}

function ensureNamedBucket(
  ownerId: string,
  title: string,
  extra: { color: string; description: string; isPinned?: boolean },
) {
  const existing = listSummaries(ownerId).find((list) => list.title.toLowerCase() === title.toLowerCase());
  if (existing) return existing;
  return createList(ownerId, {
    title,
    type: "bucket",
    coverStyle: "solid",
    emoji: "",
    ...extra,
  });
}

function seedFallList(ownerId: string) {
  const fall = createList(ownerId, {
    title: "Fall",
    emoji: "🍁",
    type: "bucket",
    color: "#FFD4C2",
    coverStyle: "gradient",
    isPinned: true,
    description: "A short list for the season.",
  })!;

  const pumpkin = createItem(fall.id, {
    title: "pumpkin patch",
    emoji: "🎃",
    targetMonth: "2026-10",
    season: "Autumn",
  })!;
  addAttachment(pumpkin.id, {
    type: "image",
    fileUrl: "https://images.unsplash.com/photo-1572204292164-b35ba943c4cb?auto=format&fit=crop&w=900&q=80",
    filename: "Pumpkin patch",
    altText: "Rows of pumpkins in a fall field.",
  });
  createItem(fall.id, { title: "spooky movies", emoji: "🎬", targetMonth: "2026-10", season: "Autumn" });
  createItem(fall.id, { title: "spooky pizza", emoji: "🍕", targetMonth: "2026-10", season: "Autumn" });
  createItem(fall.id, { title: "fall baking - cookies", emoji: "🍪", targetMonth: "2026-11", season: "Autumn" });
}

/** A small, inviting first-run collection. It only runs for a new device owner. */
export function seedOwner(ownerId: string) {
  seedFallList(ownerId);
  ensureSeasonalLists(ownerId);

  const home = createList(ownerId, {
    title: "Home things I love",
    emoji: "🏡",
    type: "wish",
    color: "#E4D4FF",
    coverStyle: "pattern",
    budgetTarget: 650,
    currency: "USD",
    description: "Pieces for home.",
  })!;
  const lamp = createItem(home.id, {
    title: "Mushroom table lamp",
    emoji: "🍄",
    price: 148,
    currency: "USD",
    store: "Museum of Modern Art",
    productUrl: "https://store.moma.org/",
    notes: "For the reading corner.",
    privateNotes: "I love the soft glow and slightly whimsical shape.",
    priority: "high",
  })!;
  addAttachment(lamp.id, { type: "image", fileUrl: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=80", filename: "Warm table lamp", altText: "A warm lamp on a bedside table." });
  const vase = createItem(home.id, { title: "Hand-thrown bud vase", emoji: "🏺", price: 36, currency: "USD", store: "Local ceramic studio", productUrl: "https://www.etsy.com/", purchased: true, completed: true, completedAt: new Date("2026-09-02T12:00:00.000Z").toISOString() })!;
  addAttachment(vase.id, { type: "image", fileUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80", filename: "Ceramic vase", altText: "A handmade ceramic vase with dried flowers." });
  createItem(home.id, { title: "Linen tablecloth in soft blue", emoji: "🫐", price: 72, currency: "USD", store: "The Citizenry", productUrl: "https://www.the-citizenry.com/" });

  const weekend = createList(ownerId, {
    title: "Weekend grocery notes",
    emoji: "🧺",
    type: "shopping",
    color: "#C8F0D8",
    coverStyle: "solid",
    budgetTarget: 85,
    currency: "USD",
    description: "Groceries and essentials.",
  })!;
  createItem(weekend.id, { title: "Pink ranunculus", emoji: "🌸", price: 14, currency: "USD", store: "Corner florist", purchased: true, completed: true, completedAt: new Date("2026-09-05T09:00:00.000Z").toISOString() });
  createItem(weekend.id, { title: "Sourdough and salted butter", emoji: "🥖", price: 11, currency: "USD", store: "Sundays Bakery" });
  createItem(weekend.id, { title: "Sparkling water with lime", emoji: "🍋", price: 8, currency: "USD", store: "Market" });
}
