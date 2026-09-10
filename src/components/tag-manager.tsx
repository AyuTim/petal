"use client";

import { useEffect, useRef, useState } from "react";
import { Tag as TagIcon, X } from "lucide-react";
import { ACCENT, PASTELS, brightenPastel, readableInk } from "@/lib/palette";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import type { Tag } from "@/lib/types";

const DELETE_UNDO_MS = 4000;

function hexWithAlpha(hex: string, alphaHex: string) {
  const raw = brightenPastel(hex).replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) {
    const pct = Math.round((Number.parseInt(alphaHex, 16) / 255) * 100);
    return `color-mix(in srgb, ${brightenPastel(hex)} ${pct}%, transparent)`;
  }
  return `#${full}${alphaHex}`;
}

/** Personal tags belong with the owner profile instead of global preferences. */
export function TagManager() {
  const { data, refresh, setToast } = useApp();
  const tags = data?.tags ?? [];
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(() => PASTELS[0].hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [hiddenTagIds, setHiddenTagIds] = useState<string[]>([]);
  const colorPickers = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingDeletes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = pendingDeletes.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const visibleTags = tags.filter((tag) => !hiddenTagIds.includes(tag.id));

  async function commitRename(tagId: string, currentName: string) {
    const next = draftName.trim();
    setEditingId(null);
    if (!next || next === currentName) return;
    await api("/api/tags", { method: "PATCH", body: JSON.stringify({ id: tagId, name: next }) });
    await refresh();
  }

  async function addTag() {
    if (!name.trim()) return;
    await api("/api/tags", { method: "POST", body: JSON.stringify({ name: name.trim(), color }) });
    setName("");
    setColor(PASTELS[(tags.length + 1) % PASTELS.length].hex);
    await refresh();
  }

  function undoDelete(tag: Tag) {
    const timer = pendingDeletes.current.get(tag.id);
    if (timer != null) {
      window.clearTimeout(timer);
      pendingDeletes.current.delete(tag.id);
    }
    setHiddenTagIds((ids) => ids.filter((id) => id !== tag.id));
    setToast(null);
  }

  function requestDelete(tag: Tag) {
    const existing = pendingDeletes.current.get(tag.id);
    if (existing != null) window.clearTimeout(existing);
    setHiddenTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
    if (editingId === tag.id) setEditingId(null);
    setToast({
      message: `Deleted “${tag.name}”`,
      duration: DELETE_UNDO_MS,
      action: { label: "Undo", onClick: () => undoDelete(tag) },
    });
    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(tag.id);
      void api(`/api/tags?id=${tag.id}`, { method: "DELETE" })
        .then(() => refresh())
        .then(() => setHiddenTagIds((ids) => ids.filter((id) => id !== tag.id)))
        .catch(() => {
          setHiddenTagIds((ids) => ids.filter((id) => id !== tag.id));
          setToast({ message: `Couldn’t delete “${tag.name}”.` });
        });
    }, DELETE_UNDO_MS);
    pendingDeletes.current.set(tag.id, timer);
  }

  return (
    <section className="profile-tags-card">
      <div className="profile-tags-heading">
        <div>
          <p className="profile-eyebrow">Personal organization</p>
          <h2>Tags & colors</h2>
        </div>
        <span>Rename, recolor, or remove tags.</span>
      </div>

      <div className="profile-tags-list">
        {visibleTags.map((tag) => {
          const fill = brightenPastel(tag.color);
          const ink = readableInk(tag.color);
          const editing = editingId === tag.id;
          return (
            <div
              key={tag.id}
              className="group inline-flex items-center gap-2 rounded-xl border py-1.5 pr-1.5 pl-3 text-xs font-medium shadow-xs transition-all hover:shadow-sm"
              style={{ backgroundColor: hexWithAlpha(fill, "15"), borderColor: hexWithAlpha(fill, "40"), color: ink }}
            >
              <button
                type="button"
                className="relative h-2.5 w-2.5 shrink-0 cursor-pointer rounded-full shadow-xs ring-2 ring-white"
                style={{ backgroundColor: fill }}
                title="Change color"
                aria-label={`Recolor ${tag.name}`}
                onClick={() => colorPickers.current[tag.id]?.click()}
              />
              <input
                ref={(el) => { colorPickers.current[tag.id] = el; }}
                type="color"
                className="sr-only"
                value={/^#[0-9a-fA-F]{6}$/.test(fill) ? fill : "#FFD6E0"}
                onChange={(event) => void api("/api/tags", { method: "PATCH", body: JSON.stringify({ id: tag.id, color: event.target.value }) }).then(() => refresh())}
              />
              {editing ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => void commitRename(tag.id, tag.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); (event.target as HTMLInputElement).blur(); }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-[4.5rem] max-w-[9rem] rounded-md border border-slate-200/80 bg-white/90 px-1.5 py-0.5 text-xs outline-none focus:border-slate-400"
                  style={{ color: ink }}
                />
              ) : (
                <button type="button" className="text-left" onClick={() => { setEditingId(tag.id); setDraftName(tag.name); }}>
                  {tag.name}
                </button>
              )}
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title="Remove tag"
                aria-label={`Delete ${tag.name}`}
                onClick={() => requestDelete(tag)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {visibleTags.length === 0 ? <p className="text-xs" style={{ color: "var(--muted)" }}>No tags yet — add one below.</p> : null}
      </div>

      <div className="profile-tag-create">
        <div className="relative min-w-0 flex-1">
          <TagIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Create a new tag..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTag(); } }}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-10 pl-8 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <button
            type="button"
            className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 cursor-pointer rounded-full border border-black/10 shadow-xs transition-transform hover:scale-110"
            style={{ backgroundColor: brightenPastel(color) }}
            title="New tag color"
            aria-label="New tag color"
            onClick={() => colorPickers.current.__new?.click()}
          />
          <input
            ref={(el) => { colorPickers.current.__new = el; }}
            type="color"
            className="sr-only"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : ACCENT.hex}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Pick new tag color"
          />
        </div>
        <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold !text-white shadow-xs transition-all hover:bg-slate-800 active:scale-95" onClick={() => void addTag()}>
          Add tag
        </button>
      </div>
      <p className="profile-tags-note">Tags are personal to your workspace. Apply them to any item, then filter a list by tag.</p>
    </section>
  );
}
