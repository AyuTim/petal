"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Link2, Pencil, Sprout, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PetalMark } from "@/components/petal-mark";
import { useApp } from "@/components/providers";
import { Shell } from "@/components/shell";
import { api, type ListSummary } from "@/lib/api";
import type { ListType, PetalList, QuickCapture, Tag } from "@/lib/types";

const CREATE_LIST_VALUE = "__create__";

const CATCH_LIST_TYPES: { id: ListType; label: string }[] = [
  { id: "todo", label: "To-do" },
  { id: "wish", label: "Wish" },
  { id: "shopping", label: "Budget" },
];

type FiledCapture = { item: { id: string } | null };

export default function InboxPage() {
  const { data, refresh, pulseSidebarList, setToast } = useApp();
  const captures = data?.captures ?? [];
  const lists = (data?.lists ?? []).filter((list) => !list.archivedAt);
  const [hiddenCaptureIds, setHiddenCaptureIds] = useState<string[]>([]);
  const [filingId, setFilingId] = useState<string | null>(null);
  const visibleCaptures = captures.filter((capture) => !hiddenCaptureIds.includes(capture.id));

  const updateCapture = async (captureId: string, content: string, importedMetadata: Record<string, unknown>) => {
    await api(`/api/captures?id=${captureId}`, {
      method: "PATCH",
      body: JSON.stringify({ content, importedMetadata }),
    });
    await refresh();
  };

  const deleteCapture = async (captureId: string) => {
    setHiddenCaptureIds((current) => [...current, captureId]);
    try {
      await api(`/api/captures?id=${captureId}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      setHiddenCaptureIds((current) => current.filter((id) => id !== captureId));
      setToast({ message: error instanceof Error ? error.message : "That note could not be deleted." });
    }
  };

  const undoFiling = async (capture: QuickCapture, itemId: string) => {
    try {
      await api(`/api/items/${itemId}`, { method: "DELETE" });
      await api("/api/captures", {
        method: "POST",
        body: JSON.stringify({
          type: capture.type,
          content: capture.content,
          attachmentUrl: capture.attachmentUrl,
          importedMetadata: capture.importedMetadata,
        }),
      });
      setHiddenCaptureIds((current) => current.filter((id) => id !== capture.id));
      await refresh();
      setToast({ message: "Returned to Catch." });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "The item could not be returned to Catch." });
    }
  };

  const fileCapture = async (capture: QuickCapture, target: ListSummary) => {
    if (filingId) return;
    setFilingId(capture.id);
    setHiddenCaptureIds((current) => [...current, capture.id]);
    pulseSidebarList(target.id);

    try {
      const result = await api<FiledCapture>(`/api/captures/${capture.id}/move`, {
        method: "POST",
        body: JSON.stringify({ listId: target.id }),
      });
      await refresh();
      setToast({
        message: `Filed to ${target.title} 🌸`,
        duration: 4000,
        kind: "filed",
        action: result.item ? { label: "Undo", onClick: () => void undoFiling(capture, result.item!.id) } : undefined,
      });
    } catch (error) {
      setHiddenCaptureIds((current) => current.filter((id) => id !== capture.id));
      setToast({ message: error instanceof Error ? error.message : "Choose a list to file this note." });
    } finally {
      setFilingId(null);
    }
  };

  return (
    <Shell>
      <section className="catch-page max-w-2xl mx-auto w-full py-8 px-4 space-y-7">
        <header className="catch-header flex items-baseline justify-between border-b border-slate-200/70 pb-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-slate-900">Catch</h1>
            <p className="catch-header-subtext mt-1.5">
              Thoughts and links waiting to be filed into a list.
            </p>
          </div>
          <Link className="whitespace-nowrap text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors" href="/">
            ← Back to lists
          </Link>
        </header>

        {visibleCaptures.length === 0 ? (
          <EmptyCatch />
        ) : (
          <div className="space-y-5">
            <AnimatePresence initial={false} mode="popLayout">
              {visibleCaptures.map((capture) => (
                <CatchCard
                  key={capture.id}
                  capture={capture}
                  lists={lists}
                  tags={data?.tags ?? []}
                  filing={filingId === capture.id}
                  onDelete={() => void deleteCapture(capture.id)}
                  onSave={(content, importedMetadata) => updateCapture(capture.id, content, importedMetadata)}
                  onFile={(list) => void fileCapture(capture, list)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </Shell>
  );
}

function CatchCard({
  capture,
  lists,
  tags,
  filing,
  onDelete,
  onSave,
  onFile,
}: {
  capture: QuickCapture;
  lists: ListSummary[];
  tags: Tag[];
  filing: boolean;
  onDelete: () => void;
  onSave: (content: string, importedMetadata: Record<string, unknown>) => Promise<void>;
  onFile: (list: ListSummary) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(capture.content);
  const [linkUrl, setLinkUrl] = useState(captureLink(capture));
  const [selectedTag, setSelectedTag] = useState(selectedCaptureTag(capture));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(capture.content);
    setLinkUrl(captureLink(capture));
    setSelectedTag(selectedCaptureTag(capture));
    setIsEditing(false);
  }, [capture.id, capture.content]);

  const save = async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const importedMetadata = { ...(capture.importedMetadata ?? {}) };
      const link = linkUrl.trim();
      if (link) importedMetadata.link = link;
      else delete importedMetadata.link;
      if (selectedTag) importedMetadata.tagIds = [selectedTag];
      else delete importedMetadata.tagIds;
      await onSave(content, importedMetadata);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setDraft(capture.content);
    setLinkUrl(captureLink(capture));
    setSelectedTag(selectedCaptureTag(capture));
    setIsEditing(false);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, x: -40, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } }}
      className="catch-card group relative overflow-hidden p-5 rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/70 transition-all duration-200"
    >
      <div className="relative flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-600 text-[10px] font-semibold tracking-wider uppercase border border-slate-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/80" />
          {capture.type === "text" ? "Quick note" : capture.type}
        </span>
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="catch-card-icon"
            title="Edit note"
            aria-label="Edit note"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="catch-card-icon is-delete" title="Delete note" aria-label="Delete note">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="relative space-y-3 mb-1">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            autoFocus
            className="catch-edit-text w-full text-base font-normal text-slate-800 bg-transparent border-0 border-b border-rose-100/90 focus:border-rose-300 focus:ring-2 focus:ring-rose-100/50 resize-none p-1 placeholder:text-rose-900/25 outline-none transition-colors"
            placeholder="Note text..."
          />
          <div className="relative flex items-center">
            <Link2 className="w-3.5 h-3.5 text-rose-900/30 absolute left-2.5 pointer-events-none" />
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Add a link (https://...)"
              className="catch-edit-link w-full text-xs bg-rose-50/40 border border-rose-100/80 rounded-xl pl-8 pr-3 py-2 text-slate-700 outline-none focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100/50 transition-all placeholder:text-rose-900/30"
            />
          </div>

          {tags.length ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-medium text-rose-900/40 mr-0.5">Tag:</span>
              {tags.map((tag) => {
                const isSelected = selectedTag === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? null : tag.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide transition-colors border ${
                      isSelected
                        ? "bg-rose-900 !text-white border-rose-900"
                        : "bg-rose-50/60 border-rose-200/50 text-rose-900/80 hover:bg-rose-100/70"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="catch-edit-footer flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 mt-1 border-t border-rose-100/70">
            <FileToSelect lists={lists} filing={filing} onFile={onFile} compact />
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button type="button" onClick={cancelEdit} className="px-3 py-1 text-xs font-medium text-rose-900/45 hover:text-rose-900/80 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!draft.trim() || saving}
                className="catch-save-btn bg-rose-900 !text-white"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setIsEditing(true)} className="catch-content relative text-left" title="Click to edit">
          {capture.content}
        </button>
      )}

      {!isEditing && captureLink(capture) ? <CaptureLinkPreview href={captureLink(capture)} /> : null}
      {capture.importedMetadata?.title && !isEditing ? (
        <p className="catch-meta-title">{String(capture.importedMetadata.title)}</p>
      ) : null}
      {capture.attachmentUrl ? (
        capture.type === "photo" ? (
          <img src={capture.attachmentUrl} alt="" className="relative mt-3 max-h-48 rounded-2xl object-cover shadow-sm ring-1 ring-rose-100/60" />
        ) : (
          <a className="catch-attachment relative" href={capture.attachmentUrl} target="_blank" rel="noreferrer">
            Open attachment ↗
          </a>
        )
      ) : null}

      {!isEditing ? (
        <div className="relative pt-3 mt-5 border-t border-rose-100/70">
          <FileToSelect lists={lists} filing={filing} onFile={onFile} />
        </div>
      ) : null}
    </motion.article>
  );
}

function FileToSelect({
  lists,
  filing,
  onFile,
  compact = false,
}: {
  lists: ListSummary[];
  filing: boolean;
  onFile: (list: ListSummary) => void;
  compact?: boolean;
}) {
  const { refresh, setToast } = useApp();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newListType, setNewListType] = useState<ListType>("todo");
  const [creatingList, setCreatingList] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const busy = filing || creatingList;

  useEffect(() => {
    if (!creating) return;
    titleInputRef.current?.focus();
  }, [creating]);

  const cancelCreate = () => {
    if (creatingList) return;
    setCreating(false);
    setNewTitle("");
    setNewListType("todo");
  };

  const submitCreate = async () => {
    const title = newTitle.trim();
    if (!title || busy) return;
    setCreatingList(true);
    try {
      const result = await api<{ list: PetalList }>("/api/lists", {
        method: "POST",
        body: JSON.stringify({ title, type: newListType }),
      });
      await refresh();
      setCreating(false);
      setNewTitle("");
      setNewListType("todo");
      onFile({ ...result.list, progress: { complete: 0, total: 0 } });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "That list could not be created." });
    } finally {
      setCreatingList(false);
    }
  };

  if (creating) {
    return (
      <div className={`flex flex-col gap-2 min-w-0 ${compact ? "" : "w-full"}`}>
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-xs text-rose-900/40 font-medium shrink-0 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-rose-400/80" aria-hidden />
            New list:
          </span>
          <div className="catch-file-type-pills" role="group" aria-label="List type">
            {CATCH_LIST_TYPES.map((option) => {
              const active = newListType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => setNewListType(option.id)}
                  className={`catch-file-type-pill${active ? " is-active" : ""}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <input
            ref={titleInputRef}
            type="text"
            value={newTitle}
            disabled={busy}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitCreate();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelCreate();
              }
            }}
            placeholder="List name"
            aria-label="New list name"
            className="catch-file-create-input"
          />
          <button
            type="button"
            onClick={() => void submitCreate()}
            disabled={!newTitle.trim() || busy}
            className="catch-file-create-confirm"
          >
            {creatingList ? "…" : "Create"}
          </button>
          <button type="button" onClick={cancelCreate} disabled={creatingList} className="catch-file-create-cancel">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 ${compact ? "" : "justify-between w-full"}`}>
      <span className="text-xs text-rose-900/40 font-medium shrink-0 flex items-center gap-1.5">
        <Sprout className="w-3.5 h-3.5 text-rose-400/80" aria-hidden />
        File to:
      </span>
      <div className="relative min-w-0">
        <select
          defaultValue=""
          disabled={busy}
          onChange={(event) => {
            const value = event.target.value;
            event.currentTarget.value = "";
            if (value === CREATE_LIST_VALUE) {
              setCreating(true);
              return;
            }
            const target = lists.find((list) => list.id === value);
            if (target) onFile(target);
          }}
          className="catch-file-select"
          aria-label="Choose a list to file this note"
        >
          <option value="" disabled>{filing ? "Filing…" : "Choose a list…"}</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>{list.title}</option>
          ))}
          <hr />
          <option value={CREATE_LIST_VALUE}>Create new list…</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-rose-900/35 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function captureLink(capture: QuickCapture) {
  const savedLink = capture.importedMetadata?.link;
  if (typeof savedLink === "string" && savedLink.trim()) return savedLink.trim();
  return capture.type === "link" && isHttpUrl(capture.content) ? capture.content : "";
}

function selectedCaptureTag(capture: QuickCapture) {
  const tagIds = capture.importedMetadata?.tagIds;
  return Array.isArray(tagIds) ? tagIds.find((tagId): tagId is string => typeof tagId === "string") ?? null : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function CaptureLinkPreview({ href }: { href: string }) {
  let label = href;
  try {
    label = new URL(href).hostname;
  } catch {
    // Keep an imperfect draft link readable; it simply will not navigate as a URL.
  }

  return isHttpUrl(href) ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50/50 hover:bg-rose-50 text-rose-900/65 hover:text-rose-900 text-xs font-medium transition-colors mt-2 mb-3 border border-rose-100/60"
    >
      <ExternalLink className="w-3 h-3 text-rose-400/80" />
      <span className="truncate max-w-[200px]">{label}</span>
    </a>
  ) : null;
}

function EmptyCatch() {
  return (
    <div className="catch-empty-state">
      <div className="catch-empty-flower" aria-hidden>
        <PetalMark className="catch-empty-petal petal-one" />
        <PetalMark className="catch-empty-petal petal-two" />
        <PetalMark className="catch-empty-petal petal-three" />
        <span />
      </div>
      <h2>The garden is clear</h2>
      <p>New thoughts and links will land here until you gather them into your lists.</p>
    </div>
  );
}
