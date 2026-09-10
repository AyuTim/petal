"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, ChevronDown, Copy, LayoutGrid, List, Pin, Plus, Search, SlidersHorizontal } from "lucide-react";
import { ACCENT, DAY_TAGS, PASTELS, TEMPLATES, accentVars, brightenPastel, readableInk } from "@/lib/palette";
import { api, listCountLabel, listCoverImages, money, typeLabel, type ListSummary } from "@/lib/api";
import { withGeneralAggregation } from "@/lib/lists";
import { useApp } from "@/components/providers";
import { EmptyState, Modal, OverflowMenu, PageSkeleton, Shell, type Section } from "@/components/shell";
import { parseSection, sectionForType, sectionHref, sectionLabel } from "@/lib/sections";
import type { ListItem } from "@/lib/types";

type OverviewView = "grid" | "compact";

const DAY_TAG_NAMES = new Set(DAY_TAGS.map((tag) => tag.name.toLowerCase()));

function hexWithAlpha(hex: string, alphaHex: string) {
  const raw = brightenPastel(hex).replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) {
    const pct = Math.round((Number.parseInt(alphaHex, 16) / 255) * 100);
    return `color-mix(in srgb, ${brightenPastel(hex)} ${pct}%, transparent)`;
  }
  return `#${full}${alphaHex}`;
}

function sectionCountLabel(_section: Section, count: number) {
  if (count === 0) return "No lists yet";
  return count === 1 ? "1 list" : `${count} lists`;
}

function sectionInSection(listType: string, section: Section) {
  return sectionForType(listType) === section;
}

function sectionChrome(section: Section) {
  if (section === "shop") return "is-wish";
  if (section === "todo") return "is-todo";
  return "is-bucket";
}

function sectionBlurb(section: Section) {
  if (section === "shop") return "Gifts, treats, and quiet wants.";
  if (section === "todo") return "Weekly plans and things to do.";
  return "Plans, daydreams, and things worth doing.";
}

function sectionEmptyCopy(section: Section) {
  if (section === "shop") {
    return { title: "No lists yet", body: "Start a wish or shopping list for later." };
  }
  if (section === "todo") {
    return { title: "Nothing here yet", body: "Start a weekly list, or a quiet to-do for the days ahead." };
  }
  return { title: "Nothing here yet", body: "Start a bucket list worth gathering." };
}

function gatheredLabel(type: ListSummary["type"], total: number, complete: number) {
  if (!total) return "Nothing gathered yet";
  const noun = total === 1 ? "item" : "items";
  if (complete === 0) return `${total} ${noun} gathered`;
  if (complete === total) return `${total} ${noun} · all gathered`;
  return `${complete} of ${total} gathered`;
}

function todayWeekdayShort() {
  return new Date().toLocaleDateString("en-US", { weekday: "short" });
}

function primaryTodoList(lists: ListSummary[]) {
  const active = lists.filter((list) => !list.archivedAt && list.type === "todo");
  const weekly = active.find((list) => list.isPinned && list.title.trim().toLowerCase() === "weekly");
  if (weekly) return weekly;
  const pinned = active.find((list) => list.isPinned);
  if (pinned) return pinned;
  return active[0] ?? null;
}

type MetaChip = { key: string; label: string; kind: "day" | "urgent" | "tag"; color?: string };

