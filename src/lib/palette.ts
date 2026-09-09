export const ACCENT = { id: "pink", name: "Blush", hex: "#FFD6E0", ink: "#6B3A4A" } as const;

export const PASTELS = [
  { id: "pink", name: "Blush", hex: "#FFD6E0", ink: "#6B3A4A" },
  { id: "lavender", name: "Lavender", hex: "#E4D4FF", ink: "#4A3A6B" },
  { id: "mint", name: "Sage", hex: "#C8F0D8", ink: "#24543A" },
  { id: "yellow", name: "Butter", hex: "#FFE9A8", ink: "#5C4E28" },
  { id: "peach", name: "Peach", hex: "#FFD4C2", ink: "#6B4332" },
  { id: "pale-blue", name: "Ice", hex: "#D4E8FF", ink: "#33455C" },
  { id: "cream", name: "Cream", hex: "#FFF3D6", ink: "#5A4A3A" },
  { id: "rose", name: "Rose", hex: "#F8C4D4", ink: "#6B3A4A" },
  { id: "lilac", name: "Lilac", hex: "#DCC8FF", ink: "#4A3A6B" },
  { id: "seafoam", name: "Seafoam", hex: "#C4F0E8", ink: "#2F4A46" },
] as const;

const LEGACY_PASTELS: Record<string, string> = {
  "#f4c7d4": "#FFD6E0",
  "#d9c7f0": "#E4D4FF",
  "#c9d9c2": "#C8F0D8",
  "#c9ddf2": "#D4E8FF",
  "#f4e4b3": "#FFE9A8",
  "#f6c9b0": "#FFD4C2",
  "#f4e9d8": "#FFF3D6",
  "#e2b3b8": "#F8C4D4",
  "#e0b09a": "#FFD4C2",
  "#b7d6d1": "#C4F0E8",
  "#9aabc0": "#D4E8FF",
};

const DEEP_ACCENTS: Record<string, string> = {
  "#ffd6e0": "#831843",
  "#f8c4d4": "#9f1239",
  "#e4d4ff": "#581c87",
  "#dcc8ff": "#4c1d95",
  "#c8f0d8": "#065f46",
  "#c4f0e8": "#115e59",
  "#ffe9a8": "#854d0e",
  "#ffd4c2": "#9a3412",
  "#fff3d6": "#713f12",
  "#d4e8ff": "#0c4a6e",
};

/** Maps leftover dusty hexes to the brighter pastel set for display. */
export function brightenPastel(hex: string) {
  return LEGACY_PASTELS[hex.toLowerCase()] ?? hex;
}

/** A high-contrast, hue-preserving companion for text, vines, and active controls. */
export function deepAccent(hex: string) {
  const normalized = brightenPastel(hex).toLowerCase();
  return DEEP_ACCENTS[normalized] ?? `color-mix(in srgb, ${hex} 45%, #180d05 55%)`;
}

export const SEASON_TAGS = [
  { name: "fall", color: "#FFD4C2" },
  { name: "winter", color: "#D4E8FF" },
  { name: "spring", color: "#C8F0D8" },
  { name: "summer", color: "#FFE9A8" },
] as const;

/** Sunday–Saturday day tags for weekly to-do planning. */
export const DAY_TAGS = [
  { name: "Sun", color: "#FFE9A8" },
  { name: "Mon", color: "#D4E8FF" },
  { name: "Tue", color: "#C8F0D8" },
  { name: "Wed", color: "#E4D4FF" },
  { name: "Thu", color: "#FFD4C2" },
  { name: "Fri", color: "#FFD6E0" },
  { name: "Sat", color: "#C4F0E8" },
] as const;

/** Display order for weekly day tabs (Western planning week). */
export const WEEK_DAY_TAB_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const STARTER_TAGS = [
  { name: "nearby", color: "#D4E8FF" },
  { name: "at home", color: "#C8F0D8" },
  { name: "rainy day", color: "#E4D4FF" },
  { name: "free", color: "#FFE9A8" },
  { name: "outdoors", color: "#C4F0E8" },
  { name: "with friends", color: "#FFD6E0" },
  { name: "solo", color: "#FFD4C2" },
  { name: "weekend", color: "#F8C4D4" },
  { name: "seasonal", color: "#FFD4C2" },
  ...SEASON_TAGS,
  ...DAY_TAGS,
];

