export type Section = "shop" | "bucket" | "todo";

export function isShopType(type: string) {
  return type === "wish" || type === "shopping";
}

export function isTodoType(type: string) {
  return type === "todo";
}

/** Bucket-section lists (excludes Wish and To-do). */
export function isBucketType(type: string) {
  return type === "bucket" || type === "custom";
}

export function sectionForType(type: string): Section {
  if (isShopType(type)) return "shop";
  if (isTodoType(type)) return "todo";
  return "bucket";
}

export function parseSection(value: string | null | undefined): Section {
  if (value === "bucket" || value === "todo") return value;
  return "shop";
}

export function sectionHref(section: Section, extra?: Record<string, string>) {
  const params = new URLSearchParams({ section, ...extra });
  return `/?${params.toString()}`;
}

export function sectionLabel(section: Section) {
  return (
    {
      shop: "Wish",
      bucket: "Bucket",
      todo: "To-do",
    } as const
  )[section];
}