function todoMetaChips(items: ListItem[], limit = 3): MetaChip[] {
  const today = todayWeekdayShort();
  const chips: MetaChip[] = [];
  const seen = new Set<string>();
  let urgent = false;

  for (const item of items) {
    if (item.completed) continue;
    if (item.priority === "high") urgent = true;
    for (const tag of item.tags) {
      const lower = tag.name.trim().toLowerCase();
      if (!DAY_TAG_NAMES.has(lower)) continue;
      const isToday = tag.name.localeCompare(today, undefined, { sensitivity: "accent" }) === 0;
      const label = isToday ? "Today" : tag.name;
      const key = isToday ? "today" : `day:${lower}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ key, label, kind: "day", color: tag.color });
    }
  }

  if (urgent) {
    chips.unshift({ key: "urgent", label: "Urgent", kind: "urgent" });
  }

  return chips.slice(0, limit);
}

function progressLabel(complete: number, total: number) {
  if (!total) return "No items";
  if (complete === total) return `${complete}/${total} done`;
  return `${complete}/${total} done`;
}

export default function DashboardPage() {
  const { data, loading, error, refresh, setToast } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const section: Section = parseSection(searchParams.get("section"));
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("edited");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<OverviewView>("grid");
  const [quickAdd, setQuickAdd] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const chrome = sectionChrome(section);

  useEffect(() => {
    setType("all");
    setView("grid");
    if (searchParams.get("new") === "1") setOpen(true);
  }, [section, searchParams]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const lists = data?.lists ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = lists.filter((list) => !list.archivedAt);
    next = next.filter((list) => sectionInSection(list.type, section));
    if (type !== "all") next = next.filter((list) => list.type === type);
    if (q) {
      next = next.filter((list) => {
        const hay = [
          list.title,
          list.description,
          list.type,
          ...(list.items || []).flatMap((item) => [item.title, item.notes, item.store, item.productUrl, ...item.tags.map((t) => t.name)]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    next = [...next].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "progress") {
        const pa = a.progress.total ? a.progress.complete / a.progress.total : 0;
        const pb = b.progress.total ? b.progress.complete / b.progress.total : 0;
        return pb - pa;
      }
      if (sort === "type") return a.type.localeCompare(b.type);
      if (sort === "color") return a.color.localeCompare(b.color);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return next;
  }, [lists, query, type, sort, section]);

  const primaryList = useMemo(() => (section === "todo" ? primaryTodoList(lists) : null), [lists, section]);

  function closeCreate() {
    setOpen(false);
    if (searchParams.get("new") === "1") {
      router.replace(sectionHref(section));
    }
  }

  async function submitQuickAdd(event: FormEvent) {
    event.preventDefault();
    const title = quickAdd.trim();
    if (!title || !primaryList || quickAdding) return;
    setQuickAdding(true);
    try {
      await api(`/api/lists/${primaryList.id}/items`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setQuickAdd("");
      setToast({ message: `Added to ${primaryList.title}.` });
      await refresh();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Could not add that task." });
    } finally {
      setQuickAdding(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <PageSkeleton />
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <EmptyState title="Couldn’t open your lists" body={error} action={<button className="primary-btn" onClick={() => void refresh()}>Try again</button>} />
      </Shell>
    );
  }

  const typeOptions =
    section === "shop"
      ? [["all", "All"], ["wish", "Wish"], ["shopping", "Shopping"]]
      : section === "todo"
        ? [["all", "All"], ["todo", "To-do"]]
        : [["all", "All"], ["bucket", "Bucket"], ["custom", "Custom"]];
  const sortOptions = [
    ["edited", "Recent"],
    ["created", "Created"],
  ];
  const empty = sectionEmptyCopy(section);
  const isTodo = section === "todo";

  return (
    <Shell>
      <div className={`dash-canvas ${chrome}`} data-section={section}>
        <div className="dash-head relative z-30 overflow-visible">
          <div>
            <h1 className="page-title dash-title">{sectionLabel(section)}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="dash-count-pill">{sectionCountLabel(section, filtered.length)}</span>
              <p className="dash-subtext">{sectionBlurb(section)}</p>
            </div>
            {isTodo && primaryList ? (
              <form className="todo-quick-add" onSubmit={(event) => void submitQuickAdd(event)}>
                <input
                  className="todo-quick-add-input"
                  placeholder={primaryList.title.trim().toLowerCase() === "start here" ? "Add your first idea…" : `Add to ${primaryList.title}…`}
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  disabled={quickAdding}
                  aria-label={`Quick add task to ${primaryList.title}`}
                />
                <button type="submit" className="todo-quick-add-btn" disabled={quickAdding || !quickAdd.trim()} aria-label="Add task">
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
            ) : null}
          </div>
          <div className="dash-actions relative z-30 flex items-center gap-2 overflow-visible">
            <label className="group dash-search flex h-10 w-48 cursor-text items-center rounded-full border border-slate-200/80 transition-all duration-200 focus-within:w-64 focus-within:border-slate-300 focus-within:bg-white/95 focus-within:ring-2 focus-within:ring-slate-200/60">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <input
                ref={searchRef}
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none ring-0 placeholder-slate-400 focus:border-0 focus:outline-none focus:ring-0"
              />
              <kbd className="pointer-events-none rounded-md border border-slate-200/80 bg-slate-50/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                ⌘K
              </kbd>
            </label>
            {isTodo ? (
              <div className="todo-view-toggle" role="group" aria-label="Overview layout">
                <button
                  type="button"
                  className={view === "grid" ? "is-on" : ""}
                  aria-pressed={view === "grid"}
                  aria-label="Card grid"
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={view === "compact" ? "is-on" : ""}
                  aria-pressed={view === "compact"}
                  aria-label="Compact checklist"
                  onClick={() => setView("compact")}
                >
                  <List className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ) : null}
            <OverflowMenu
              variant="icon"
              icon={<SlidersHorizontal className="h-4 w-4 text-slate-600" strokeWidth={2} />}
              ariaLabel="Filter and sort"
              className="dash-filter-menu"
              panelClassName="dash-filter-panel absolute right-0 top-full mt-2 w-56 z-[80] bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-2 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.1),_inset_0_1px_1px_rgba(255,255,255,1)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 pt-2 pb-1">Show</p>
              {typeOptions.map(([id, label]) => {
                const on = type === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={
                      on
                        ? "dash-filter-on bg-slate-100 text-slate-900 font-semibold text-xs rounded-xl px-3 py-2 flex items-center justify-between w-full"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl px-3 py-2 text-xs font-normal transition-colors flex items-center justify-between w-full"
                    }
                    onClick={() => setType(id)}
                  >
                    <span>{label}</span>
                    {on ? <Check className="h-3.5 w-3.5 shrink-0 text-slate-700" strokeWidth={2.5} aria-hidden /> : null}
                  </button>
                );
              })}
              <div className="my-1 border-t border-slate-100" role="separator" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 pt-2 pb-1">Sort</p>
              {sortOptions.map(([id, label]) => {
                const on = sort === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={
                      on
                        ? "dash-filter-on bg-slate-100 text-slate-900 font-semibold text-xs rounded-xl px-3 py-2 flex items-center justify-between w-full"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl px-3 py-2 text-xs font-normal transition-colors flex items-center justify-between w-full"
                    }
                    onClick={() => setSort(id)}
                  >
                    <span>{label}</span>
                    {on ? <Check className="h-3.5 w-3.5 shrink-0 text-slate-700" strokeWidth={2.5} aria-hidden /> : null}
                  </button>
                );
              })}
            </OverflowMenu>
            <button
              className="primary-btn dash-new-btn h-9 !rounded-2xl !bg-slate-900 !text-white hover:!bg-slate-800"
              onClick={() => setOpen(true)}
            >
              New
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="relative z-[1]">
            <EmptyState
              title={empty.title}
              body={empty.body}
              action={
                <button className="primary-btn !rounded-2xl !bg-slate-900 !text-white hover:!bg-slate-800" onClick={() => setOpen(true)}>
                  New list
                </button>
              }
            />
          </div>
        ) : isTodo && view === "compact" ? (
          <TodoCompactView
            lists={filtered}
            onPin={async (list) => {
              await api(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ isPinned: !list.isPinned }) });
              await refresh();
            }}
            onArchive={async (list) => {
              await api(`/api/lists/${list.id}`, {
                method: "PATCH",
                body: JSON.stringify({ archivedAt: new Date().toISOString() }),
              });
              setToast({ message: "List archived." });
              await refresh();
            }}
            onToggleItem={async (item, completed) => {
              await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ completed }) });
              await refresh();
            }}
          />
        ) : (
          <div className={`board-grid petal-grid relative z-[1]${isTodo ? " is-todo-grid" : ""}`}>
            {filtered.map((list) =>
              isTodo ? (
                <TodoPetalCard
                  key={list.id}
                  list={list}
                  onPin={async () => {
                    await api(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ isPinned: !list.isPinned }) });
                    await refresh();
                  }}
                  onArchive={async () => {
                    await api(`/api/lists/${list.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
                    });
                    setToast({ message: "List archived." });
                    await refresh();
                  }}
                  onDuplicate={async () => {
                    const result = await api<{ list: { id: string } }>(`/api/lists/${list.id}/duplicate`, {
                      method: "POST",
                      body: "{}",
                    });
                    setToast({ message: "List duplicated." });
                    await refresh();
                    router.push(`/l/${result.list.id}`);
                  }}
                  onToggleItem={async (itemId, completed) => {
                    await api(`/api/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ completed }) });
                    await refresh();
                  }}
                />
              ) : (
                <PetalCard
                  key={list.id}
                  list={list}
                  section={section}
                  onPin={async () => {
                    await api(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ isPinned: !list.isPinned }) });
                    await refresh();
                  }}
                  onArchive={async () => {
                    await api(`/api/lists/${list.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
                    });
                    setToast({ message: "List archived." });
                    await refresh();
                  }}
                />
              ),
            )}
            <button type="button" className="todo-create-tile" onClick={() => setOpen(true)}>
              <span className="todo-create-plus" aria-hidden>
                <Plus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="todo-create-label">Create new list</span>
            </button>
          </div>
        )}
      </div>

      <CreateListModal
        open={open}
        section={section}
        onClose={closeCreate}
        onCreated={async (id) => {
          closeCreate();
          await refresh();
          setToast({ message: "List created." });
          window.location.href = `/l/${id}`;
        }}
      />
    </Shell>
  );
}

