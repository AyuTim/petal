"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Coffee,
  Copy,
  Download,
  ExternalLink,
  Flower2,
  GripVertical,
  Heart,
  ImageDown,
  ImagePlus,
  Layers,
  ListFilter,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { PASTELS, WEEK_DAY_TAB_ORDER, accentVars, brightenPastel } from "@/lib/palette";
import { api, coverStyle, itemVisual, listCountLabel, money, monthKey, normalizeSeason, prettyMonth, seasonLabel, showDescription, tagsUsedOnItems, typeLabel } from "@/lib/api";
import { looksLikeImageUrl } from "@/lib/media";
import { isGeneralList, withGeneralAggregation } from "@/lib/lists";
import type { ListItem, ListVersion, MoodLayout, PetalList, Tag, ViewerRole } from "@/lib/types";
import { useApp } from "@/components/providers";
import { BloomingFlower } from "@/components/BloomingFlower";
import { FileDropInput } from "@/components/file-drop-input";
import {
  EmptyState,
  ListSkeleton,
  Modal,
  OverflowMenu,
  TagFilterRow,
  TagPills,
  isShopType,
  isTodoType,
  sectionForType,
  tagFilterTone,
  toolbarMenuCheckClass,
  toolbarMenuDividerClass,
  toolbarMenuHintClass,
  toolbarMenuIconClass,
  toolbarMenuItemActiveClass,
  toolbarMenuItemClass,
} from "@/components/shell";

type View = "list" | "mood" | "timeline" | "memories";

const dropAnimation: DropAnimation = {
  duration: 0,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "1" } },
  }),
};

