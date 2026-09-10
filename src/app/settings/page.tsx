"use client";

import { ACCENT, PASTELS, brightenPastel } from "@/lib/palette";
import { api } from "@/lib/api";
import { useApp } from "@/components/providers";
import { ListSkeleton, Shell } from "@/components/shell";
import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

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
  const { data, patchSettings, refresh } = useApp();
  const settings = data?.settings;
  const [importBusy, setImportBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings) {
    return (
      <Shell>
        <ListSkeleton />
      </Shell>
    );
  }

  const workspaceAccent = brightenPastel(settings.accentColor || ACCENT.hex);
  const workspaceAccentIsCustom = !PASTELS.some((p) => p.hex.toLowerCase() === workspaceAccent.toLowerCase());

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

      <div className="max-w-2xl">
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

      </div>
    </Shell>
  );
}