function TodoProgressRing({ complete, total, accent }: { complete: number; total: number; accent: string }) {
  const size = 28;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total ? Math.min(1, complete / total) : 0;
  const offset = circumference * (1 - pct);

  return (
    <span className="todo-progress" title={progressLabel(complete, total)}>
      <svg className="todo-progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.28)"
          strokeWidth={stroke}
        />
        <circle
          className="todo-progress-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="todo-progress-text">{progressLabel(complete, total)}</span>
    </span>
  );
}

function TodoPetalCard({
  list,
  onPin,
  onArchive,
  onDuplicate,
  onToggleItem,
}: {
  list: ListSummary;
  onPin: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onDuplicate: () => void | Promise<void>;
  onToggleItem: (itemId: string, completed: boolean) => Promise<void>;
}) {
  const accent = brightenPastel(list.color);
  const ink = readableInk(list.color);
  const items = list.items || [];
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalDone({});
    setPending({});
  }, [list.id, list.updatedAt]);

  function isDone(item: ListItem) {
    return item.id in localDone ? localDone[item.id] : item.completed;
  }

  const complete = items.filter((item) => isDone(item)).length;
  const total = items.length;
  const openItems = items.filter((item) => !isDone(item)).slice(0, 3);
  const chips = todoMetaChips(items);

  async function toggleItem(item: ListItem) {
    if (pending[item.id]) return;
    const next = !isDone(item);
    setLocalDone((prev) => ({ ...prev, [item.id]: next }));
    setPending((prev) => ({ ...prev, [item.id]: true }));
    try {
      await onToggleItem(item.id, next);
    } catch {
      setLocalDone((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }
  }

  return (
    <article className="petal-card group is-todo" style={accentVars(list.color) as CSSProperties}>
      <div className="petal-card-actions">
        <button
          type="button"
          className="petal-chip"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void onDuplicate();
          }}
          aria-label={`Duplicate ${list.title}`}
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="petal-chip"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void onArchive();
          }}
          aria-label={`Archive ${list.title}`}
          title="Archive"
        >
          <Archive className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`petal-chip petal-stamp ${list.isPinned ? "is-on" : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void onPin();
          }}
          aria-label={list.isPinned ? "Unpin" : "Pin"}
          title={list.isPinned ? "Unpin" : "Pin"}
        >
          <Pin className="petal-stamp-mark" strokeWidth={1.75} fill={list.isPinned ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="petal-card-link todo-card-face">
        <div
          className="todo-preview-window"
          style={{
            background: `linear-gradient(165deg, ${hexWithAlpha(accent, "22")} 0%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0.82) 100%)`,
          }}
        >
          {openItems.length ? (
            <ul className="todo-preview-list">
              {openItems.map((item) => (
                <li key={item.id} className="todo-preview-row">
                  <button
                    type="button"
                    className={`todo-preview-check${isDone(item) ? " is-on" : ""}`}
                    style={isDone(item) ? { background: accent, borderColor: accent } : undefined}
                    aria-label={`Mark ${item.title} complete`}
                    aria-pressed={isDone(item)}
                    disabled={Boolean(pending[item.id])}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void toggleItem(item);
                    }}
                  >
                    {isDone(item) ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : null}
                  </button>
                  <span className="todo-preview-title">{item.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="todo-preview-empty">{total ? "All caught up" : "Nothing queued yet"}</p>
          )}
        </div>

        <div className="petal-card-body">
          <div className="petal-card-top todo-card-top">
            <div className="todo-chip-row">
              <span
                className="petal-pip"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, #f8fafc)`,
                  borderColor: `color-mix(in srgb, ${accent} 42%, #cbd5e1)`,
                  color: ink,
                }}
              >
                <span className="petal-pip-dot" style={{ background: accent }} />
                {typeLabel(list.type)}
              </span>
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className={`todo-meta-chip is-${chip.kind}`}
                  style={
                    chip.kind === "day" && chip.color
                      ? {
                          background: `color-mix(in srgb, ${brightenPastel(chip.color)} 55%, #ffffff)`,
                          borderColor: `color-mix(in srgb, ${brightenPastel(chip.color)} 40%, #e2e8f0)`,
                        }
                      : undefined
                  }
                >
                  {chip.label}
                </span>
              ))}
            </div>
            <TodoProgressRing complete={complete} total={total} accent={accent} />
          </div>

          <Link href={`/l/${list.id}`} className="todo-card-title-link">
            <h2 className="petal-card-title">{list.title}</h2>
          </Link>

          <div className="petal-card-footer">
            <p className="petal-card-status">
              {total ? (complete === total ? "All done for now" : `${total - complete} open`) : "Start with a quiet task"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function TodoCompactView({
  lists,
  onPin,
  onArchive,
  onToggleItem,
}: {
  lists: ListSummary[];
  onPin: (list: ListSummary) => void | Promise<void>;
  onArchive: (list: ListSummary) => void | Promise<void>;
  onToggleItem: (item: ListItem, completed: boolean) => Promise<void>;
}) {
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const listsStamp = useMemo(() => lists.map((list) => `${list.id}:${list.updatedAt}`).join("|"), [lists]);

  useEffect(() => {
    setLocalDone({});
    setPending({});
  }, [listsStamp]);

  function isDone(item: ListItem) {
    return item.id in localDone ? localDone[item.id] : item.completed;
  }

  async function toggleItem(item: ListItem) {
    if (pending[item.id]) return;
    const next = !isDone(item);
    setLocalDone((prev) => ({ ...prev, [item.id]: next }));
    setPending((prev) => ({ ...prev, [item.id]: true }));
    try {
      await onToggleItem(item, next);
    } catch {
      setLocalDone((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    } finally {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }
  }

  return (
    <div className="todo-compact relative z-[1]">
      {lists.map((list) => {
        const accent = brightenPastel(list.color);
        const items = [...(list.items || [])].sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || a.position - b.position);
        const complete = items.filter((item) => isDone(item)).length;
        const chips = todoMetaChips(list.items || []);

        return (
          <section key={list.id} className="todo-compact-block" style={accentVars(list.color) as CSSProperties}>
            <header className="todo-compact-head">
              <div className="todo-compact-title-wrap">
                <Link href={`/l/${list.id}`} className="todo-compact-title">
                  {list.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} fill="currentColor" aria-hidden /> : null}
                  {list.title}
                </Link>
                <div className="todo-chip-row">
                  {chips.map((chip) => (
                    <span key={chip.key} className={`todo-meta-chip is-${chip.kind}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="todo-compact-meta">
                <TodoProgressRing complete={complete} total={items.length} accent={accent} />
                <button type="button" className="petal-chip is-static" onClick={() => void onPin(list)} aria-label={list.isPinned ? "Unpin" : "Pin"}>
                  <Pin className="h-3.5 w-3.5" strokeWidth={1.75} fill={list.isPinned ? "currentColor" : "none"} />
                </button>
                <button type="button" className="petal-chip is-static" onClick={() => void onArchive(list)} aria-label={`Archive ${list.title}`}>
                  <Archive className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </header>
            {items.length ? (
              <ul className="todo-compact-list">
                {items.map((item) => (
                  <li key={item.id} className={`todo-compact-row${isDone(item) ? " is-done" : ""}`}>
                    <button
                      type="button"
                      className={`todo-preview-check${isDone(item) ? " is-on" : ""}`}
                      style={isDone(item) ? { background: accent, borderColor: accent } : undefined}
                      aria-label={`Mark ${item.title} complete`}
                      aria-pressed={isDone(item)}
                      disabled={Boolean(pending[item.id])}
                      onClick={() => void toggleItem(item)}
                    >
                      {isDone(item) ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : null}
                    </button>
                    <span className="todo-compact-item-title">{item.title}</span>
                    <span className="todo-compact-item-tags">
                      {item.tags
                        .filter((tag) => DAY_TAG_NAMES.has(tag.name.toLowerCase()))
                        .slice(0, 2)
                        .map((tag) => (
                          <span key={tag.id} className="todo-meta-chip is-day">
                            {tag.name.localeCompare(todayWeekdayShort(), undefined, { sensitivity: "accent" }) === 0 ? "Today" : tag.name}
                          </span>
                        ))}
                      {item.priority === "high" ? <span className="todo-meta-chip is-urgent">Urgent</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="todo-compact-empty">No tasks in this list yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PetalCard({
  list,
  section,
  onPin,
  onArchive,
}: {
  list: ListSummary;
  section: Section;
  onPin: () => void;
  onArchive: () => void;
}) {
  const { data } = useApp();
  const view = withGeneralAggregation(list, data?.lists ?? []);
  const cover = listCoverImages(view, 1)[0];
  const estimate = (view.items || []).reduce((s, i) => s + (i.price || 0), 0);
  const pct = view.progress.total ? (view.progress.complete / view.progress.total) * 100 : 0;
  const accent = brightenPastel(list.color);
  const ink = readableInk(list.color);
  const isWish = section === "shop";
  const isShopList = list.type === "wish" || list.type === "shopping";
  const chrome = sectionChrome(section);

  const status = isWish
    ? listCountLabel(view.type, view.progress.total, view.progress.complete)
    : gatheredLabel(view.type, view.progress.total, view.progress.complete);

  const budgetLine =
    isShopList && list.budgetTarget != null
      ? `Target ${money(list.budgetTarget, list.currency)}`
      : isShopList && estimate > 0
        ? money(estimate, list.currency)
        : null;

  return (
    <article
      className={`petal-card group ${chrome}${cover ? "" : " is-bare"}`}
      style={accentVars(list.color) as CSSProperties}
    >
      <div className="petal-card-actions">
        <button
          type="button"
          className="petal-chip"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onArchive();
          }}
          aria-label={`Archive ${list.title}`}
        >
          <Archive className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`petal-chip petal-stamp ${list.isPinned ? "is-on" : ""}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPin();
          }}
          aria-label={list.isPinned ? "Unpin" : "Pin"}
          title={list.isPinned ? "Unpin" : "Pin"}
        >
          <Pin className="petal-stamp-mark" strokeWidth={1.75} fill={list.isPinned ? "currentColor" : "none"} />
        </button>
      </div>

      <Link href={`/l/${list.id}`} className="petal-card-link">
        {cover ? (
          <div className="petal-photo-window">
            <img src={cover} alt="" />
          </div>
        ) : (
          <div
            className="petal-photo-window is-plain"
            style={{
              background: `linear-gradient(160deg, ${hexWithAlpha(accent, "28")} 0%, rgba(248,250,252,0.95) 58%, #ffffff 100%)`,
            }}
          >
            <span className="petal-plain-pip" style={{ background: accent }} aria-hidden />
          </div>
        )}

        <div className="petal-card-body">
          <div className="petal-card-top">
            <span
              className="petal-pip"
              style={{
                background: `color-mix(in srgb, ${accent} 16%, #f8fafc)`,
                borderColor: `color-mix(in srgb, ${accent} 42%, #cbd5e1)`,
                color: ink,
              }}
            >
              <span className="petal-pip-dot" style={{ background: accent }} />
              {typeLabel(list.type)}
            </span>
            <span className="petal-item-count">
              {view.progress.total
                ? `${view.progress.total} ${view.progress.total === 1 ? (list.type === "wish" ? "wish" : "item") : list.type === "wish" ? "wishes" : "items"}`
                : "Empty"}
            </span>
          </div>

          <h2 className="petal-card-title">{list.title}</h2>

          <div className="petal-card-footer">
            <p className="petal-card-status">{status}</p>
            {budgetLine ? <p className="petal-card-budget">{budgetLine}</p> : null}
          </div>

          {view.progress.total ? (
            <div className="petal-vine" aria-hidden>
              <span className="petal-vine-fill" style={{ width: `${pct}%`, background: accent }} />
            </div>
          ) : (
            <div className="petal-accent-bar" aria-hidden style={{ background: accent }} />
          )}
        </div>
      </Link>
    </article>
  );
}

function CreateListModal({
  open,
  section,
  onClose,
  onCreated,
}: {
  open: boolean;
  section: Section;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { refresh, setToast } = useApp();
  const defaultType = section === "shop" ? "wish" : section === "todo" ? "todo" : "bucket";
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [type, setType] = useState(defaultType);
  const [color, setColor] = useState<string>(ACCENT.hex);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setError("");
    setImportBusy(false);
  }, [open, defaultType]);

  const templates = TEMPLATES.filter((template) => sectionForType(template.type) === section);
  const headerPill = templates.length === 1 ? templates[0].title : sectionLabel(section);

  function applyTemplate(template: (typeof TEMPLATES)[number]) {
    setTitle(template.title);
    setEmoji(template.emoji);
    setType(template.type);
    setColor(template.color);
    setDescription(template.description);
  }

  async function create(extra?: Record<string, unknown>) {
    try {
      const result = await api<{ list: { id: string } }>("/api/lists", {
        method: "POST",
        body: JSON.stringify({ title: title || extra?.title, emoji, type, color, description, ...extra }),
      });
      onCreated(result.list.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that list.");
    }
  }

  async function importBackup(file: File) {
    setImportBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      await api("/api/import", { method: "POST", body: JSON.stringify(parsed) });
      await refresh();
      onClose();
      setToast({ message: "Backup imported." });
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "That file isn’t valid JSON. Export JSON from a list and try again."
          : err instanceof Error
            ? err.message
            : "That file isn’t a Petals backup. Export JSON from a list and try again.",
      );
    } finally {
      setImportBusy(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="is-create-list"
      title={
        <div className="create-list-title">
          <h2>New list</h2>
          {templates.length === 1 ? (
            <button
              type="button"
              className="create-list-pill"
              onClick={() => applyTemplate(templates[0])}
              title={`Use “${templates[0].title}” template`}
            >
              {headerPill}
            </button>
          ) : (
            <span className="create-list-pill is-static">{headerPill}</span>
          )}
        </div>
      }
    >
      <div className="item-form create-list-form">
        {templates.length > 1 ? (
          <div className="create-list-field">
            <span className="create-list-label">Templates</span>
            <div className="create-list-templates">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="create-list-template"
                  onClick={() => applyTemplate(template)}
                >
                  {template.emoji ? <span aria-hidden>{template.emoji}</span> : null}
                  {template.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <label className="create-list-field">
          <span className="create-list-label">List name</span>
          <input
            className="field field-title create-list-input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="create-list-field">
          <span className="create-list-label">Category</span>
          <span className="create-list-select-wrap">
            <select
              className="field create-list-input create-list-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {section === "shop" ? (
                <>
                  <option value="wish">Wish</option>
                  <option value="shopping">Shopping</option>
                </>
              ) : section === "todo" ? (
                <option value="todo">To-do</option>
              ) : (
                <>
                  <option value="bucket">Bucket</option>
                  <option value="custom">Custom</option>
                </>
              )}
            </select>
            <ChevronDown className="create-list-chevron" strokeWidth={2} aria-hidden />
          </span>
        </label>
        <label className="create-list-field">
          <span className="create-list-label">Description</span>
          <textarea
            className="field create-list-input create-list-textarea min-h-20"
            placeholder="Optional note"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="create-list-field">
          <span className="create-list-label">Color</span>
          <div className="create-list-swatch-tray">
            {PASTELS.map((swatch) => {
              const selected = color === swatch.hex;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  className={`create-list-swatch${selected ? " is-on" : ""}`}
                  style={
                    {
                      background: swatch.hex,
                      "--swatch-ring": swatch.hex,
                    } as CSSProperties
                  }
                  aria-label={swatch.name}
                  aria-pressed={selected}
                  onClick={() => setColor(swatch.hex)}
                >
                  {selected ? <Check className="create-list-swatch-check" strokeWidth={2.5} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </div>
        {error ? <p className="text-sm text-[#9a4d4d]">{error}</p> : null}
        <div className="create-list-actions">
          <button className="primary-btn create-list-submit" onClick={() => void create()} disabled={importBusy}>
            Create
          </button>
          <button
            type="button"
            className="create-list-import"
            disabled={importBusy}
            onClick={() => importRef.current?.click()}
          >
            {importBusy ? "Importing…" : "Import backup…"}
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importBackup(file);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