export const TEMPLATES = [
  {
    id: "seasonal",
    title: "Seasonal bucket",
    emoji: "🍂",
    type: "bucket" as const,
    color: "#FFD4C2",
    description: "Plans for this season.",
  },
  {
    id: "travel",
    title: "Travel daydreams",
    emoji: "✈️",
    type: "bucket" as const,
    color: "#D4E8FF",
    description: "Places, meals, and trips.",
  },
  {
    id: "birthday",
    title: "Birthday wishes",
    emoji: "🎂",
    type: "wish" as const,
    color: "#FFD6E0",
    description: "Gifts and treats.",
  },
  {
    id: "shopping",
    title: "Shopping",
    emoji: "🧺",
    type: "shopping" as const,
    color: "#C8F0D8",
    description: "Things to pick up.",
  },
  {
    id: "home",
    title: "Home & nest",
    emoji: "🏡",
    type: "wish" as const,
    color: "#FFF3D6",
    description: "Things for home.",
  },
  {
    id: "watch",
    title: "Reading & watching",
    emoji: "📚",
    type: "custom" as const,
    color: "#E4D4FF",
    description: "Books, films, and shows.",
  },
  {
    id: "weekly",
    title: "Weekly",
    emoji: "",
    type: "todo" as const,
    color: "#D4E8FF",
    description: "Plans for the week — tag items by day.",
  },
];

export function colorMeta(hex: string) {
  const next = brightenPastel(hex);
  return PASTELS.find((c) => c.hex.toLowerCase() === next.toLowerCase()) ?? PASTELS[0];
}

export function readableInk(hex: string) {
  return colorMeta(hex).ink;
}

function hexRgb(hex: string) {
  const raw = brightenPastel(hex).replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return { r: 148, g: 163, b: 184 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function accentVars(hex: string): {
  "--list-accent": string;
  "--list-accent-color": string;
  "--list-accent-dark": string;
  "--list-accent-soft": string;
  "--list-accent-glow": string;
  "--list-accent-shadow": string;
} {
  const next = brightenPastel(hex);
  const { r, g, b } = hexRgb(next);
  return {
    "--list-accent": next,
    "--list-accent-color": next,
    "--list-accent-dark": deepAccent(next),
    "--list-accent-soft": `color-mix(in srgb, ${next} 36%, #ffffff)`,
    "--list-accent-glow": `rgba(${r}, ${g}, ${b}, 0.25)`,
    "--list-accent-shadow": `rgba(${r}, ${g}, ${b}, 0.22)`,
  };
}

/** Global workspace chrome accent (sidebar selection, section highlights). */
export function appAccentVars(hex: string): {
  "--app-accent": string;
  "--app-accent-color": string;
  "--app-accent-ink": string;
  "--app-accent-deep": string;
  "--app-accent-soft": string;
  "--app-accent-muted": string;
  "--app-accent-glow": string;
  "--app-accent-shadow": string;
  "--app-accent-border": string;
  "--app-accent-pill": string;
} {
  const next = brightenPastel(hex);
  const { r, g, b } = hexRgb(next);
  const ink = readableInk(next);
  return {
    "--app-accent": next,
    "--app-accent-color": next,
    "--app-accent-ink": ink,
    "--app-accent-deep": deepAccent(next),
    /* Soft wash for hovers — still readable on white chrome */
    "--app-accent-soft": `color-mix(in srgb, ${next} 48%, #ffffff)`,
    "--app-accent-muted": `color-mix(in srgb, ${ink} 62%, transparent)`,
    "--app-accent-glow": `rgba(${r}, ${g}, ${b}, 0.28)`,
    "--app-accent-shadow": `rgba(${r}, ${g}, ${b}, 0.32)`,
    /* Edge definition so pale pastels don’t dissolve into the sidebar */
    "--app-accent-border": `color-mix(in srgb, ${ink} 18%, ${next} 62%)`,
    /* Pastels are already soft — keep most of the hue, only a light white lift */
    "--app-accent-pill": `color-mix(in srgb, ${next} 78%, #ffffff)`,
  };
}
