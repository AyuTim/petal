"use client";

import { useState } from "react";
import { ImagePlus, Link2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { looksLikeImageUrl } from "@/lib/media";
import type { QuickCapture } from "@/lib/types";
import { FileDropInput } from "./file-drop-input";
import { useApp } from "./providers";

export function QuickCaptureDock({
  captures,
  onChange,
}: {
  captures: QuickCapture[];
  onChange: (captures: QuickCapture[]) => void;
}) {
  const { refresh } = useApp();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function close() {
    if (busy) return;
    setContent("");
    setLink("");
    setFile(null);
    setOpen(false);
  }

  async function save() {
    const note = content.trim();
    const linkUrl = link.trim();
    if (!note && !linkUrl && !file) return;
    setBusy(true);
    try {
      let attachmentUrl: string | null = null;
      let type: QuickCapture["type"] = !note && /^https?:\/\//i.test(linkUrl) ? "link" : "text";
      let importedMetadata: Record<string, unknown> | null = linkUrl ? { link: linkUrl } : null;

      if (file) {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await api<{ url: string }>("/api/upload", { method: "POST", body: form });
        attachmentUrl = uploaded.url;
        type = file.type.startsWith("image/") ? "photo" : "file";
      }

      if (linkUrl && /^https?:\/\//i.test(linkUrl)) {
        if (looksLikeImageUrl(linkUrl)) {
          // Image links become the photo; the note stays the name when filing.
          if (!attachmentUrl) attachmentUrl = linkUrl;
          importedMetadata = { ...(importedMetadata || {}), link: linkUrl, image: linkUrl, isImage: true };
          if (!file) type = "photo";
        } else {
          const meta = await api<{ metadata: Record<string, unknown> }>("/api/metadata", {
            method: "POST",
            body: JSON.stringify({ url: linkUrl }),
          });
          importedMetadata = { ...meta.metadata, link: linkUrl };
          if (meta.metadata.isImage === true && typeof meta.metadata.image === "string" && !attachmentUrl) {
            attachmentUrl = String(meta.metadata.image);
            type = note ? "text" : "photo";
          }
        }
      }

      const result = await api<{ capture: QuickCapture }>("/api/captures", {
        method: "POST",
        body: JSON.stringify({ type, content: note || linkUrl || file?.name, attachmentUrl, importedMetadata }),
      });
      onChange([result.capture, ...captures]);
      close();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="capture-fab dewdrop-control fixed bottom-8 right-8 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-1 active:scale-95"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 shrink-0 text-white" strokeWidth={2} aria-hidden />
        <span className="text-white">Capture</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/15 p-4 transition-opacity" onClick={close}>
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-slate-900">
                  Save to Catch <span className="text-base" aria-hidden>🌸</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">Lands here until you file it into a list.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close capture"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              autoFocus
              placeholder="A note, a link, or a wish..."
              className="w-full resize-none rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />

            <div className="relative flex items-center">
              <Link2 className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="Paste a link (optional)..."
                className="w-full rounded-xl border border-slate-200/70 bg-slate-50/70 py-2 pl-8 pr-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-0"
              />
            </div>

            <FileDropInput
              accept="image/*,.pdf,.txt,.doc,.docx"
              ariaLabel="Add a photo or attachment"
              className="group flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
              onFile={setFile}
            >
              <ImagePlus className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-600" />
              <span className="text-xs font-medium text-slate-500 transition-colors group-hover:text-slate-700">
                {file ? file.name : "Add photo or attachment"}
              </span>
            </FileDropInput>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={close}
                className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (!content.trim() && !link.trim() && !file)}
                onClick={() => void save()}
                className="rounded-2xl bg-rose-950 px-5 py-2 text-xs font-semibold !text-rose-50 shadow-xs transition-all hover:bg-rose-900 hover:!text-rose-50 active:scale-95 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:!text-rose-300 disabled:shadow-none disabled:hover:bg-rose-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
