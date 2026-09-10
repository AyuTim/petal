"use client";

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
        Tune how Petals feels. Your personal organization tools live in Profile.
      </p>

      <div className="settings-layout mx-auto grid w-full max-w-4xl items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
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
    </Shell>
  );
}
