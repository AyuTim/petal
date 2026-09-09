"use client";

import { ACCENT, PASTELS, brightenPastel, readableInk } from "@/lib/palette";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import { ListSkeleton, Shell } from "@/components/shell";
import type { Tag } from "@/lib/types";
import { Tag as TagIcon, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

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

function PrefToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {desc}
        </p>
      </div>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-slate-200/90 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-[var(--chrome)] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-300/80"
      />
    </label>
  );
}

export default function SettingsPage() {
  const { data, patchSettings, refresh, setToast } = useApp();
  const settings = data?.settings;
  const tags = data?.tags ?? [];
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(() => PASTELS[0].hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hiddenTagIds, setHiddenTagIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const colorPickers = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingDeletes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = pendingDeletes.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  if (!settings) {
    return (
      <Shell>
        <ListSkeleton />
      </Shell>
    );
  }

  const visibleTags = tags.filter((tag) => !hiddenTagIds.includes(tag.id));
  const workspaceAccent = brightenPastel(settings.accentColor || ACCENT.hex);
  const workspaceAccentIsCustom = !PASTELS.some((p) => p.hex.toLowerCase() === workspaceAccent.toLowerCase());

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
      action: {
        label: "Undo",
        onClick: () => undoDelete(tag),
      },
    });

    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(tag.id);
      void api(`/api/tags?id=${tag.id}`, { method: "DELETE" })
        .then(() => refresh())
        .then(() => {
          setHiddenTagIds((ids) => ids.filter((id) => id !== tag.id));
        })
        .catch(() => {
          setHiddenTagIds((ids) => ids.filter((id) => id !== tag.id));
          setToast({ message: `Couldn’t delete “${tag.name}”.` });
        });
    }, DELETE_UNDO_MS);
    pendingDeletes.current.set(tag.id, timer);
  }

  async function importBackup(file: File) {
    setImportBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      await api("/api/import", { method: "POST", body: JSON.stringify(parsed) });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "That file isn’t a Petals backup. Export JSON from a list and try again.");
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && file.type && file.type !== "application/json") {
      alert("Please drop a JSON backup file.");
      return;
    }
    void importBackup(file);
  }

  return (
    <Shell>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub mb-8 mt-2">
        Tune your workspace here. Your account and private profile live in the Profile section.
      </p>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="card p-5 md:p-6">
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              Preferences
            </h2>
            <div className="mt-1 divide-y divide-slate-200/60">
              <PrefToggle
                label="Dark mode"
                desc="Soft charcoal surfaces and lighter ink"
                checked={settings.theme === "dark"}
                onChange={(on) => void patchSettings({ theme: on ? "dark" : "light" })}
              />
              <PrefToggle
                label="Larger text"
                desc="Bump type size across lists and boards"
                checked={settings.largerText}
                onChange={(on) => void patchSettings({ largerText: on })}
              />
              <PrefToggle
                label="High-contrast"
                desc="Stronger borders and clearer muted text"
                checked={settings.highContrast}
                onChange={(on) => void patchSettings({ highContrast: on })}
              />
              <PrefToggle
                label="Reduce motion"
                desc="Dial back blooms, pulses, and transitions"
                checked={settings.reducedMotion}
                onChange={(on) => void patchSettings({ reducedMotion: on })}
              />
              <PrefToggle
                label="Celebrate milestones"
                desc="Little confetti when you finish a stretch"
                checked={settings.milestonesEnabled}
                onChange={(on) => void patchSettings({ milestonesEnabled: on })}
              />
            </div>
            <label className="mt-2 block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Default typography
              <select
                className="mt-1.5 block w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-slate-100"
                value={settings.defaultFont}
                onChange={(e) => void patchSettings({ defaultFont: e.target.value as "sans" | "serif" | "script" })}
              >
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="script">Serif accent</option>
              </select>
            </label>

            <div className="mt-5 border-t border-slate-200/60 pt-4">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Workspace accent
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Colors the selected list in the sidebar and other app chrome.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {PASTELS.map((p) => {
                  const selected = workspaceAccent.toLowerCase() === p.hex.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={p.name}
                      aria-label={p.name}
                      aria-pressed={selected}
                      onClick={() => void patchSettings({ accentColor: p.hex })}
                      className="group flex cursor-pointer flex-col items-center gap-1.5"
                    >
                      <div
                        className={`h-8 w-8 rounded-full border border-black/5 shadow-2xs transition-all group-hover:shadow-xs ring-offset-2 ${
                          selected
                            ? "scale-110 ring-2 ring-slate-900 ring-offset-2"
                            : "group-hover:scale-110 hover:ring-2 hover:ring-slate-300"
                        }`}
                        style={{ backgroundColor: p.hex }}
                      />
                      <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600">{p.name}</span>
                    </button>
                  );
                })}
                <label title="Custom color" className="group flex cursor-pointer flex-col items-center gap-1.5">
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border transition-all ${
                      workspaceAccentIsCustom
                        ? "scale-110 border-transparent ring-2 ring-slate-900 ring-offset-2"
                        : "border-dashed border-slate-300 bg-white/90 group-hover:border-slate-500"
                    }`}
                    style={workspaceAccentIsCustom ? { backgroundColor: workspaceAccent } : undefined}
                  >
                    {!workspaceAccentIsCustom ? (
                      <span className="text-sm font-medium text-slate-400" aria-hidden>
                        +
                      </span>
                    ) : null}
                    <input
                      type="color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={/^#[0-9a-fA-F]{6}$/.test(workspaceAccent) ? workspaceAccent : ACCENT.hex}
                      onChange={(e) => void patchSettings({ accentColor: e.target.value })}
                      aria-label="Custom workspace accent"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-600">Custom</span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-xs">
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              Import a backup
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              JSON backups include list details, items, mood-board arrangement, and attachment metadata. Uploaded files
              stay as links unless they still exist on this device. External product URLs stay as links.
            </p>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onClick={() => fileRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragging(false);
              }}
              onDrop={onDrop}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                dragging
                  ? "border-slate-400 bg-white/70"
                  : "border-slate-200/80 bg-slate-50/40 hover:border-slate-300 hover:bg-white/50"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {importBusy ? "Importing…" : dragging ? "Drop to import" : "Drop a JSON backup here"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  or click to choose a file
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackup(file);
                }}
              />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card p-5 md:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  Tags & Colors
                </h2>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  Click a tag to edit or re-color
                </span>
              </div>

              <div
                className="flex flex-wrap gap-2.5 rounded-2xl border p-4"
                style={{
                  background: "color-mix(in srgb, var(--recessed) 70%, transparent)",
                  borderColor: "var(--line)",
                }}
              >
                {visibleTags.map((tag) => {
                  const fill = brightenPastel(tag.color);
                  const ink = readableInk(tag.color);
                  const editing = editingId === tag.id;
                  return (
                    <div
                      key={tag.id}
                      className="group inline-flex items-center gap-2 rounded-xl border py-1.5 pr-1.5 pl-3 text-xs font-medium shadow-xs transition-all hover:shadow-sm"
                      style={{
                        backgroundColor: hexWithAlpha(fill, "15"),
                        borderColor: hexWithAlpha(fill, "40"),
                        color: ink,
                      }}
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
                        ref={(el) => {
                          colorPickers.current[tag.id] = el;
                        }}
                        type="color"
                        className="sr-only"
                        value={/^#[0-9a-fA-F]{6}$/.test(fill) ? fill : "#FFD6E0"}
                        onChange={(e) =>
                          void api("/api/tags", {
                            method: "PATCH",
                            body: JSON.stringify({ id: tag.id, color: e.target.value }),
                          }).then(() => refresh())
                        }
                      />
                      {editing ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => void commitRename(tag.id, tag.name)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          className="min-w-[4.5rem] max-w-[9rem] rounded-md border border-slate-200/80 bg-white/90 px-1.5 py-0.5 text-xs outline-none focus:border-slate-400"
                          style={{ color: ink }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            setEditingId(tag.id);
                            setDraftName(tag.name);
                          }}
                        >
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
                {visibleTags.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    No tags yet — add one below.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <TagIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Create a new tag..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addTag();
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-10 pl-8 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 cursor-pointer rounded-full border border-black/10 shadow-xs transition-transform hover:scale-110"
                    style={{ backgroundColor: brightenPastel(color) }}
                    title="New tag color"
                    aria-label="New tag color"
                    onClick={() => colorPickers.current["__new"]?.click()}
                  />
                  <input
                    ref={(el) => {
                      colorPickers.current["__new"] = el;
                    }}
                    type="color"
                    className="sr-only"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : ACCENT.hex}
                    onChange={(e) => setColor(e.target.value)}
                    title="New tag color"
                    aria-label="Pick new tag color"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold !text-white shadow-xs transition-all hover:bg-slate-800 active:scale-95"
                  onClick={() => void addTag()}
                >
                  Add Tag
                </button>
              </div>

              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Starter tags include nearby, at home, rainy day, free, outdoors, weekend, and seasons. Apply them on an
                item, then filter a list by tag.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