export function ListWorkspace({
  listId,
  shareToken,
  preview,
}: {
  listId?: string;
  shareToken?: string;
  preview?: boolean;
}) {
  const { data, refresh, removeList, setToast } = useApp();
  const router = useRouter();
  const search = useSearchParams();
  const [list, setList] = useState<PetalList | null>(null);
  const [versions, setVersions] = useState<ListVersion[]>([]);
  const [role, setRole] = useState<ViewerRole>(shareToken ? "view" : "owner");
  const [view, setView] = useState<View>("list");
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(search.get("item"));
  const [guestName, setGuestName] = useState("");
  const [askedName, setAskedName] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  const prevPctRef = useRef<{ key: string | null; pct: number | null }>({ key: null, pct: null });
  const [sort, setSort] = useState("custom");
  const [filters, setFilters] = useState({ completed: "all", purchased: "all", priority: "all", tag: "" });
  const [styleOpen, setStyleOpen] = useState(false);
  const [memoryCursor, setMemoryCursor] = useState(() => new Date());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    try {
      if (shareToken) {
        const result = await api<{ list: PetalList; permission: ViewerRole }>(`/api/share/${shareToken}`);
        setList(result.list);
        setRole(result.permission);
        if (result.permission === "edit" && !sessionStorage.getItem("ll-guest") && !askedName) setAskedName(true);
      } else if (listId) {
        const result = await api<{ list: PetalList; versions: ListVersion[] }>(`/api/lists/${listId}`);
        setList(result.list);
        setVersions(result.versions);
        setRole("owner");
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "This list isn’t available.");
    }
  }

  useEffect(() => {
    void load();
  }, [listId, shareToken]);

  const progressKey = listId || shareToken || null;
  const aggregator = Boolean(list && !shareToken && isGeneralList(list));
  const displayList = list ? (aggregator ? withGeneralAggregation(list, data?.lists ?? []) : list) : null;
  const items = displayList?.items || [];
  const complete = items.filter((i) => i.completed).length;
  const pct = items.length ? Math.round((complete / items.length) * 100) : 0;
  const canEdit = role === "owner" || role === "edit";
  const settings = data?.settings;

  useEffect(() => {
    // Only celebrate when progress crosses a milestone while staying on the same list.
    // First paint / list switch baselines silently so visiting an already-at-25% list
    // does not re-show the popup.
    const listReady =
      Boolean(progressKey) &&
      items.length > 0 &&
      Boolean(list) &&
      (shareToken ? true : list?.id === progressKey);

    if (!listReady) {
      if (prevPctRef.current.key !== progressKey) {
        prevPctRef.current = { key: progressKey, pct: null };
        setMilestone(null);
      }
      return;
    }

    const prev = prevPctRef.current;
    if (prev.key !== progressKey || prev.pct === null) {
      prevPctRef.current = { key: progressKey, pct };
      setMilestone(null);
      return;
    }

    prevPctRef.current = { key: progressKey, pct };
    if (!settings?.milestonesEnabled || pct <= prev.pct) return;
    const marks = [25, 50, 75, 100];
    const hit = marks.find((m) => prev.pct! < m && pct >= m);
    if (hit) setMilestone(hit);
  }, [pct, items.length, progressKey, list, shareToken, settings?.milestonesEnabled]);

  useEffect(() => {
    if (!list) return;
    if (isTodoType(list.type) && view !== "list") {
      setView("list");
      return;
    }
    if (isShopType(list.type) && (view === "timeline" || view === "memories")) {
      setView("list");
    }
  }, [list, view]);

  useEffect(() => {
    // Day-tab filter is todo-only chrome; clear when leaving a todo list.
    if (list && isTodoType(list.type)) return;
    setFilters((current) => (current.tag ? { ...current, tag: "" } : current));
  }, [list?.id, list?.type]);

  async function patchList(patch: Record<string, unknown>) {
    if (!list || role !== "owner") return;
    const result = await api<{ list: PetalList }>(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setList(result.list);
    await refresh();
  }

  async function mutateItem(action: string, payload: Record<string, unknown>) {
    if (!list) return;
    if (shareToken) {
      const result = await api<{ list: PetalList }>(`/api/share/${shareToken}`, {
        method: "POST",
        body: JSON.stringify({ ...payload, action, guestName: guestName || sessionStorage.getItem("ll-guest") || "Guest" }),
      });
      setList(result.list);
    } else if (action === "create") {
      const destId = typeof payload.listId === "string" && payload.listId ? payload.listId : list.id;
      const result = await api<{ list: PetalList }>(`/api/lists/${destId}/items`, { method: "POST", body: JSON.stringify(payload.item) });
      if (result.list.id === list.id) setList(result.list);
    } else if (action === "update") {
      const result = await api<{ list: PetalList }>(`/api/items/${payload.itemId}`, { method: "PATCH", body: JSON.stringify(payload.patch) });
      const destId = typeof payload.patch === "object" && payload.patch && "listId" in payload.patch ? String((payload.patch as { listId?: string }).listId || "") : "";
      if (destId && destId !== list.id) {
        setItemId(null);
        const dest = data?.lists.find((entry) => entry.id === destId);
        if (dest) setToast({ message: `Moved to ${dest.title}.` });
      }
      if (result.list.id === list.id) setList(result.list);
    } else if (action === "delete") {
      const snapshot = items.find((i) => i.id === payload.itemId);
      const result = await api<{ list: PetalList }>(`/api/items/${payload.itemId}`, { method: "DELETE" });
      if (result.list.id === list.id) setList(result.list);
      setToast({
        message: "That item was removed.",
        action: snapshot
          ? {
              label: "Undo",
              onClick: () => void mutateItem("create", { item: { ...snapshot, id: undefined }, listId: snapshot.listId }),
            }
          : undefined,
      });
    } else if (action === "reorder") {
      const result = await api<{ list: PetalList }>(`/api/lists/${list.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ ids: payload.ids, kind: aggregator ? "general" : payload.kind || "items" }),
      });
      setList(result.list);
    }
    await refresh();
  }

  function onReorder(nextIds: string[]) {
    if (!list || !canEdit || !nextIds.length) return;

    // Keep the final order in place while the API persists it; waiting for the
    // response here is what made a released row jump back and then forward.
    setList((current) => {
      if (!current || current.id !== list.id) return current;
      if (aggregator) return { ...current, generalItemOrder: nextIds };
      if (!current.items?.length) return current;
      const reordered = nextIds.map((id) => current.items!.find((item) => item.id === id)).filter((item): item is ListItem => Boolean(item));
      if (reordered.length !== nextIds.length) return current;
      let index = 0;
      return {
        ...current,
        items: current.items.map((item) => (nextIds.includes(item.id) ? reordered[index++] : item)),
      };
    });

    void mutateItem("reorder", { ids: nextIds, kind: "items" }).catch(() => {
      setToast({ message: "Couldn’t save that order. It was restored." });
      void load();
    });
  }

  const dayTabs = useMemo(() => {
    const allTags = data?.tags || [];
    return WEEK_DAY_TAB_ORDER.map((name) => allTags.find((tag) => tag.name.toLowerCase() === name.toLowerCase())).filter(
      (tag): tag is Tag => Boolean(tag),
    );
  }, [data?.tags]);
  const usedTags = useMemo(() => tagsUsedOnItems(data?.tags || [], items, filters.tag), [data?.tags, items, filters.tag]);

  if (error) return <EmptyState title="This list is private" body={error} action={<Link className="primary-btn" href="/">Go home</Link>} />;
  if (!list || !displayList) return <ListSkeleton />;

  const fontClass =
    list.fontStyle === "serif" ? "font-[family-name:var(--font-serif)]" : list.fontStyle === "script" ? "font-[family-name:var(--font-serif)]" : "";
  const productList = isShopType(list.type);
  const todoList = isTodoType(list.type);
  const viewTabs: [View, string][] = productList
    ? [
        ["list", "List"],
        ["mood", "Mood"],
      ]
    : [
        ["list", "List"],
        ["mood", "Mood"],
        ["timeline", "Timeline"],
        ["memories", "Memories"],
      ];
  const activeView = todoList || (productList && (view === "timeline" || view === "memories")) ? "list" : view;
  const activeDayTag = todoList && filters.tag ? dayTabs.find((tag) => tag.id === filters.tag) ?? null : null;

  return (
    <div className={`list-page ${fontClass}`} style={accentVars(list.color) as React.CSSProperties}>
      {preview ? <div className="mb-3 border-b border-[var(--line)] pb-2 text-sm" style={{ color: "var(--muted)" }}>Share preview · {role === "edit" ? "Can edit" : "View only"}</div> : null}
      <header className="list-head">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <BloomingFlower completed={complete} total={items.length} accentColor={list.color} />
            <h1 className="list-title text-4xl tracking-tight text-zinc-950">{list.title}</h1>
            {role === "owner" ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 text-neutral-400 transition-colors hover:text-neutral-900"
                aria-label="Customize"
                onClick={() => setStyleOpen(true)}
              >
                <Palette className="size-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
          <p className="page-sub mt-1 text-sm font-normal text-slate-500">
            {listCountLabel(list.type, items.length, complete)}
            {list.share?.active && role === "owner" ? ` · ${list.share.permission === "edit" ? "Can edit" : "View only"}` : null}
            {list.archivedAt ? " · Archived" : null}
          </p>
          {showDescription(list.description) || productList || (items.length > 0 && !productList) ? (
            <div className="list-head-body">
              {showDescription(list.description) ? <p className="list-desc">{list.description}</p> : null}
              {productList ? <BudgetBar list={list} /> : null}
              {items.length > 0 && !productList ? <ProgressFill pct={pct} className="list-progress" /> : null}
            </div>
          ) : null}
        </div>
        <div className="list-head-actions">
          <div className="list-action-capsule">
            <div className="list-completion-meter">
              <span>{complete}/{items.length} done</span>
            </div>
            <span className="list-action-divider" aria-hidden />
            <ListMenu
              list={list}
              role={role}
              view={activeView}
              sort={sort}
              filters={filters}
              versions={versions}
              onSort={setSort}
              onFilters={setFilters}
              onPatch={patchList}
              onReload={load}
              router={router}
              setToast={setToast}
              onDeleteList={removeList}
              onCustomize={() => setStyleOpen(true)}
            />
          </div>
        </div>
      </header>
      <div className="list-viewbar flex items-center justify-between gap-4 mb-4 px-1">
        {todoList ? (
          <nav className="view-tabs" aria-label="Day of week">
            <button
              type="button"
              className={`view-tab ${!filters.tag ? "is-active" : ""}`}
              aria-current={!filters.tag ? "page" : undefined}
              onClick={() => setFilters({ ...filters, tag: "" })}
            >
              {!filters.tag ? (
                <motion.span
                  layoutId="activeDayTab"
                  className="view-tab-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              ) : null}
              <span className="view-tab-label">All</span>
            </button>
            {dayTabs.map((tag) => {
              const active = filters.tag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`view-tab ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setFilters({ ...filters, tag: active ? "" : tag.id })}
                >
                  {active ? (
                    <motion.span
                      layoutId="activeDayTab"
                      className="view-tab-pill"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  ) : null}
                  <span className="view-tab-label">{tag.name}</span>
                </button>
              );
            })}
          </nav>
        ) : (
          <>
            <nav className="view-tabs" aria-label="List views">
              {viewTabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`view-tab ${activeView === id ? "is-active" : ""}`}
                  aria-current={activeView === id ? "page" : undefined}
                  onClick={() => setView(id)}
                >
                  {activeView === id ? (
                    <motion.span
                      layoutId="activeViewTab"
                      className="view-tab-pill"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  ) : null}
                  <span className="view-tab-label">{label}</span>
                </button>
              ))}
            </nav>
            {usedTags.length && (activeView === "list" || activeView === "mood") ? (
              <TagFilterRow tags={usedTags} selected={filters.tag} onSelect={(id) => setFilters({ ...filters, tag: id })} />
            ) : null}
          </>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${list.id}-${todoList ? filters.tag || "all" : activeView}`}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {activeView === "list" ? (
            <>
              {canEdit ? (
                <Composer
                  list={list}
                  defaultTags={activeDayTag ? [activeDayTag] : []}
                  onCreate={(item) => void mutateItem("create", { item })}
                />
              ) : null}
              <ListView
                list={displayList}
                aggregator={aggregator}
                canEdit={canEdit}
                reorderable
                sensors={sensors}
                sort={sort}
                filters={filters}
                onReorder={onReorder}
                onOpen={setItemId}
                onMutate={mutateItem}
                onReload={load}
              />
            </>
          ) : null}
          {activeView === "mood" ? (
            <MoodBoard
              list={displayList}
              canEdit={canEdit}
              tagFilter={filters.tag}
              onOpen={setItemId}
              onMutate={mutateItem}
              onReload={load}
            />
          ) : null}
          {activeView === "timeline" ? <Timeline list={displayList} canEdit={canEdit} onOpen={setItemId} onMutate={mutateItem} /> : null}
          {activeView === "memories" ? (
            <Memories
              list={displayList}
              cursor={memoryCursor}
              onCursorChange={setMemoryCursor}
              onOpen={setItemId}
              canEdit={canEdit}
              onAddMemory={(day) => {
                const completedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0).toISOString();
                void (async () => {
                  if (shareToken) {
                    await mutateItem("create", { item: { title: "Memory", completed: true, completedAt } });
                    return;
                  }
                  const result = await api<{ list: PetalList }>(`/api/lists/${list.id}/items`, {
                    method: "POST",
                    body: JSON.stringify({ title: "Memory", completed: true, completedAt }),
                  });
                  if (result.list.id === list.id) setList(result.list);
                  const created = [...(result.list.items || [])]
                    .filter((entry) => entry.completedAt === completedAt)
                    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
                  if (created) setItemId(created.id);
                  await refresh();
                })();
              }}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
      {role === "owner" ? (
        <StyleModal list={list} open={styleOpen} onClose={() => setStyleOpen(false)} onPatch={patchList} />
      ) : null}

      {itemId ? (
        <ItemModal
          item={items.find((i) => i.id === itemId) || null}
          list={list}
          canEdit={canEdit}
          owner={role === "owner"}
          tags={data?.tags || []}
          onClose={() => setItemId(null)}
          onMutate={mutateItem}
          onReload={load}
        />
      ) : null}

      {askedName ? (
        <Modal open title="What should we call you?" onClose={() => setAskedName(false)}>
          <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>Optional. Edits will be marked as “edited by guest.”</p>
          <input className="field" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="A first name is plenty" />
          <button
            className="primary-btn mt-4"
            onClick={() => {
              sessionStorage.setItem("ll-guest", guestName || "Guest");
              setAskedName(false);
            }}
          >
            Continue
          </button>
        </Modal>
      ) : null}

      {milestone && settings?.milestonesEnabled ? (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" onAnimationEnd={() => setMilestone(null)}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${10 + i * 8}%`,
                bottom: "20%",
                width: 14,
                height: 18,
                background: i % 2 ? "var(--accent)" : "var(--accent-soft)",
                animation: `petal-float 2.4s ease ${i * 0.08}s`,
              }}
            />
          ))}
          <div className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 card px-5 py-3 text-center">
            <p className="text-sm font-medium">{milestone === 100 ? "List complete" : `${milestone}% complete`}</p>
            <button className="soft-btn mt-2" onClick={() => setMilestone(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressFill({ pct, className = "" }: { pct: number; className?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className={`progress-bar ${className}`.trim()} aria-hidden>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function itemCountsTowardGathered(item: ListItem, listType: PetalList["type"]) {
  // Shopping tracks spend via purchased; wish lists also count crossed-off (completed) items.
  if (listType === "shopping") return item.purchased;
  return item.purchased || item.completed;
}

function BudgetBar({ list }: { list: PetalList }) {
  const items = list.items || [];
  const estimated = items.reduce((s, i) => s + (i.price || 0), 0);
  const gathered = items
    .filter((i) => itemCountsTowardGathered(i, list.type))
    .reduce((s, i) => s + (i.price || 0), 0);
  const remaining = Math.max(0, estimated - gathered);
  const pct = estimated > 0 ? Math.min(100, (gathered / estimated) * 100) : 0;
  const gatheredLabel = list.type === "shopping" ? "Purchased" : "Gathered";
  return (
    <section className="budget-line">
      <div className="budget-stats">
        <div className="budget-stat">
          <p className="budget-stat-value">{money(estimated, list.currency)}</p>
          <p className="budget-stat-label">Estimated</p>
        </div>
        <div className="budget-stat">
          <p className="budget-stat-value">{money(gathered, list.currency)}</p>
          <p className="budget-stat-label">{gatheredLabel}</p>
        </div>
        <div className="budget-stat">
          <p className="budget-stat-value">{money(remaining, list.currency)}</p>
          <p className="budget-stat-label">Remaining</p>
        </div>
      </div>
      {estimated > 0 ? <ProgressFill pct={pct} className="budget-liquid-bar" /> : null}
    </section>
  );
}

function ToolMenuOption({
  active,
  layoutId,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  layoutId: string;
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${toolbarMenuItemClass} !min-h-0 !border-transparent !shadow-none ${
        active ? `!bg-transparent ${toolbarMenuItemActiveClass}` : ""
      }`}
      onClick={onClick}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className={`absolute inset-0 rounded-xl ${toolbarMenuItemActiveClass}`}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="relative z-10 flex items-center gap-2.5">
        <Icon className={toolbarMenuIconClass} strokeWidth={1.75} aria-hidden />
        <span>{children}</span>
      </span>
      {active ? <Check className={`relative z-10 ${toolbarMenuCheckClass}`} strokeWidth={2.5} aria-hidden /> : null}
    </button>
  );
}

function ActionItem({
  icon: Icon,
  hint,
  danger,
  children,
  onClick,
}: {
  icon: LucideIcon;
  hint?: string;
  danger?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${toolbarMenuItemClass} !min-h-0 !border-transparent !shadow-none ${
        danger ? "!text-rose-600 hover:!bg-rose-50 hover:!text-rose-700" : ""
      }`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={toolbarMenuIconClass} strokeWidth={1.75} aria-hidden />
        <span>{children}</span>
      </span>
      {hint ? <span className={toolbarMenuHintClass}>{hint}</span> : null}
    </button>
  );
}

function ListMenu({
  list,
  role,
  view,
  sort,
  filters,
  versions,
  onSort,
  onFilters,
  onPatch,
  onReload,
  router,
  setToast,
  onDeleteList,
  onCustomize,
}: {
  list: PetalList;
  role: ViewerRole;
  view: View;
  sort: string;
  filters: { completed: string; purchased: string; priority: string; tag: string };
  versions: ListVersion[];
  onSort: (sort: string) => void;
  onFilters: (filters: { completed: string; purchased: string; priority: string; tag: string }) => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
  setToast: (t: { message: string; action?: { label: string; onClick: () => void } } | null) => void;
  onDeleteList: (listId: string) => void;
  onCustomize: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const owner = role === "owner";

  function showAll() {
    onFilters({ ...filters, completed: "all", purchased: "all", priority: "all", tag: "" });
  }

  function showOpen() {
    onFilters({ ...filters, completed: "no", purchased: "all", priority: "all" });
  }

  function showDone() {
    onFilters({ ...filters, completed: "yes", purchased: "all", priority: "all" });
  }

  return (
    <>
      <div className="list-tools">
        <OverflowMenu
          variant="icon"
          panel="tool"
          icon={<ArrowUpDown className="size-4" strokeWidth={1.75} />}
          ariaLabel="Sort"
          active={sort !== "custom"}
        >
          {(
            [
              ["custom", "Custom", SlidersHorizontal],
              ["date", "Date", Calendar],
              ["added", "Added", Clock],
              ["complete", "Done", CheckCircle2],
            ] as const
          ).map(([id, label, Icon]) => (
            <ToolMenuOption key={id} active={sort === id} layoutId="activeSortPill" icon={Icon} onClick={() => onSort(id)}>
              {label}
            </ToolMenuOption>
          ))}
        </OverflowMenu>
        <OverflowMenu
          variant="icon"
          panel="tool"
          icon={<ListFilter className="size-4" strokeWidth={1.75} />}
          ariaLabel="Show"
          active={filters.completed !== "all" || (list.type !== "todo" && Boolean(filters.tag))}
        >
          <ToolMenuOption active={filters.completed === "all"} layoutId="activeFilterPill" icon={Layers} onClick={showAll}>
            All
          </ToolMenuOption>
          <ToolMenuOption active={filters.completed === "no"} layoutId="activeFilterPill" icon={Circle} onClick={showOpen}>
            Open
          </ToolMenuOption>
          <ToolMenuOption active={filters.completed === "yes"} layoutId="activeFilterPill" icon={CheckCheck} onClick={showDone}>
            Completed
          </ToolMenuOption>
        </OverflowMenu>
        {owner ? (
          <OverflowMenu variant="icon" panel="actions" icon={<MoreHorizontal className="size-4" strokeWidth={1.75} />} ariaLabel="List actions">
            <div>
              <ActionItem icon={Share2} hint="⌘S" onClick={() => setShareOpen(true)}>
                Share
              </ActionItem>
              <ActionItem icon={Palette} onClick={onCustomize}>
                Customize
              </ActionItem>
            </div>
            <div className={toolbarMenuDividerClass}>
              <ActionItem
                icon={Copy}
                hint="⌘D"
                onClick={() => void api<{ list: PetalList }>(`/api/lists/${list.id}/duplicate`, { method: "POST", body: "{}" }).then((r) => router.push(`/l/${r.list.id}`))}
              >
                Duplicate
              </ActionItem>
              {list.archivedAt ? (
                <ActionItem icon={ArchiveRestore} onClick={() => void onPatch({ archivedAt: null })}>
                  Restore
                </ActionItem>
              ) : (
                <ActionItem icon={Archive} onClick={() => void onPatch({ archivedAt: new Date().toISOString() })}>
                  Archive
                </ActionItem>
              )}
              <ActionItem
                icon={Download}
                onClick={async () => {
                  const blob = new Blob([JSON.stringify({ list, exportedAt: new Date().toISOString(), attachmentNote: "Uploaded files are represented by local /api/files links or remote URLs. External shop links stay as URLs and are not embedded." }, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${list.title.replace(/\s+/g, "-").toLowerCase()}.json`;
                  a.click();
                }}
              >
                Export JSON
              </ActionItem>
              <ActionItem
                icon={FileSpreadsheet}
                onClick={() => {
                  const slug = list.title.replace(/\s+/g, "-").toLowerCase();
                  const blob = new Blob([listToCsv(list)], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${slug}.csv`;
                  a.click();
                }}
              >
                Export CSV
              </ActionItem>
              {view === "mood" ? (
                <ActionItem
                  icon={ImageDown}
                  onClick={async () => {
                    try {
                      const { toPng } = await import("html-to-image");
                      const node = document.getElementById("mood-export");
                      if (!node) throw new Error("Mood board not found");
                      const dataUrl = await toPng(node, {
                        pixelRatio: 2,
                        cacheBust: true,
                        backgroundColor: "#f8fafc",
                      });
                      const link = document.createElement("a");
                      link.href = dataUrl;
                      link.download = `${list.title.replace(/\s+/g, "-").toLowerCase()}-mood.png`;
                      link.style.display = "none";
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      setToast({ message: "Mood board downloaded." });
                    } catch {
                      setToast({ message: "Couldn’t export this board. Try again after its images finish loading." });
                    }
                  }}
                >
                  Download mood
                </ActionItem>
              ) : null}
              {versions[0] ? (
                <ActionItem
                  icon={Undo2}
                  hint="⌘Z"
                  onClick={() => void api(`/api/lists/${list.id}/restore`, { method: "POST", body: JSON.stringify({ versionId: versions[0].id }) }).then(() => onReload())}
                >
                  Undo last version
                </ActionItem>
              ) : null}
            </div>
            <div className={toolbarMenuDividerClass}>
              <ActionItem
                icon={Trash2}
                hint="⌘⌫"
                danger
                onClick={() => {
                  if (!confirm("Remove this list from this device?")) return;
                  // Make the route and sidebar respond immediately; a failed request is
                  // reconciled from the server instead of leaving a stale list behind.
                  onDeleteList(list.id);
                  router.replace("/");
                  void api(`/api/lists/${list.id}`, { method: "DELETE" })
                    .then(async () => {
                      setToast({ message: "List removed from this device." });
                      await onReload();
                    })
                    .catch(() => {
                      setToast({ message: "Couldn’t remove that list. It was restored." });
                      void onReload();
                    });
                }}
              >
                Delete list
              </ActionItem>
            </div>
          </OverflowMenu>
        ) : null}
      </div>
      {owner ? <ShareModal list={list} open={shareOpen} onClose={() => setShareOpen(false)} onReload={onReload} /> : null}
    </>
  );
}

const STYLE_FIELD =
  "w-full appearance-none bg-slate-50/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10";

const STYLE_PILL_SELECT =
  "w-full appearance-none bg-slate-50/80 border border-slate-200/70 rounded-2xl px-4 py-2.5 pr-10 text-xs font-medium text-slate-800 outline-none transition-all focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10";

function StyleLabel({ htmlFor, children, trailing }: { htmlFor?: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      <span>{children}</span>
      {trailing}
    </label>
  );
}

function StyleSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select id={id} className={STYLE_PILL_SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
    </div>
  );
}

function resolveStyleColor(hex: string) {
  const bright = brightenPastel(hex);
  const match =
    PASTELS.find((c) => c.hex.toLowerCase() === hex.toLowerCase()) ??
    PASTELS.find((c) => c.hex.toLowerCase() === bright.toLowerCase());
  if (match) return { hex: match.hex, label: match.name, custom: false as const };
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  return { hex: normalized, label: "Custom", custom: true as const };
}

function StyleModal({ list, open, onClose, onPatch }: { list: PetalList; open: boolean; onClose: () => void; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState(list);
  const [hexDigits, setHexDigits] = useState(() => resolveStyleColor(list.color).hex.replace("#", ""));
  const [colorLabel, setColorLabel] = useState(() => resolveStyleColor(list.color).label);

  useEffect(() => {
    setDraft(list);
    const resolved = resolveStyleColor(list.color);
    setHexDigits(resolved.hex.replace("#", "").toUpperCase());
    setColorLabel(resolved.label);
  }, [list, open]);

  const activeColor = resolveStyleColor(draft.color).hex;
  const isCustomSelected = resolveStyleColor(draft.color).custom;
  const previewFont =
    draft.fontStyle === "serif" || draft.fontStyle === "script" ? "font-[family-name:var(--font-serif)]" : "";
  const previewCover = coverStyle(draft);
  const showBudget = list.type === "wish" || list.type === "shopping";

  const selectColor = (hex: string, label: string) => {
    const next = hex.startsWith("#") ? hex : `#${hex}`;
    setDraft((prev) => ({ ...prev, color: next }));
    setHexDigits(next.replace("#", "").toUpperCase());
    setColorLabel(label);
  };

  const handleHexChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexDigits(cleaned.toUpperCase());
    if (cleaned.length === 6) {
      const next = `#${cleaned}`;
      const match = PASTELS.find((c) => c.hex.toLowerCase() === next.toLowerCase());
      setDraft((prev) => ({ ...prev, color: next }));
      setColorLabel(match?.name ?? "Custom");
    }
  };

  const save = () =>
    void onPatch({
      title: draft.title,
      emoji: draft.emoji,
      color: draft.color,
      coverStyle: draft.coverStyle,
      coverImage: draft.coverImage,
      fontStyle: draft.fontStyle,
      budgetTarget: draft.budgetTarget,
    }).then(onClose);

  const budgetPreview =
    showBudget && draft.budgetTarget != null && !Number.isNaN(draft.budgetTarget)
      ? money(draft.budgetTarget, draft.currency)
      : null;

  return (
    <Modal open={open} title="Style" onClose={onClose} className="is-style max-w-3xl w-full rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-2xl overflow-hidden">
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-5">
        <div className="min-w-0 md:col-span-2">
          <p className="mb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Card Preview</p>
          <div
            className={`relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden rounded-3xl border border-white/70 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.65)] transition-all duration-300 ${previewFont}`}
            style={previewCover}
          >
            <span className="mb-2 w-fit rounded-full bg-white/75 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-slate-800 uppercase backdrop-blur-sm">
              {typeLabel(draft.type) || "List"}
            </span>
            <h3 className="truncate text-xl font-semibold tracking-tight text-slate-900 drop-shadow-sm">
              {draft.title.trim() || "Untitled list"}
            </h3>
            {budgetPreview ? (
              <p className="mt-1 truncate text-sm font-medium text-slate-700/90">Budget {budgetPreview}</p>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Live look of this list&apos;s cover on Home.
          </p>
        </div>

        <div className="min-w-0 space-y-4 md:col-span-3">
          <div>
            <StyleLabel htmlFor="style-title">Title</StyleLabel>
            <input
              id="style-title"
              className={STYLE_FIELD}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

          {showBudget ? (
            <div>
              <StyleLabel htmlFor="style-budget">Estimated budget / target ($)</StyleLabel>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  id="style-budget"
                  className={`${STYLE_FIELD} pl-7`}
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft.budgetTarget ?? ""}
                  onChange={(e) => setDraft({ ...draft, budgetTarget: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <StyleLabel
              trailing={
                <span className="normal-case tracking-normal text-[11px] font-semibold text-slate-500">{colorLabel}</span>
              }
            >
              Accent Color
            </StyleLabel>
            <div className="flex flex-wrap items-center gap-2.5">
              {PASTELS.map((c) => {
                const on = activeColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={on}
                    className={`h-7 w-7 rounded-full transition-all duration-150 ${
                      on
                        ? "scale-110 ring-2 ring-slate-900 ring-offset-2"
                        : "opacity-90 hover:scale-105 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => selectColor(c.hex, c.name)}
                  />
                );
              })}

              <label
                title="Pick custom color"
                className={`relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-all duration-150 ${
                  isCustomSelected
                    ? "scale-110 border-transparent ring-2 ring-slate-900 ring-offset-2"
                    : "border-dashed border-slate-300 bg-white/90 hover:border-slate-500 hover:bg-slate-50"
                }`}
                style={isCustomSelected ? { backgroundColor: activeColor } : undefined}
              >
                {!isCustomSelected ? (
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                ) : null}
                <input
                  type="color"
                  value={activeColor.startsWith("#") && activeColor.length === 7 ? activeColor : "#fcd34d"}
                  onChange={(e) => selectColor(e.target.value, "Custom")}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Pick custom color"
                />
              </label>
            </div>

            <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 font-mono text-[11px] text-slate-700">
              <span className="select-none text-slate-400">#</span>
              <input
                type="text"
                maxLength={6}
                value={hexDigits}
                onChange={(e) => handleHexChange(e.target.value)}
                className="w-14 bg-transparent text-[11px] uppercase outline-none"
                placeholder="FFD1DC"
                aria-label="Custom hex color"
              />
            </div>
          </div>

          <div>
            <StyleLabel htmlFor="style-pattern">Cover style</StyleLabel>
            <StyleSelect
              id="style-pattern"
              value={draft.coverStyle}
              onChange={(value) => setDraft({ ...draft, coverStyle: value as PetalList["coverStyle"] })}
            >
              <option value="solid">Solid</option>
              <option value="gradient">Subtle gradient</option>
              <option value="pattern">Minimalist pattern</option>
              <option value="image">Image</option>
            </StyleSelect>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">Updates the preview and this list&apos;s cover on Home.</p>
          </div>

          {draft.coverStyle === "image" ? (
            <div>
              <StyleLabel htmlFor="style-cover-image">Cover image</StyleLabel>
              <input
                id="style-cover-image"
                className={STYLE_FIELD}
                placeholder="Cover image URL"
                value={draft.coverImage || ""}
                onChange={(e) => setDraft({ ...draft, coverImage: e.target.value })}
              />
            </div>
          ) : null}

          <div>
            <StyleLabel htmlFor="style-font">Typography</StyleLabel>
            <StyleSelect
              id="style-font"
              value={draft.fontStyle}
              onChange={(value) => setDraft({ ...draft, fontStyle: value as PetalList["fontStyle"] })}
            >
              <option value="sans">Clean sans serif</option>
              <option value="serif">Soft serif</option>
              <option value="script">Serif accent</option>
            </StyleSelect>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl px-5 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          className="style-save-btn cursor-pointer rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-semibold !text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
          onClick={save}
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
}

function ShareModal({ list, open, onClose, onReload }: { list: PetalList; open: boolean; onClose: () => void; onReload: () => Promise<void> }) {
  const { setToast } = useApp();
  const share = list.share;
  const active = Boolean(share?.active);
  const url = active && typeof window !== "undefined" ? `${window.location.origin}/s/${share!.token}` : "";

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setToast({ message: "Link copied." });
    } catch {
      setToast({ message: "Couldn’t copy — select the link instead." });
    }
  }

  async function enableShare(permission: "view" | "edit") {
    const result = await api<{ share: { token: string; active: boolean } }>(`/api/lists/${list.id}/share`, {
      method: "POST",
      body: JSON.stringify({ permission }),
    });
    if (result.share?.token) {
      await copyLink(`${window.location.origin}/s/${result.share.token}`);
    }
    await onReload();
  }

  async function regenerateShare() {
    const result = await api<{ share: { token: string } }>(`/api/lists/${list.id}/share`, {
      method: "POST",
      body: JSON.stringify({ regenerate: true, permission: share?.permission || "view" }),
    });
    if (result.share?.token) {
      await copyLink(`${window.location.origin}/s/${result.share.token}`);
    }
    await onReload();
  }

  async function disableSharing() {
    await api(`/api/lists/${list.id}/share`, {
      method: "POST",
      body: JSON.stringify({ disable: true }),
    });
    await onReload();
  }

  return (
    <Modal open={open} title="Share this list only" onClose={onClose} className="is-share-list">
      <p className="share-list-hint">Guests see this list only — never your dashboard.</p>
      <div className="share-list-actions">
        <button
          type="button"
          className={`share-list-action${active && share?.permission === "view" ? " is-on" : ""}`}
          onClick={() => void enableShare("view")}
        >
          <span className="share-list-action-title">View only</span>
          <span className="share-list-action-meta">Browse the list</span>
        </button>
        <button
          type="button"
          className={`share-list-action${active && share?.permission === "edit" ? " is-on" : ""}`}
          onClick={() => void enableShare("edit")}
        >
          <span className="share-list-action-title">Can edit</span>
          <span className="share-list-action-meta">Add and change items</span>
        </button>
      </div>
      {active ? (
        <div className="share-list-active">
          <button
            type="button"
            className="share-list-url"
            onClick={() => void copyLink(url)}
            title="Copy link"
          >
            <span className="share-list-url-text">{url}</span>
            <Copy className="share-list-url-icon" strokeWidth={1.75} aria-hidden />
          </button>
          <div className="share-list-status">
            <span>Sharing · {share?.permission === "edit" ? "can edit" : "view only"}</span>
            <div className="share-list-secondary">
              <button type="button" className="share-list-text-btn" onClick={() => void regenerateShare()}>
                Regenerate
              </button>
              <button type="button" className="share-list-text-btn" onClick={() => void disableSharing()}>
                Disable
              </button>
            </div>
          </div>
          <Link className="share-list-preview" href={`/s/${share?.token}?preview=1`}>
            Open preview
          </Link>
        </div>
      ) : null}
    </Modal>
  );
}

function ListView({
  list,
  aggregator,
  canEdit,
  reorderable = true,
  sensors,
  sort,
  filters,
  onReorder,
  onOpen,
  onMutate,
  onReload,
}: {
  list: PetalList;
  aggregator?: boolean;
  canEdit: boolean;
  reorderable?: boolean;
  sensors: ReturnType<typeof useSensors>;
  sort: string;
  filters: { completed: string; purchased: string; priority: string; tag: string };
  onReorder: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layoutEnabled, setLayoutEnabled] = useState(true);
  const [petalBurst, setPetalBurst] = useState(0);
  const items = useMemo(() => {
    let next = [...(list.items || [])];
    if (filters.completed === "yes") next = next.filter((i) => i.completed);
    if (filters.completed === "no") next = next.filter((i) => !i.completed);
    if (filters.purchased === "yes") next = next.filter((i) => i.purchased);
    if (filters.purchased === "no") next = next.filter((i) => !i.purchased);
    if (filters.priority !== "all") next = next.filter((i) => i.priority === filters.priority);
    if (filters.tag) next = next.filter((i) => i.tags.some((t) => t.id === filters.tag));
    if (sort === "date") next.sort((a, b) => (monthKey(a) || "9999").localeCompare(monthKey(b) || "9999"));
    if (sort === "added") next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "priority") {
      const rank = { high: 0, medium: 1, low: 2, null: 3 };
      next.sort((a, b) => (rank[a.priority || "null"] ?? 3) - (rank[b.priority || "null"] ?? 3));
    }
    // Always sink completed items (stable within each group). Skip when filter already isolates one group.
    if (filters.completed === "all" && sort !== "complete") {
      const open = next.filter((i) => !i.completed);
      const done = next.filter((i) => i.completed);
      next = [...open, ...done];
    } else if (sort === "complete") {
      next.sort((a, b) => Number(a.completed) - Number(b.completed));
    }
    return next;
  }, [list.items, sort, filters]);
  const shop = list.type === "wish" || list.type === "shopping";
  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setLayoutEnabled(false);
    setActiveId(String(event.active.id));
  }

  function handleDragCancel() {
    setActiveId(null);
    requestAnimationFrame(() => setLayoutEnabled(true));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const ids = items.map((i) => i.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex >= 0 && newIndex >= 0) {
        onReorder(arrayMove(ids, oldIndex, newIndex));
      }
    }
    // Re-enable layout after the drop settles so DnD doesn't spring across the list.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLayoutEnabled(true));
    });
  }

  return (
    <section className="list-body">
      {!list.items?.length ? (
        <EmptyState
          title={aggregator ? "Nothing from your bucket lists yet" : "This list is empty"}
          body={
            aggregator
              ? "Items on Fall and your other bucket lists show up here. Archived lists stay out."
              : "Add an item above. Photos and product links will also show on the mood board."
          }
        />
      ) : !items.length ? (
        <EmptyState title="Nothing matches" body="Try another filter, or clear the tag." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <motion.div
              key={list.id}
              className="list-stack"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.03 } },
              }}
            >
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout={layoutEnabled}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0 },
                    }}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, y: -4 }}
                    transition={{
                      layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
                      opacity: { duration: 0.18, ease: "easeOut" },
                      y: { duration: 0.18, ease: "easeOut" },
                    }}
                  >
                    <SortableItem id={item.id} disabled={!canEdit || !reorderable || sort !== "custom"}>
                      {(drag) => (
                        <ItemRow
                          item={item}
                          shop={shop}
                          currency={list.currency}
                          canEdit={canEdit}
                          drag={drag}
                          onOpen={() => onOpen(item.id)}
                          onToggle={() => {
                            if (!canEdit) return;
                            if (!item.completed) setPetalBurst((current) => current + 1);
                            void onMutate("update", { itemId: item.id, patch: { completed: !item.completed } });
                          }}
                          onDelete={canEdit ? () => void onMutate("delete", { itemId: item.id }) : undefined}
                          onReload={onReload}
                        />
                      )}
                    </SortableItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem ? (
              <div className="list-drag-overlay pointer-events-none w-full">
                <ItemRow
                  item={activeItem}
                  shop={shop}
                  currency={list.currency}
                  canEdit={false}
                  onOpen={() => undefined}
                  onToggle={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      {petalBurst ? <CompletionPetalBurst key={petalBurst} /> : null}
    </section>
  );
}

function CompletionPetalBurst() {
  return (
    <div className="completion-petal-burst" aria-hidden>
      {Array.from({ length: 7 }).map((_, index) => (
        <span
          key={index}
          className="completion-petal"
          style={{
            left: `${42 + index * 3}%`,
            animationDelay: `${index * 42}ms`,
            transform: `rotate(${index % 2 ? -22 : 22}deg)`,
          }}
        />
      ))}
    </div>
  );
}

type ItemDragHandle = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  disabled?: boolean;
};

function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (drag: ItemDragHandle) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    transition: {
      duration: 80,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(isDragging ? null : transform),
    transition: isDragging ? "opacity 120ms ease" : transition,
    opacity: isDragging ? 0.22 : 1,
    position: "relative",
    touchAction: "manipulation",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "list-row-dragging" : undefined}
    >
      {children({ attributes, listeners, disabled })}
    </div>
  );
}

const secondaryActionClass =
  "opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-45";

const rowActionsClass =
  "absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-xl border border-slate-200/60 bg-white/80 px-1.5 py-1 shadow-xs backdrop-blur-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-45";

const rowActionBtnClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/90 hover:text-slate-700";

function doneChipLabel(completedAt: string | null | undefined) {
  if (!completedAt) return "Done";
  const d = new Date(completedAt);
  if (Number.isNaN(d.getTime())) return "Done";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ItemRow({
  item,
  shop,
  currency,
  canEdit,
  drag,
  onOpen,
  onToggle,
  onDelete,
  onReload,
}: {
  item: ListItem;
  shop: boolean;
  currency: string;
  canEdit?: boolean;
  drag?: ItemDragHandle;
  onOpen: () => void;
  onToggle: () => void;
  onDelete?: () => void;
  onReload?: () => Promise<void>;
}) {
  const date = monthKey(item);
  const visual = itemVisual(item);
  const [uploading, setUploading] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => {
    setThumbFailed(false);
  }, [visual]);
  const store = shop ? item.store : null;
  const price = shop && item.price != null ? money(item.price, item.currency || currency) : null;
  const meta = [store, price].filter(Boolean).join(" · ");
  const showMeta = Boolean(meta || (shop && item.purchased));
  const canDrag = Boolean(canEdit && drag && !drag.disabled);
  const monthLabel = date && !item.completed ? prettyMonth(date) : null;
  const showThumb = Boolean(visual) && !thumbFailed;
  const hasActions = Boolean((canEdit && !showThumb) || canEdit || item.productUrl || onDelete);
  const [drawStrike, setDrawStrike] = useState(false);

  useEffect(() => {
    if (!item.completed) setDrawStrike(false);
  }, [item.completed]);

  function handleToggle() {
    if (!item.completed) setDrawStrike(true);
    onToggle();
  }

  async function attachPhoto(file: File) {
    if (!onReload) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api<{ url: string; filename: string }>("/api/upload", { method: "POST", body: form });
      await api(`/api/items/${item.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ fileUrl: uploaded.url, filename: uploaded.filename, type: "image", altText: file.name, isShared: false }),
      });
      await onReload();
    } finally {
      setUploading(false);
    }
  }

  return (
    <article
      className={`list-row group relative flex min-h-[58px] items-center px-5 py-3 rounded-2xl border border-white/95 bg-white/85 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.02),inset_0_1px_1.5px_rgba(255,255,255,1)] backdrop-blur-xl transition-[transform,background-color,box-shadow,opacity,border-color] duration-150 ${
        item.completed
          ? "is-complete border-white/80 bg-white/65 shadow-none hover:bg-white/75"
          : "hover:-translate-y-0.5 hover:border-white hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.04),0_0_26px_-14px_var(--list-accent-shadow,rgba(0,0,0,0.12)),inset_0_1px_1.5px_rgba(255,255,255,1)]"
      }`}
    >
      {canDrag ? (
        <button
          type="button"
          className={`item-drag mr-1 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-400 active:cursor-grabbing ${secondaryActionClass}`}
          aria-label={`Reorder ${item.title}`}
          {...drag!.attributes}
          {...drag!.listeners}
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <ItemCheck checked={item.completed} onChange={handleToggle} label={`Mark ${item.title} complete`} />
      {showThumb ? (
        <span className="item-thumb-frame">
          <img src={visual!} alt="" onError={() => setThumbFailed(true)} />
        </span>
      ) : null}
      <button className="item-main ml-3 min-w-0 flex-1 truncate text-left" onClick={onOpen}>
        <span
          className={`item-title text-sm font-medium transition-colors duration-200 ${
            item.completed ? "is-struck text-slate-500" : "text-zinc-900"
          }`}
        >
          {item.title}
          <AnimatePresence>
            {item.completed ? <BotanicalStrike key="strike" draw={drawStrike} /> : null}
          </AnimatePresence>
        </span>
        {showMeta ? (
          <span className="item-sub flex flex-wrap items-center gap-2 text-xs font-normal text-slate-400">
            {meta ? <span>{meta}</span> : null}
            {shop && item.purchased ? (
              <span className="rounded-full border border-emerald-200/80 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 no-underline shadow-xs">
                Purchased
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <TagPills tags={item.tags} size="micro" />
        {monthLabel ? (
          <span className="petal-tag rounded-full border border-amber-200/70 bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-xs">
            {monthLabel}
          </span>
        ) : null}
        {item.completed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 px-2 py-0.5 font-mono text-[10px] text-slate-600 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--list-accent-color)]" aria-hidden />
            {doneChipLabel(item.completedAt)}
          </span>
        ) : null}
      </div>
      {hasActions ? (
        <div className={rowActionsClass}>
          {canEdit && !showThumb ? (
            <FileDropInput
              accept="image/*"
              ariaLabel="Add photo"
              className="item-add-photo p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors inline-flex items-center justify-center"
              disabled={uploading}
              onFile={(file) => void attachPhoto(file)}
            >
              <ImagePlus className="w-4 h-4 stroke-[1.75]" aria-hidden />
            </FileDropInput>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className={`item-edit ${rowActionBtnClass}`}
              aria-label={`Edit ${item.title}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {item.productUrl ? (
            <a
              className={`item-link ${rowActionBtnClass}`}
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.title} link`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className={`item-remove ${rowActionBtnClass} hover:bg-rose-50 hover:text-rose-500`}
              aria-label={`Remove ${item.title}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ItemCheck({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      className={`item-check flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[background-color,border-color,box-shadow] duration-150 ${
        checked
          ? "is-on border-[var(--list-accent-color)] bg-[var(--list-accent-color)] text-zinc-950 shadow-sm"
          : "border-zinc-300 bg-white/80 hover:border-zinc-400"
      }`}
      style={
        checked
          ? {
              backgroundColor: "var(--list-accent-color)",
              borderColor: "var(--list-accent-color)",
            }
          : undefined
      }
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      whileTap={{ scale: 0.92 }}
    >
      <motion.span
        className="flex h-3 w-3 items-center justify-center"
        initial={false}
        animate={checked ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 28, mass: 0.6, duration: 0.15 }}
      >
        <Check className="h-3 w-3 text-zinc-950" strokeWidth={2.5} aria-hidden />
      </motion.span>
    </motion.button>
  );
}

function BotanicalStrike({ draw = false, className = "" }: { draw?: boolean; className?: string }) {
  return (
    <motion.svg
      className={`botanical-strike${draw ? " is-striking" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      aria-hidden
      initial={false}
      exit={{ opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }}
    >
      <motion.path
        d="M 0 7 Q 18 2.2, 36 7 T 72 7 Q 90 11.5, 108 7 T 144 7 Q 162 2.5, 180 7 T 200 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        exit={{ pathLength: 0, transition: { duration: 0.28, ease: "easeIn" } }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      />
      {[40, 96, 152].map((x, index) => (
        <motion.path
          key={x}
          d={`M ${x} 7 C ${x - 4.5} 1.5, ${x - 8} 1.2, ${x - 6.5} 5.5 C ${x - 5} 9.2, ${x - 1.2} 9.5, ${x} 7 Z`}
          fill="currentColor"
          initial={draw ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 0.82, opacity: 0.62 }}
          exit={{ opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
          transition={
            draw
              ? { type: "spring", stiffness: 380, damping: 18, delay: 0.22 + index * 0.07 }
              : { duration: 0 }
          }
          style={{ transformOrigin: `${x}px 7px` }}
        />
      ))}
    </motion.svg>
  );
}

function Composer({
  list,
  defaultTags = [],
  onCreate,
}: {
  list: PetalList;
  defaultTags?: Tag[];
  onCreate: (item: Partial<ListItem> & { title: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const canAdd = Boolean(title.trim() || url.trim());
  const dayHint = defaultTags[0]?.name;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
      const titleEl = titleRef.current;
      const form = titleEl?.form;
      const inComposer = Boolean(form && target && form.contains(target));

      if (event.key === "Escape" && inComposer) {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        titleEl?.focus();
        titleEl?.select();
        return;
      }

      if (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        titleEl?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function add() {
    if (!title.trim() && !url.trim()) return;
    const name = title.trim();
    const linkField = url.trim();
    const titleIsOnlyUrl = !linkField && /^https?:\/\//i.test(name);
    const link = linkField || (titleIsOnlyUrl ? name : "");
    // Prefer the typed name; only fall back to scraped/default titles when the main field is empty or is itself the URL.
    const preferredTitle = titleIsOnlyUrl ? "" : name;

    let extra: Partial<ListItem> = {};
    if (link) {
      if (looksLikeImageUrl(link)) {
        // Direct image URL → item photo (createItem attaches importedMetadata.image).
        extra = {
          productUrl: null,
          importedMetadata: { image: link, url: link, isImage: true },
        };
      } else {
        const meta = await api<{ metadata: Record<string, unknown>; warning?: string }>("/api/metadata", {
          method: "POST",
          body: JSON.stringify({ url: link }),
        });
        const resolved = String(meta.metadata.url || link);
        const image = typeof meta.metadata.image === "string" ? meta.metadata.image : "";
        const linkIsImage = meta.metadata.isImage === true || looksLikeImageUrl(resolved);

        if (linkIsImage) {
          extra = {
            productUrl: null,
            importedMetadata: { ...meta.metadata, image: image || resolved, isImage: true },
          };
        } else {
          extra = {
            productUrl: resolved,
            store: meta.metadata.store ? String(meta.metadata.store) : null,
            price: typeof meta.metadata.price === "number" ? meta.metadata.price : null,
            currency: meta.metadata.currency ? String(meta.metadata.currency) : list.currency,
            notes: meta.metadata.description ? String(meta.metadata.description) : null,
            importedMetadata: meta.metadata,
          };
        }
      }
    }

    const fallbackTitle =
      (typeof extra.importedMetadata?.title === "string" && extra.importedMetadata.title) ||
      (looksLikeImageUrl(link) ? "Photo" : "Saved link");
    onCreate({
      ...extra,
      title: preferredTitle || fallbackTitle,
      productUrl: extra.productUrl ?? null,
      ...(defaultTags.length ? { tags: defaultTags } : {}),
    });
    setTitle("");
    setUrl("");
    titleRef.current?.focus();
  }

  return (
    <form
      className="composer group/dock mb-4 mt-0 flex items-center gap-2 outline-none focus-within:outline-none"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <div className="composer-fields">
        <div className="composer-title-wrap group/field relative min-w-0 flex-1">
          <input
            ref={titleRef}
            className="composer-input w-full border-0 bg-transparent py-2.5 pl-3.5 pr-10 text-sm font-medium text-slate-800 shadow-none outline-none ring-0 placeholder:font-medium placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            placeholder={dayHint ? `Add for ${dayHint}... (press /)` : "Add an item... (press /)"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          <kbd className="composer-kbd pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/90 bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,1)] backdrop-blur-sm transition-opacity duration-200 group-focus-within/dock:opacity-0">
            /
          </kbd>
        </div>
        <div className="composer-url-wrap w-0 overflow-hidden opacity-0 transition-all duration-200 group-focus-within/dock:w-44 group-focus-within/dock:opacity-100">
          <input
            className="composer-input composer-url w-full min-w-[11rem] border-0 bg-transparent px-3 py-2.5 text-sm font-medium text-slate-800 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            placeholder="Link (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>
      <button
        className={`composer-add rounded-xl border border-transparent shadow-none transition-all duration-150 active:scale-95 ${
          canAdd
            ? "is-ready bg-slate-900 !text-white hover:bg-slate-800"
            : "is-empty bg-slate-200 text-slate-400"
        }`}
        type="submit"
        disabled={!canAdd}
      >
        Add
      </button>
    </form>
  );
}

function moodPrice(item: ListItem, currency: string) {
  return item.price != null ? money(item.price, item.currency || currency) : null;
}

const MOOD_MIN = 112;
const MOOD_DEFAULT_W = 168;
const MOOD_GAP = 12;
const MOOD_SNAP = 8;
const MOOD_PAD = 8;
/** Heal saved layouts that intersect more than this fraction of the smaller tile. */
const MOOD_HEAL_OVERLAP = 0.08;

type MoodResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function moodAspectRatio(index: number) {
  const ratios = [4 / 5, 3 / 4, 1, 5 / 6, 2 / 3];
  return ratios[index % ratios.length];
}

function snapMood(n: number) {
  return Math.round(n / MOOD_SNAP) * MOOD_SNAP;
}

function clampMoodRect(rect: MoodLayout, boardW: number): MoodLayout {
  const w = Math.max(MOOD_MIN, rect.w);
  const h = Math.max(MOOD_MIN, rect.h);
  const maxX = Math.max(0, boardW - w);
  return {
    x: Math.min(Math.max(0, rect.x), maxX),
    y: Math.max(0, rect.y),
    w,
    h,
  };
}

function moodRectsOverlap(a: MoodLayout, b: MoodLayout, gap = 0) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function moodOverlapRatio(a: MoodLayout, b: MoodLayout) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const area = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (area <= 0) return 0;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? area / smaller : 0;
}

/** Push `moving` away from `obstacle` along the shortest AABB axis, keeping `gap`. */
function separateMoodRect(moving: MoodLayout, obstacle: MoodLayout, gap: number): MoodLayout {
  const moveRight = obstacle.x + obstacle.w + gap - moving.x;
  const moveLeft = moving.x + moving.w + gap - obstacle.x;
  const moveDown = obstacle.y + obstacle.h + gap - moving.y;
  const moveUp = moving.y + moving.h + gap - obstacle.y;
  const options = [
    { dx: moveRight, dy: 0, cost: Math.abs(moveRight) },
    { dx: -moveLeft, dy: 0, cost: Math.abs(moveLeft) },
    { dx: 0, dy: moveDown, cost: Math.abs(moveDown) },
    { dx: 0, dy: -moveUp, cost: Math.abs(moveUp) },
  ].sort((a, b) => a.cost - b.cost || Math.abs(b.dy) - Math.abs(a.dy) || b.dx - a.dx);
  const best = options[0];
  return { ...moving, x: moving.x + best.dx, y: moving.y + best.dy };
}

function findFreeMoodSlot(w: number, h: number, occupied: MoodLayout[], boardW: number, gap = MOOD_GAP): MoodLayout {
  const width = Math.max(boardW, MOOD_DEFAULT_W + MOOD_PAD * 2);
  const size = clampMoodRect({ x: 0, y: 0, w, h }, width);
  const bottom = occupied.reduce((max, rect) => Math.max(max, rect.y + rect.h), MOOD_PAD);
  const maxY = bottom + size.h + gap + MOOD_PAD;
  for (let y = MOOD_PAD; y <= maxY; y += MOOD_SNAP) {
    for (let x = MOOD_PAD; x + size.w <= width - MOOD_PAD + MOOD_SNAP; x += MOOD_SNAP) {
      const candidate = clampMoodRect({ x, y, w: size.w, h: size.h }, width);
      if (!occupied.some((rect) => moodRectsOverlap(candidate, rect, gap))) return candidate;
    }
  }
  return clampMoodRect({ x: MOOD_PAD, y: bottom + gap, w: size.w, h: size.h }, width);
}

function resolveMoodCollisions(
  id: string,
  rect: MoodLayout,
  all: Record<string, MoodLayout>,
  boardW: number,
  gap = MOOD_GAP,
): MoodLayout {
  let next = clampMoodRect(rect, boardW);
  for (let iter = 0; iter < 16; iter++) {
    let hit: MoodLayout | null = null;
    for (const [otherId, other] of Object.entries(all)) {
      if (otherId === id) continue;
      if (moodRectsOverlap(next, other, gap)) {
        hit = other;
        break;
      }
    }
    if (!hit) return next;
    next = clampMoodRect(separateMoodRect(next, hit, gap), boardW);
    if (moodRectsOverlap(next, hit, gap)) {
      next = clampMoodRect({ ...next, y: hit.y + hit.h + gap }, boardW);
    }
  }
  const others = Object.entries(all)
    .filter(([otherId]) => otherId !== id)
    .map(([, other]) => other);
  if (others.some((other) => moodRectsOverlap(next, other, gap))) {
    return findFreeMoodSlot(next.w, next.h, others, boardW, gap);
  }
  return next;
}

function packMoodDefaults(
  ids: string[],
  boardW: number,
  seed: Record<string, MoodLayout | null | undefined>,
): { rects: Record<string, MoodLayout>; healedIds: string[] } {
  const width = Math.max(boardW, MOOD_DEFAULT_W + MOOD_PAD * 2);
  const next: Record<string, MoodLayout> = {};
  const healedIds: string[] = [];

  ids.forEach((id, index) => {
    const saved = seed[id];
    const placed = Object.values(next);
    const hasSaved =
      saved &&
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y) &&
      saved.w >= MOOD_MIN &&
      saved.h >= MOOD_MIN;

    if (hasSaved) {
      const candidate = clampMoodRect(saved, width);
      const intersects = placed.some(
        (other) => moodRectsOverlap(candidate, other, 0) && moodOverlapRatio(candidate, other) > MOOD_HEAL_OVERLAP,
      );
      if (!intersects) {
        next[id] = candidate;
        return;
      }
      next[id] = findFreeMoodSlot(candidate.w, candidate.h, placed, width);
      healedIds.push(id);
      return;
    }

    const w = MOOD_DEFAULT_W;
    const h = Math.round(w / moodAspectRatio(index));
    next[id] = findFreeMoodSlot(w, h, placed, width);
  });

  return { rects: next, healedIds };
}

function moodGhostSlot(rects: MoodLayout[], boardW: number): MoodLayout {
  const width = Math.max(boardW, MOOD_DEFAULT_W + MOOD_PAD * 2);
  const size = rects.length ? MOOD_DEFAULT_W : Math.min(220, Math.max(MOOD_DEFAULT_W, width - MOOD_PAD * 2));
  const h = rects.length ? size : Math.round(size * (4 / 3));
  return findFreeMoodSlot(size, h, rects, width);
}

function moodLayoutEqual(a: MoodLayout | null | undefined, b: MoodLayout | null | undefined) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function moodBoardHeight(rects: Record<string, MoodLayout>) {
  let max = 320;
  for (const rect of Object.values(rects)) max = Math.max(max, rect.y + rect.h + MOOD_PAD * 2);
  return max;
}

function MoodBoard({
  list,
  canEdit,
  tagFilter = "",
  onOpen,
  onMutate,
  onReload,
}: {
  list: PetalList;
  canEdit: boolean;
  tagFilter?: string;
  onOpen: (id: string) => void;
  onMutate: (a: string, p: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const pinElsRef = useRef<Record<string, HTMLElement | null>>({});
  const [boardW, setBoardW] = useState(640);
  const boardWRef = useRef(boardW);
  const [rects, setRects] = useState<Record<string, MoodLayout>>({});
  const rectsRef = useRef(rects);
  const pendingLayoutsRef = useRef<Record<string, MoodLayout>>({});
  const [zOrder, setZOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    edge?: MoodResizeEdge;
    pointerId: number;
    startX: number;
    startY: number;
    origin: MoodLayout;
    moved: boolean;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const liveRectRef = useRef<{ id: string; rect: MoodLayout } | null>(null);
  const onOpenRef = useRef(onOpen);
  const onMutateRef = useRef(onMutate);
  const canEditRef = useRef(canEdit);
  const gestureBoundRef = useRef(false);
  const paintPinRef = useRef<(id: string, rect: MoodLayout) => void>(() => {});
  const scheduleLiveRectRef = useRef<(id: string, rect: MoodLayout) => void>(() => {});
  const endGestureRef = useRef<(id: string, openIfClick: boolean) => void>(() => {});
  const gestureListenersRef = useRef<{ move: (event: PointerEvent) => void; up: (event: PointerEvent) => void } | null>(null);
  const layoutFromPointerRef = useRef<
    (drag: NonNullable<typeof dragRef.current>, clientX: number, clientY: number) => MoodLayout | null
  >(() => null);

  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);

  useEffect(() => {
    boardWRef.current = boardW;
  }, [boardW]);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    onMutateRef.current = onMutate;
  }, [onMutate]);

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  const visuals = [...(list.items || [])]
    .filter((item) => itemVisual(item) && !item.hiddenFromMoodBoard)
    .filter((item) => !tagFilter || item.tags.some((t) => t.id === tagFilter))
    .sort((a, b) => a.moodOrder - b.moodOrder);

  const visualKey = visuals.map((item) => `${item.id}:${item.moodLayout ? `${item.moodLayout.x},${item.moodLayout.y},${item.moodLayout.w},${item.moodLayout.h}` : "auto"}`).join("|");

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const apply = () => setBoardW(Math.max(280, Math.floor(node.clientWidth)));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (activeId || dragRef.current) return;
    const ids = visuals.map((item) => item.id);
    const seed: Record<string, MoodLayout | null | undefined> = {};
    for (const item of visuals) {
      const pending = pendingLayoutsRef.current[item.id];
      if (pending) {
        seed[item.id] = pending;
        if (moodLayoutEqual(item.moodLayout, pending)) delete pendingLayoutsRef.current[item.id];
      } else {
        seed[item.id] = item.moodLayout;
      }
    }
    for (const id of Object.keys(pendingLayoutsRef.current)) {
      if (!ids.includes(id)) delete pendingLayoutsRef.current[id];
    }
    const { rects: packed, healedIds } = packMoodDefaults(ids, boardW, seed);
    setRects(packed);
    rectsRef.current = packed;
    if (canEditRef.current) {
      for (const id of healedIds) {
        const layout = packed[id];
        if (!layout) continue;
        pendingLayoutsRef.current[id] = layout;
        void onMutateRef.current("update", { itemId: id, patch: { moodLayout: layout } });
      }
    }
    setZOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [visualKey, boardW, activeId]);

  const boardH = moodBoardHeight(rects);

  function paintPin(id: string, rect: MoodLayout) {
    const el = pinElsRef.current[id];
    if (!el) return;
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
  }
  paintPinRef.current = paintPin;

  function syncBoardMinHeight() {
    const node = boardRef.current;
    if (!node) return;
    node.style.minHeight = `${moodBoardHeight(rectsRef.current)}px`;
  }

  function scheduleLiveRect(id: string, rect: MoodLayout) {
    rectsRef.current = { ...rectsRef.current, [id]: rect };
    liveRectRef.current = { id, rect };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const live = liveRectRef.current;
      if (!live) return;
      paintPinRef.current(live.id, live.rect);
      syncBoardMinHeight();
    });
  }
  scheduleLiveRectRef.current = scheduleLiveRect;

  function flushLiveRect() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const live = liveRectRef.current;
    if (live) {
      paintPinRef.current(live.id, live.rect);
      liveRectRef.current = null;
    }
    syncBoardMinHeight();
  }

  async function addPhoto(file: File) {
    setAdding("Adding…");
    const slot = moodGhostSlot(Object.values(rectsRef.current), boardWRef.current);
    try {
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Photo";
      const created = await api<{ list: PetalList }>(`/api/lists/${list.id}/items`, {
        method: "POST",
        body: JSON.stringify({ title, moodLayout: slot }),
      });
      const known = new Set((list.items || []).map((item) => item.id));
      const newest = (created.list.items || []).find((item) => !known.has(item.id)) || created.list.items?.at(-1);
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api<{ url: string; filename: string }>("/api/upload", { method: "POST", body: form });
      if (newest) {
        await api(`/api/items/${newest.id}/attachments`, {
          method: "POST",
          body: JSON.stringify({ fileUrl: uploaded.url, filename: uploaded.filename, type: "image", altText: file.name, isShared: false }),
        });
        if (!newest.moodLayout) {
          await api(`/api/items/${newest.id}`, {
            method: "PATCH",
            body: JSON.stringify({ moodLayout: slot }),
          });
        }
      }
      await onReload();
      setAdding("");
    } catch (err) {
      setAdding(err instanceof Error ? err.message : "That photo didn’t save.");
    }
  }

  function bringForward(id: string) {
    setZOrder((prev) => [...prev.filter((entry) => entry !== id), id]);
  }

  function persistLayout(id: string, layout: MoodLayout) {
    pendingLayoutsRef.current[id] = layout;
    void onMutate("update", { itemId: id, patch: { moodLayout: layout } });
  }

  function layoutFromPointer(drag: NonNullable<typeof dragRef.current>, clientX: number, clientY: number): MoodLayout | null {
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (!drag.moved && dx * dx + dy * dy < 16) return null;
    drag.moved = true;
    const o = drag.origin;
    let next: MoodLayout;
    if (drag.mode === "move") {
      next = { ...o, x: o.x + dx, y: o.y + dy };
    } else {
      const edge = drag.edge || "se";
      let { x, y, w, h } = o;
      if (edge.includes("e")) w = o.w + dx;
      if (edge.includes("s")) h = o.h + dy;
      if (edge.includes("w")) {
        w = o.w - dx;
        x = o.x + dx;
      }
      if (edge.includes("n")) {
        h = o.h - dy;
        y = o.y + dy;
      }
      if (w < MOOD_MIN) {
        if (edge.includes("w")) x = o.x + o.w - MOOD_MIN;
        w = MOOD_MIN;
      }
      if (h < MOOD_MIN) {
        if (edge.includes("n")) y = o.y + o.h - MOOD_MIN;
        h = MOOD_MIN;
      }
      next = { x, y, w, h };
    }
    return clampMoodRect(next, boardWRef.current);
  }
  layoutFromPointerRef.current = layoutFromPointer;

  function unbindGestureListeners() {
    const bound = gestureListenersRef.current;
    if (!bound || !gestureBoundRef.current) return;
    window.removeEventListener("pointermove", bound.move);
    window.removeEventListener("pointerup", bound.up);
    window.removeEventListener("pointercancel", bound.up);
    gestureListenersRef.current = null;
    gestureBoundRef.current = false;
  }

  function bindGestureListeners() {
    if (gestureBoundRef.current) return;
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const next = layoutFromPointerRef.current(drag, event.clientX, event.clientY);
      if (!next) return;
      scheduleLiveRectRef.current(drag.id, next);
    };
    const up = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endGestureRef.current(drag.id, true);
    };
    gestureListenersRef.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    gestureBoundRef.current = true;
  }

  function endGesture(id: string, openIfClick: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    unbindGestureListeners();
    flushLiveRect();
    dragRef.current = null;
    if (!drag.moved) {
      setActiveId(null);
      if (openIfClick) onOpenRef.current(id);
      return;
    }
    const raw = rectsRef.current[id] || drag.origin;
    const snapped = clampMoodRect(
      { x: snapMood(raw.x), y: snapMood(raw.y), w: snapMood(raw.w), h: snapMood(raw.h) },
      boardWRef.current,
    );
    const resolved = resolveMoodCollisions(id, snapped, rectsRef.current, boardWRef.current);
    rectsRef.current = { ...rectsRef.current, [id]: resolved };
    paintPinRef.current(id, resolved);
    setRects({ ...rectsRef.current });
    persistLayout(id, resolved);
    setActiveId(null);
  }
  endGestureRef.current = endGesture;

  useEffect(
    () => () => {
      unbindGestureListeners();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function beginGesture(
    event: ReactPointerEvent,
    id: string,
    mode: "move" | "resize",
    edge?: MoodResizeEdge,
  ) {
    const origin = rectsRef.current[id];
    if (!origin) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    bringForward(id);
    setActiveId(id);
    dragRef.current = {
      id,
      mode,
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...origin },
      moved: false,
    };
    bindGestureListeners();
  }

  function onPinPointerDown(event: ReactPointerEvent, id: string) {
    if (!canEdit || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-mood-chrome]")) return;
    beginGesture(event, id, "move");
  }

  function onResizePointerDown(event: ReactPointerEvent, id: string, edge: MoodResizeEdge) {
    if (!canEdit || event.button !== 0) return;
    event.stopPropagation();
    beginGesture(event, id, "resize", edge);
  }

  const orderedVisuals = [...visuals].sort((a, b) => {
    const ai = zOrder.indexOf(a.id);
    const bi = zOrder.indexOf(b.id);
    return (ai < 0 ? 0 : ai) - (bi < 0 ? 0 : bi);
  });

  return (
    <section className="list-body mood-body">
      <div className="mood-board-frame">
        {canEdit ? (
          <FileDropInput
            accept="image/*"
            ariaLabel="Add a photo to the mood board"
            className="mood-ghost mood-ghost-dock"
            disabled={Boolean(adding)}
            onFile={(file) => void addPhoto(file)}
          >
            <span className="mood-ghost-icon" aria-hidden>
              <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span>{adding || "Add a photo"}</span>
          </FileDropInput>
        ) : null}
        <div
          id="mood-export"
          ref={boardRef}
          className={`mood-board mood-board-freeform${activeId ? " is-interacting" : ""}`}
          style={{ minHeight: boardH }}
        >
          {orderedVisuals.map((item) => {
            const title = item.title.trim() || "Untitled";
            const price = moodPrice(item, list.currency);
            const rect =
              (activeId === item.id ? rectsRef.current[item.id] : undefined) || rects[item.id];
            if (!rect) return null;
            const z = Math.max(1, zOrder.indexOf(item.id) + 1);
            return (
              <article
                key={item.id}
                ref={(node) => {
                  pinElsRef.current[item.id] = node;
                }}
                className={`mood-pin group${activeId === item.id ? " is-active" : ""}${canEdit ? " is-editable" : ""}`}
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  zIndex: activeId === item.id ? 40 : z,
                }}
                onPointerDown={(event) => onPinPointerDown(event, item.id)}
              >
                <button
                  type="button"
                  className="mood-tile"
                  tabIndex={canEdit ? -1 : 0}
                  onClick={(event) => {
                    if (canEdit) {
                      event.preventDefault();
                      return;
                    }
                    onOpen(item.id);
                  }}
                  aria-label={title}
                >
                  <img src={itemVisual(item)!} alt={title} draggable={false} className="h-full w-full rounded-2xl object-cover" />
                </button>
                {item.tags.length ? (
                  <div className="mood-tag-badges" aria-hidden>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className={`mood-tag-chip mood-tag-${tagFilterTone(tag.name)}`}>
                        <span
                          className="mood-tag-dot"
                          style={tagFilterTone(tag.name) === "neutral" ? { background: tag.color } : undefined}
                        />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mood-caption" data-mood-chrome>
                  <span className="mood-caption-title">{title}</span>
                  <span className="mood-caption-meta">
                    {price ? <span className="mood-caption-price">{price}</span> : null}
                    {canEdit ? (
                      <span
                        className="mood-hide"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onMutate("update", { itemId: item.id, patch: { hiddenFromMoodBoard: true } });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            void onMutate("update", { itemId: item.id, patch: { hiddenFromMoodBoard: true } });
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        Hide
                      </span>
                    ) : null}
                  </span>
                </div>
                {canEdit ? (
                  <>
                    {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as MoodResizeEdge[]).map((edge) => (
                      <span
                        key={edge}
                        data-mood-chrome
                        className={`mood-resize mood-resize-${edge}`}
                        onPointerDown={(event) => onResizePointerDown(event, item.id, edge)}
                      />
                    ))}
                  </>
                ) : null}
              </article>
            );
          })}
          {!visuals.length && (!canEdit || Boolean(tagFilter)) ? (
            <div className="mood-empty">
              <EmptyState
                title={tagFilter ? "Nothing matches this tag" : "Nothing on the board"}
                body={
                  tagFilter
                    ? "Try another tag, or clear the filter to see the full mood board."
                    : "Add a photo or product image to an item. Hidden visuals stay on the list."
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function listToCsv(list: PetalList) {
  const shop = isShopType(list.type);
  const headers = shop
    ? ["Title", "Store", "Price", "Currency", "Purchased", "Completed", "Priority", "Tags", "Notes", "Link", "Date"]
    : ["Title", "Completed", "Priority", "Tags", "Season", "Notes", "Link", "Date"];
  const rows = (list.items || []).map((item) => {
    const tags = item.tags.map((tag) => tag.name).join("; ");
    const date = item.targetDate || item.targetMonth || item.completedAt || "";
    if (shop) {
      return [
        item.title,
        item.store,
        item.price,
        item.currency || "USD",
        item.purchased ? "yes" : "no",
        item.completed ? "yes" : "no",
        item.priority || "",
        tags,
        item.notes,
        item.productUrl,
        date,
      ].map(csvCell).join(",");
    }
    return [
      item.title,
      item.completed ? "yes" : "no",
      item.priority || "",
      tags,
      item.season || "",
      item.notes,
      item.productUrl,
      date,
    ].map(csvCell).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function timelineGroupKey(item: ListItem, preferSeason: boolean) {
  const month = monthKey(item);
  if (month) return `month:${month}`;
  if (preferSeason && item.season) return `season:${normalizeSeason(item.season)}`;
  if (item.season) return `season:${normalizeSeason(item.season)}`;
  if (item.createdAt) return `month:${item.createdAt.slice(0, 7)}`;
  return "undated";
}

function timelineGroupLabel(key: string) {
  if (key === "undated") return "Someday";
  if (key.startsWith("season:")) return seasonLabel(key.slice(7)) || "Season";
  if (key.startsWith("month:")) {
    const month = key.slice(6);
    const date = new Date(`${month}-01T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return prettyMonth(month) || month;
  }
  return key;
}

function timelineSortKeys(keys: string[]) {
  const seasonRank = ["spring", "summer", "fall", "winter"];
  return keys.slice().sort((a, b) => {
    if (a === "undated") return 1;
    if (b === "undated") return -1;
    const aSeason = a.startsWith("season:");
    const bSeason = b.startsWith("season:");
    const aMonth = a.startsWith("month:");
    const bMonth = b.startsWith("month:");
    if (aMonth && bMonth) return a.localeCompare(b);
    // A dated timeline should read forward in time; seasons remain a gentle
    // home for ideas that have not been assigned a specific month yet.
    if (aMonth !== bMonth) return aMonth ? -1 : 1;
    if (aSeason && bSeason) {
      return seasonRank.indexOf(a.slice(7)) - seasonRank.indexOf(b.slice(7));
    }
    if (aSeason !== bSeason) return aSeason ? -1 : 1;
    return a.localeCompare(b);
  });
}

function timelineDateChip(item: ListItem) {
  if (item.targetDate) {
    try {
      return new Date(`${item.targetDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
    } catch {
      return item.targetDate;
    }
  }
  if (item.targetMonth) return (prettyMonth(item.targetMonth) || item.targetMonth).toUpperCase();
  if (item.season) return (seasonLabel(item.season) || item.season).toUpperCase();
  if (item.createdAt) {
    try {
      return new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", year: "2-digit" }).toUpperCase();
    } catch {
      return null;
    }
  }
  return null;
}

function TimelineLeaf({
  completed = false,
  className = "",
  style,
}: {
  completed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (completed) {
    return <TimelineBloom className={className} style={style} />;
  }
  return (
    <span className={`timeline-bud ${className}`.trim()} style={style} aria-hidden>
      <svg viewBox="0 0 20 20" className="timeline-leaf-art">
        <path
          d="M 10 16 C 10 10, 14 6, 17 5 C 17 10, 14 14, 10 16 Z"
          fill="currentColor"
          opacity="0.72"
        />
        <circle cx="10" cy="16" r="1.5" fill="currentColor" opacity="0.9" />
      </svg>
    </span>
  );
}

function TimelineBloom({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`timeline-bloom ${className}`.trim()} style={style} aria-hidden>
      <svg viewBox="0 0 24 24" className="timeline-bloom-art">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx="12" cy="7" rx="2.5" ry="4" fill="currentColor" transform={`rotate(${angle} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="2.5" fill="#fef08a" />
      </svg>
    </span>
  );
}

function TimelineVine({ id }: { id: string }) {
  const gradientId = `timeline-vine-${id}`;
  return (
    <svg className="timeline-vine" viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--list-accent-color, #fbbf24)" stopOpacity="0.76" />
          <stop offset="52%" stopColor="var(--list-accent-color, #fbbf24)" stopOpacity="0.52" />
          <stop offset="100%" stopColor="var(--list-accent-color, #fbbf24)" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path d="M12 0C4 10 20 22 12 34S4 58 12 70s8 20 0 30" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.45" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

function TimelinePetalStamp({ children }: { children: React.ReactNode }) {
  return <span className="timeline-petal-stamp">{children}</span>;
}

function PressedFlowerWatermark() {
  return (
    <svg className="timeline-pressed-flower" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 23V10" />
      <path d="M12 17c-3.5-1.8-5-3.8-5.2-6.5 3.1 0 4.9 1.8 5.2 4.4" />
      <path d="M12 14c3.5-1.4 5.1-3.6 5.2-6.2-3.1-.3-4.8 1.4-5.2 4" />
      <path d="M12 10c-2.1 0-3.8-1.7-3.8-3.8S9.9 2.4 12 4.7c2.1-2.3 3.8-.6 3.8 1.5S14.1 10 12 10Z" />
    </svg>
  );
}

function TimelineAmbientPetals() {
  return (
    <div className="timeline-ambient" aria-hidden>
      <span className="timeline-ambient-petal is-top" />
      <span className="timeline-ambient-petal is-mid" />
      <span className="timeline-ambient-petal is-bottom" />
    </div>
  );
}

function Timeline({ list, canEdit, onOpen, onMutate }: { list: PetalList; canEdit: boolean; onOpen: (id: string) => void; onMutate: (a: string, p: Record<string, unknown>) => Promise<void> }) {
  const preferSeason = list.type === "bucket";
  const groups = new Map<string, ListItem[]>();
  for (const item of list.items || []) {
    const key = timelineGroupKey(item, preferSeason);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const keys = timelineSortKeys(Array.from(groups.keys()));

  return (
    <section className="timeline-root relative mt-2">
      <TimelineAmbientPetals />
      <TimelineVine id={list.id} />
      {!keys.length ? (
        <EmptyState title="No dates yet" body="Add a month or season to an item and it will land on this timeline." />
      ) : null}
      <div className="timeline-stage relative z-[1]">
        {keys.map((key) => {
          const isSeason = key.startsWith("season:");
          const items = [...(groups.get(key) || [])].sort((a, b) => {
            const aDate = a.targetDate || a.targetMonth || a.createdAt || "9999-12-31";
            const bDate = b.targetDate || b.targetMonth || b.createdAt || "9999-12-31";
            return aDate.localeCompare(bDate);
          });
          const dropMonth = key.startsWith("month:") ? key.slice(6) : null;
          const dropSeason = isSeason ? key.slice(7) : null;
          return (
            <div
              key={key}
              className="timeline-group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (!id || !canEdit) return;
                if (dropMonth && /^\d{4}-\d{2}$/.test(dropMonth)) {
                  void onMutate("update", { itemId: id, patch: { targetMonth: dropMonth, targetDate: null, season: null } });
                } else if (dropSeason) {
                  void onMutate("update", { itemId: id, patch: { season: dropSeason, targetMonth: null } });
                }
              }}
            >
              <div className="timeline-group-heading">
                <span className="timeline-group-marker">
                  <TimelineLeaf completed={isSeason} className={isSeason ? "timeline-group-leaf is-season" : "timeline-group-leaf"} />
                </span>
                <div className="min-w-0">
                  <span className="timeline-group-kicker">{isSeason ? "Seasonal chapter" : key === "undated" ? "Unscheduled" : "On the calendar"}</span>
                  <h3 className="timeline-group-title">{timelineGroupLabel(key)}</h3>
                </div>
              </div>
              <div className="timeline-items">
                {items.map((item) => {
                  const visual = itemVisual(item);
                  const chip = timelineDateChip(item);
                  return (
                    <div key={item.id} className="timeline-item">
                      <span className="timeline-item-marker">
                        <TimelineLeaf completed={item.completed} className="timeline-item-leaf" />
                      </span>
                      <button
                        type="button"
                        draggable={canEdit}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                        onClick={() => onOpen(item.id)}
                        className={`timeline-entry group ${item.completed ? "is-timeline-complete" : ""}`}
                      >
                        <span className="timeline-entry-content">
                          <span className="timeline-entry-top">
                            {chip ? <TimelinePetalStamp>{chip}</TimelinePetalStamp> : null}
                            <span className="timeline-entry-state">{item.completed ? "Done" : "Planned"}</span>
                          </span>
                          <span className={`timeline-card-title relative inline-block max-w-full ${item.completed ? "is-complete" : ""}`}>
                            {item.title}
                            {item.completed ? <BotanicalStrike /> : null}
                          </span>
                          {item.notes ? <span className="timeline-entry-note">{item.notes}</span> : null}
                        </span>
                        {visual ? <img src={visual} alt="" className="timeline-card-media" /> : null}
                        <ChevronRight className="timeline-entry-chevron" strokeWidth={1.75} aria-hidden />
                        {!visual ? <PressedFlowerWatermark /> : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function memoryDateFor(item: ListItem): Date | null {
  // A deliberate date is the source of truth; completion/photo timestamps are only fallbacks.
  const raw = item.targetDate || item.completedAt || item.attachments.find((att) => att.type === "image")?.uploadedAt || item.createdAt;
  if (!raw) return null;
  const dt = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function memoryPhotos(item: ListItem): string[] {
  const fromAtt = item.attachments
    .filter((att) => att.type === "image" && Boolean(att.fileUrl))
    .map((att) => att.fileUrl);
  const visual = itemVisual(item);
  if (visual && !fromAtt.includes(visual)) return [visual, ...fromAtt];
  return fromAtt.length ? fromAtt : visual ? [visual] : [];
}

const MEMORY_NOTE_ICONS = [Sparkles, BookOpen, Heart, Coffee] as const;

function memoryNoteIconFor(seed: string): LucideIcon {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % MEMORY_NOTE_ICONS.length;
  return MEMORY_NOTE_ICONS[hash] || Sparkles;
}

function MemoryNoteIcon({ seed = "note", className = "" }: { seed?: string; className?: string }) {
  const Icon = memoryNoteIconFor(seed);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border border-amber-200/60 bg-amber-50/80 text-amber-600 ${className}`.trim()}
      aria-hidden
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

function MemoryThumb({
  src,
  className = "",
  seed,
}: {
  src?: string | null;
  className?: string;
  seed?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const showImage = typeof src === "string" && src.trim().length > 0 && !failed;

  return (
    <span className={`block overflow-hidden ${className}`.trim()}>
      {showImage ? (
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <MemoryNoteIcon seed={seed} className="h-full w-full rounded-[inherit]" />
      )}
    </span>
  );
}

function Memories({
  list,
  cursor,
  onCursorChange,
  onOpen,
  canEdit = false,
  onAddMemory,
}: {
  list: PetalList;
  cursor: Date;
  onCursorChange: (next: Date) => void;
  onOpen: (id: string) => void;
  canEdit?: boolean;
  onAddMemory?: (day: Date) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Scheduled items belong on the calendar even before they are completed or photographed.
  const memories = (list.items || []).filter(
    (item) => item.completed || Boolean(item.targetDate) || Boolean(item.targetMonth) || memoryPhotos(item).length > 0,
  );
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const trailing = (7 - ((first + days) % 7)) % 7;
  const cells = [
    ...Array.from({ length: first }, () => 0),
    ...Array.from({ length: days }, (_, i) => i + 1),
    ...Array.from({ length: trailing }, () => 0),
  ];
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
  const today = new Date();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  useEffect(() => {
    setSelectedDay(null);
  }, [year, month]);

  useEffect(() => {
    if (selectedDay == null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedDay(null);
    }
    document.body.classList.add("memory-day-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("memory-day-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedDay]);

  function itemsOnDay(day: number) {
    return memories.filter((item) => {
      const dt = memoryDateFor(item);
      if (!dt) return false;
      return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day;
    });
  }

  const selectedItems = selectedDay != null ? itemsOnDay(selectedDay) : [];
  const selectedWeekday =
    selectedDay != null
      ? new Date(year, month, selectedDay).toLocaleDateString(undefined, { weekday: "long" })
      : "";
  const selectedDayLabel =
    selectedDay != null
      ? new Date(year, month, selectedDay).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
        })
      : "";
  const selectedCountLabel =
    selectedItems.length === 0
      ? "No memories"
      : `${selectedItems.length} ${selectedItems.length === 1 ? "memory" : "memories"}`;

  function handleAddMemory() {
    if (!canEdit || selectedDay == null || !onAddMemory) return;
    onAddMemory(new Date(year, month, selectedDay));
  }

  return (
    <section className={`list-body memory-body ${selectedDay != null ? "has-day-sheet" : ""}`}>
      <div className="memory-calendar-shell mx-auto w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 className="min-w-0 truncate font-serif text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {monthLabel}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="dewdrop-control flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
              onClick={() => onCursorChange(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="dewdrop-control flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
              onClick={() => onCursorChange(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="memory-calendar">
          <div className="mb-1 grid grid-cols-7 gap-1 sm:mb-1.5 sm:gap-1.5">
            {weekdays.map((d) => (
              <div key={d} className="memory-weekday">
                {d}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1 sm:gap-1.5">
            {weeks.map((week, weekIdx) => (
              <div key={`week-${weekIdx}`} className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {week.map((day, dayIdx) => {
                  if (day <= 0) return <div key={`pad-${weekIdx}-${dayIdx}`} className="memory-calendar-pad" />;
                  const dayItems = itemsOnDay(day);
                  const primaryPhoto =
                    dayItems.map((item) => memoryPhotos(item)[0] || null).find((src) => Boolean(src)) || null;
                  const overflow = dayItems.length > 1 ? dayItems.length - 1 : 0;
                  const isToday =
                    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                  const hasMemories = dayItems.length > 0;
                  const hasPhotos = Boolean(primaryPhoto);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`memory-day-cell ${hasMemories ? "has-memory" : ""} ${hasPhotos ? "has-photo" : ""} ${
                        isToday ? "is-today" : ""
                      } ${selectedDay === day ? "is-selected" : ""}`}
                      onClick={() => setSelectedDay((prev) => (prev === day ? null : day))}
                      aria-haspopup="dialog"
                      aria-expanded={selectedDay === day}
                    >
                      {hasPhotos ? (
                        <MemoryThumb src={primaryPhoto} className="memory-day-photo" seed={`day-${day}`} />
                      ) : null}
                      <span className="memory-day-top">
                        <span className="memory-day-number">{day}</span>
                        {hasMemories && !hasPhotos ? <span className="memory-activity-pip" aria-hidden /> : null}
                      </span>
                      {hasPhotos && overflow > 0 ? (
                        <span className="memory-day-overflow" aria-label={`${overflow} more memories`}>
                          +{overflow}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDay != null ? (
          <motion.div
            key="memory-sheet-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="memory-day-sheet-overlay"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDay != null ? (
          <motion.aside
            key="memory-sheet-panel"
            role="dialog"
            aria-modal={false}
            aria-label={`${selectedWeekday}, ${selectedDayLabel}`}
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="memory-day-sheet"
          >
            <header className="memory-day-sheet-head">
              <div className="memory-day-sheet-head-inner">
                <div className="memory-day-sheet-meta">
                  <div className="memory-day-sheet-heading">
                    <button
                      type="button"
                      className="memory-day-sheet-back"
                      onClick={() => setSelectedDay(null)}
                      aria-label={`Back to ${monthLabel}`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                      <span className="truncate">{selectedWeekday}, {selectedDayLabel}</span>
                    </button>
                  </div>
                  <span
                    className={`memory-day-sheet-count ${selectedItems.length === 0 ? "is-empty" : ""}`}
                  >
                    <span className="memory-day-sheet-count-dot" aria-hidden />
                    <span className="truncate">{selectedCountLabel}</span>
                  </span>
                </div>
              </div>
            </header>

            <div className="memory-day-sheet-body" role="region" aria-label="Memories for this day" tabIndex={0}>
              <div className={`memory-day-sheet-content ${selectedItems.length === 0 ? "is-empty" : ""}`}>
                {selectedItems.length === 0 ? (
                  <div className="memory-day-empty">
                    <span className="memory-day-empty-icon" aria-hidden>
                      <Flower2 className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <p className="memory-day-empty-title">A quiet day</p>
                    <p className="memory-day-empty-copy">Nothing saved for this date yet.</p>
                    {canEdit && onAddMemory ? (
                      <button type="button" className="memory-day-add-slot is-lonely" onClick={handleAddMemory}>
                        <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                        <span>Capture a memory</span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="memory-day-card-grid">
                    {selectedItems.map((item) => {
                      const photos = memoryPhotos(item);
                      const shop = isShopType(list.type);
                      const subtitle = shop && item.store ? item.store : item.notes;
                      return (
                        <MemoryDetailCard
                          key={item.id}
                          title={item.title}
                          note={subtitle}
                          image={photos[0]}
                          onClick={() => onOpen(item.id)}
                        />
                      );
                    })}
                    {canEdit && onAddMemory ? (
                      <button type="button" className="memory-day-add-slot" onClick={handleAddMemory}>
                        <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                        <span>Capture</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function MemoryDetailCard({
  title,
  note,
  image,
  onClick,
}: {
  title: string;
  note: string | null;
  image?: string | null;
  onClick: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = typeof image === "string" && image.trim().length > 0 && !imageFailed;
  const NoteIcon = memoryNoteIconFor(title);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  return (
    <button
      type="button"
      className={`memory-detail-card group ${hasImage ? "has-photo" : "is-note"}`}
      onClick={onClick}
    >
      {hasImage ? (
        <>
          <span className="memory-detail-card-mount">
            <img
              src={image}
              alt={title}
              className="memory-detail-card-photo"
              onError={() => setImageFailed(true)}
            />
          </span>
          <span className="memory-detail-card-caption">
            <span className="memory-detail-card-title">{title}</span>
            {note ? <span className="memory-detail-card-note">{note}</span> : null}
          </span>
        </>
      ) : (
        <>
          <span className="memory-detail-card-mark" aria-hidden>
            <NoteIcon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="memory-detail-card-caption">
            <span className="memory-detail-card-title">{title}</span>
            {note ? <span className="memory-detail-card-note">{note}</span> : null}
          </span>
        </>
      )}
    </button>
  );
}

function productHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function UrlField({
  value,
  canEdit,
  store,
  fieldClass,
  onChange,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  store?: string | null;
  fieldClass?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const host = productHost(value);
  const name = (store && store.trim()) || host;
  const showPill = Boolean(value && host && !editing);

  if (!showPill) {
    return (
      <input
        className={fieldClass || "field"}
        disabled={!canEdit}
        value={value}
        placeholder="https://"
        autoFocus={editing}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          onSave();
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="url-pill">
      <button type="button" className="url-pill-meta" onClick={() => canEdit && setEditing(true)} aria-label={canEdit ? "Edit link" : name}>
        <img
          className="url-pill-favicon"
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`}
          alt=""
          width={16}
          height={16}
        />
        <span className="url-pill-name">{name}</span>
      </button>
      <a className="url-pill-go" href={value} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name}`}>
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
      </a>
    </div>
  );
}

function looksLikeUiScreenshot(att: { filename: string | null; altText: string | null }) {
  const hay = `${att.filename || ""} ${att.altText || ""}`.toLowerCase();
  return /screenshot|screen[_\s-]?shot/.test(hay);
}

function galleryPhotos(attachments: ListItem["attachments"]) {
  const images = attachments.filter((att) => att.type === "image");
  if (images.length <= 1) return images;
  const products = images.filter((att) => !looksLikeUiScreenshot(att));
  return products.length ? products : images;
}

function ItemPhotoFrame({
  att,
  canEdit,
  owner,
  onRemove,
  onReplace,
}: {
  att: ListItem["attachments"][number];
  canEdit: boolean;
  owner: boolean;
  onRemove: (id: string) => void;
  onReplace: (file: File, id: string) => void;
}) {
  return (
    <div className="item-photo">
      <img src={att.fileUrl} alt={att.altText || att.filename || ""} className="item-photo-preview" />
      {canEdit && owner ? (
        <div className="item-photo-actions">
          <button type="button" aria-label="Remove photo" onClick={() => onRemove(att.id)}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <FileDropInput
            accept="image/*"
            ariaLabel="Replace photo"
            onFile={(file) => onReplace(file, att.id)}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="sr-only">Replace photo</span>
          </FileDropInput>
        </div>
      ) : null}
    </div>
  );
}

function ItemModal({
  item,
  list,
  canEdit,
  owner,
  tags,
  onClose,
  onMutate,
  onReload,
}: {
  item: ListItem | null;
  list: PetalList;
  canEdit: boolean;
  owner: boolean;
  tags: Tag[];
  onClose: () => void;
  onMutate: (a: string, p: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { data, refresh } = useApp();
  const [draft, setDraft] = useState(item);
  const [uploading, setUploading] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [heroId, setHeroId] = useState<string | null>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setDraft(item);
    setHeroId(null);
    setTagPickerOpen(false);
    setNewTag("");
  }, [item]);
  useEffect(() => {
    if (!tagPickerOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!tagPickerRef.current?.contains(event.target as Node)) {
        setTagPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTagPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [tagPickerOpen]);
  if (!draft) return null;
  const current = draft;
  const homeList = (data?.lists ?? []).find((entry) => entry.id === current.listId) || list;
  const shop = isShopType(homeList.type);
  const photos = galleryPhotos(draft.attachments);
  const hero = photos.find((att) => att.id === heroId) || photos[0];
  const seasonOrder = ["general", "fall", "winter", "spring", "summer"];
  const destLists = (data?.lists ?? [])
    .filter((entry) => !entry.archivedAt && sectionForType(entry.type) === sectionForType(homeList.type))
    .slice()
    .sort((a, b) => {
      const ai = seasonOrder.indexOf(normalizeSeason(a.title));
      const bi = seasonOrder.indexOf(normalizeSeason(b.title));
      if (ai === -1 && bi === -1) return a.title.localeCompare(b.title);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  function save(patch: Record<string, unknown>) {
    void onMutate("update", { itemId: current.id, patch });
  }
  function setTargetDate(value: string) {
    const targetDate = value || null;
    const patch = { targetDate, targetMonth: targetDate ? null : current.targetMonth || null };
    setDraft({ ...current, ...patch });
    save(patch);
  }
  function moveToList(nextId: string) {
    if (nextId === current.listId) return;
    setDraft({ ...current, listId: nextId });
    save({ listId: nextId });
  }
  function applyTags(next: Tag[]) {
    setDraft({ ...current, tags: next });
    save({ tagIds: next.map((tag) => tag.id) });
  }
  function toggleTag(id: string) {
    const extra = tags.find((tag) => tag.id === id);
    const adding = !current.tags.some((tag) => tag.id === id);
    applyTags(
      adding && extra
        ? [...current.tags, { id: extra.id, name: extra.name, color: extra.color, ownerDeviceId: extra.ownerDeviceId ?? current.tags[0]?.ownerDeviceId ?? "" }]
        : current.tags.filter((tag) => tag.id !== id),
    );
  }
  async function addCustomTag() {
    const name = newTag.trim();
    if (!name) return;
    const existing = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!current.tags.some((tag) => tag.id === existing.id)) toggleTag(existing.id);
      setNewTag("");
      setTagPickerOpen(false);
      return;
    }
    const created = await api<{ tag: Tag }>("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name, color: PASTELS[tags.length % PASTELS.length].hex }),
    });
    setNewTag("");
    setTagPickerOpen(false);
    applyTags([...current.tags, created.tag]);
    await refresh();
  }
  async function uploadPhoto(file: File) {
    setUploading("Uploading…");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api<{ url: string; filename: string; contentType: string }>("/api/upload", { method: "POST", body: form });
      await api(`/api/items/${current.id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ fileUrl: uploaded.url, filename: uploaded.filename, type: "image", altText: file.name, isShared: false }),
      });
      await onReload();
      setUploading("");
    } catch (err) {
      setUploading(err instanceof Error ? err.message : "Upload didn’t finish. Try a smaller file.");
    }
  }
  async function removePhoto(id: string) {
    await api(`/api/attachments/${id}`, { method: "DELETE" });
    await onReload();
  }
  async function replacePhoto(file: File, oldId: string) {
    await uploadPhoto(file);
    await api(`/api/attachments/${oldId}`, { method: "DELETE" });
    await onReload();
  }
  function persistAll() {
    if (canEdit) {
      const patch: Record<string, unknown> = {
        title: current.title,
        notes: current.notes,
        season: current.season,
        purchased: current.purchased,
        productUrl: current.productUrl,
      };
      if (shop) {
        patch.price = current.price;
        patch.store = current.store;
        if (current.currency) patch.currency = current.currency;
      }
      save(patch);
    }
    onClose();
  }
  const todo = isTodoType(homeList.type);
  const showShopFields = shop;
  const photoOptional = todo || !shop;
  const showFullPhotoMount = Boolean(hero) || (canEdit && owner && !photoOptional);
  const showCompactPhotoAdd = Boolean(canEdit && owner && photoOptional && !hero);
  const fieldClass =
    "h-10 w-full rounded-xl border border-slate-200/70 bg-slate-50/40 px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-[background,box-shadow,border-color] focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/50 disabled:opacity-60";
  const selectClass =
    "h-10 w-full appearance-none rounded-xl border border-slate-200/70 bg-slate-50/40 px-4 py-2 pr-9 text-xs font-medium text-slate-800 transition-[background,box-shadow,border-color] focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/50 disabled:opacity-60";
  const labelClass = "modal-item-label";
  const areaClass =
    "min-h-[6.5rem] w-full flex-1 resize-y rounded-xl border border-slate-200/70 border-dashed bg-slate-50/80 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-[background,box-shadow,border-color] focus:border-solid focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/50 disabled:opacity-60";
  const mergedFieldClass =
    "flex h-10 items-center overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/40 transition-[background,box-shadow,border-color] focus-within:border-slate-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200/50";
  const tagsLabel = todo ? "Days" : "Tags";
  const appliedIds = new Set(draft.tags.map((t) => t.id));
  const tagQuery = newTag.trim().toLowerCase();
  const availableTags = tags
    .filter((tag) => !appliedIds.has(tag.id))
    .filter((tag) => !tagQuery || tag.name.toLowerCase().includes(tagQuery));
  const canCreateTag =
    Boolean(newTag.trim()) &&
    !tags.some((tag) => tag.name.toLowerCase() === newTag.trim().toLowerCase());

  const photoBlock =
    photos.length || (canEdit && owner) ? (
      <div className="item-form-col is-media">
        {showFullPhotoMount || hero ? <span className={labelClass}>{todo ? "Memory" : "Photo"}</span> : null}
        {hero ? (
          <div className="item-herbarium-mount group">
            <img
              src={hero.fileUrl}
              alt={hero.altText || hero.filename || ""}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            {canEdit && owner ? (
              <div className="item-herbarium-overlay">
                <FileDropInput
                  accept="image/*"
                  ariaLabel="Change photo"
                  className="item-herbarium-overlay-btn"
                  disabled={Boolean(uploading)}
                  onFile={(file) => void replacePhoto(file, hero.id)}
                >
                  <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                  {uploading || "Change photo"}
                </FileDropInput>
                <button
                  type="button"
                  className="item-herbarium-overlay-btn is-remove"
                  onClick={() => void removePhoto(hero.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ) : showFullPhotoMount ? (
          <FileDropInput
            accept="image/*"
            ariaLabel="Add memory or photo"
            className="item-herbarium-drop"
            disabled={Boolean(uploading)}
            onFile={(file) => void uploadPhoto(file)}
          >
            <span className="item-herbarium-icon">
              <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="px-3 text-center text-xs font-medium">{uploading || "Add memory or photo"}</span>
          </FileDropInput>
        ) : showCompactPhotoAdd ? (
          <FileDropInput
            accept="image/*"
            ariaLabel="Add an optional photo"
            className="item-herbarium-drop is-compact"
            disabled={Boolean(uploading)}
            onFile={(file) => void uploadPhoto(file)}
          >
            <span className="item-herbarium-icon">
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <span className="text-xs font-medium">{uploading || "Add a photo (optional)"}</span>
          </FileDropInput>
        ) : null}
        {photos.length > 1 ? (
          <div className="item-photo-thumbs mt-2.5 justify-start">
            {photos.map((att) => (
              <button
                key={att.id}
                type="button"
                className={`item-photo-thumb ${hero && att.id === hero.id ? "is-on" : ""}`}
                onClick={() => setHeroId(att.id)}
              >
                <img src={att.fileUrl} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  const tagsBlock =
    canEdit || draft.tags.length ? (
      <div>
        <span className={labelClass}>{tagsLabel}</span>
        <div className="item-tag-wrap">
          <TagPills
            tags={draft.tags}
            onDelete={canEdit ? (id) => toggleTag(id) : undefined}
            size="micro"
          />
          {canEdit && owner ? (
            <div className="relative" ref={tagPickerRef}>
              <button
                type="button"
                className={`item-tag-add ${tagPickerOpen ? "is-open" : ""}`}
                aria-expanded={tagPickerOpen}
                aria-haspopup="listbox"
                onClick={() => setTagPickerOpen((open) => !open)}
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} />
                Add tag
              </button>
              {tagPickerOpen ? (
                <div className="item-tag-picker" role="listbox" aria-label="Available tags">
                  <form
                    className="item-tag-picker-search"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addCustomTag();
                    }}
                  >
                    <Search className="item-tag-picker-search-icon" aria-hidden />
                    <input
                      autoFocus
                      className="item-tag-picker-search-input"
                      value={newTag}
                      placeholder={todo ? "Search or create day…" : "Search or create…"}
                      onChange={(e) => setNewTag(e.target.value)}
                    />
                  </form>
                  <div className="item-tag-picker-list">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        role="option"
                        className="item-tag-picker-option"
                        onClick={() => {
                          toggleTag(tag.id);
                          setNewTag("");
                          setTagPickerOpen(false);
                        }}
                      >
                        <span
                          className="item-tag-picker-swatch"
                          style={{ background: brightenPastel(tag.color) }}
                        />
                        {tag.name}
                      </button>
                    ))}
                    {canCreateTag ? (
                      <button
                        type="button"
                        className="item-tag-picker-option is-create"
                        onClick={() => void addCustomTag()}
                      >
                        <Plus className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.25} />
                        Create “{newTag.trim()}”
                      </button>
                    ) : null}
                    {!availableTags.length && !canCreateTag ? (
                      <p className="px-2.5 py-3 text-center text-xs text-slate-400">
                        {tags.length ? "All tags applied" : "Type to create a tag"}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <Modal
      variant="item"
      open
      onClose={onClose}
      title={
        <input
          className="modal-item-title"
          disabled={!canEdit}
          value={current.title}
          onChange={(e) => setDraft({ ...current, title: e.target.value })}
          onBlur={() => save({ title: current.title })}
          aria-label="Title"
          placeholder="Untitled"
        />
      }
      footer={
        <>
          {canEdit ? (
            <button
              type="button"
              aria-label="Delete item"
              title="Delete"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500"
              onClick={() => void onMutate("delete", { itemId: draft.id }).then(onClose)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button type="button" className="item-done-btn !text-white" onClick={persistAll}>
              Done
            </button>
          </div>
        </>
      }
    >
      <div
        className={
          photoBlock
            ? "grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)] md:items-start md:gap-6"
            : "grid gap-4"
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          {canEdit && destLists.length > 1 ? (
            <div>
              <span className={labelClass}>List</span>
              <div className="relative">
                <select className={selectClass} value={draft.listId} onChange={(e) => moveToList(e.target.value)}>
                  {destLists.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" strokeWidth={2} />
              </div>
            </div>
          ) : null}
          {showShopFields ? (
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <span className={labelClass}>Store</span>
                <input
                  className={fieldClass}
                  disabled={!canEdit}
                  value={draft.store || ""}
                  placeholder="Store"
                  onChange={(e) => setDraft({ ...draft, store: e.target.value })}
                  onBlur={() => save({ store: draft.store })}
                />
              </div>
              <div>
                <span className={labelClass}>Price</span>
                <div className={mergedFieldClass}>
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    disabled={!canEdit}
                    type="number"
                    value={draft.price ?? ""}
                    placeholder="0"
                    onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={() => save({ price: draft.price })}
                  />
                  <input
                    className="w-14 shrink-0 border-0 border-l border-slate-200/70 bg-transparent px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500 focus:outline-none disabled:opacity-60"
                    disabled={!canEdit}
                    value={draft.currency || list.currency}
                    placeholder="USD"
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                    onBlur={() => save({ currency: draft.currency })}
                    aria-label="Currency"
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3.5">
            {showShopFields ? (
              <div>
                <span className={labelClass}>Link</span>
                <UrlField
                  value={draft.productUrl || ""}
                  canEdit={canEdit}
                  store={draft.store}
                  fieldClass={fieldClass}
                  onChange={(productUrl) => setDraft({ ...draft, productUrl })}
                  onSave={() => save({ productUrl: draft.productUrl })}
                />
              </div>
            ) : (
              <div>
                <span className={labelClass}>Date</span>
                <input
                  className={fieldClass}
                  type="date"
                  disabled={!canEdit}
                  value={draft.targetDate || ""}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            )}
            <div>
              <span className={labelClass}>Priority</span>
              <div className="relative">
                <select
                  className={selectClass}
                  disabled={!canEdit}
                  value={draft.priority || ""}
                  onChange={(e) => save({ priority: e.target.value || null })}
                >
                  <option value="">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" strokeWidth={2} />
              </div>
            </div>
          </div>
          {showShopFields ? (
            <div>
              <span className={labelClass}>Date</span>
              <input
                className={fieldClass}
                type="date"
                disabled={!canEdit}
                value={draft.targetDate || ""}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          ) : null}
          {!showShopFields ? (
            <div>
              <span className={labelClass}>Link</span>
              <UrlField
                value={draft.productUrl || ""}
                canEdit={canEdit}
                store={null}
                fieldClass={fieldClass}
                onChange={(productUrl) => setDraft({ ...draft, productUrl })}
                onSave={() => save({ productUrl: draft.productUrl })}
              />
            </div>
          ) : null}
          {tagsBlock}
          <div className="flex min-h-0 flex-1 flex-col">
            <span className={labelClass}>Notes</span>
            <textarea
              className={areaClass}
              disabled={!canEdit}
              rows={todo ? 5 : 4}
              value={draft.notes || ""}
              placeholder="Add a note"
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              onBlur={() => save({ notes: draft.notes })}
            />
          </div>
          {owner
            ? draft.attachments
                .filter((att) => att.type !== "image")
                .map((att) => (
                  <a key={att.id} className="text-link" href={att.fileUrl}>
                    {att.filename || "File"}
                  </a>
                ))
            : null}
        </div>
        {photoBlock}
      </div>
    </Modal>
  );
}
