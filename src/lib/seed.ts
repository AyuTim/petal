import { createItem, createList, listSummaries } from "./db";

/** Creates the one gentle starter list every new Petals profile receives. */
export function seedOwner(ownerId: string) {
  if (listSummaries(ownerId).length > 0) return;

  const starter = createList(ownerId, {
    title: "Start here",
    emoji: "🌸",
    type: "todo",
    color: "#FFD6E0",
    coverStyle: "gradient",
    isPinned: true,
    description: "A small guide to making Petals feel like yours.",
  });
  if (!starter) return;

  const steps = [
    {
      title: "Make this list yours",
      emoji: "✏️",
      notes: "Rename this list, choose a color, or change its cover from the list menu.",
    },
    {
      title: "Add your first idea",
      emoji: "✦",
      notes: "Use the field above—or press /—to add something you want to remember, do, or find.",
    },
    {
      title: "Give an item a date",
      emoji: "⌁",
      notes: "Dated items automatically appear in both Timeline and Calendar.",
    },
    {
      title: "Explore the views",
      emoji: "♡",
      notes: "Mood collects visual ideas, Timeline shows what is ahead, and Memories holds moments you capture.",
    },
  ];

  steps.forEach((step, position) => {
    createItem(starter.id, { ...step, position });
  });
}
