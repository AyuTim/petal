"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronDown, Inbox, Plus, Settings, UserRound, X } from "lucide-react";
import { useApp } from "@/components/providers";
import { BrandWordmark, PetalMark } from "@/components/petal-mark";
import { api, type ListSummary } from "@/lib/api";
import { accentVars, brightenPastel, readableInk } from "@/lib/palette";
import {
  isBucketType,
  isShopType,
  isTodoType,
  parseSection,
  sectionForType,
  sectionHref,
  type Section,
} from "@/lib/sections";

export type { Section };
export { isBucketType, isShopType, isTodoType, parseSection, sectionForType, sectionHref };

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const search = useSearchParams();
  const { data, sidebarPulseListId } = useApp();
  const allLists = data?.lists ?? [];
  const lists = allLists.filter((list) => !list.archivedAt);
  const archivedActive = path === "/archived" || (path.startsWith("/l/") && Boolean(allLists.find((item) => item.id === path.split("/")[2])?.archivedAt));

  let section: Section | null = null;
  if (path === "/") {
    section = parseSection(search.get("section"));
  } else if (path.startsWith("/l/") && !archivedActive) {
    const list = lists.find((item) => item.id === path.split("/")[2]);
    section = list ? sectionForType(list.type) : null;
  }

  const shop = lists.filter((list) => isShopType(list.type));
  const bucket = lists.filter((list) => isBucketType(list.type));
  const todo = lists.filter((list) => isTodoType(list.type));
  const activeListId = path.startsWith("/l/") ? path.split("/")[2] : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar w-64 bg-white/80 backdrop-blur-2xl border-r border-slate-200/80 shadow-[1px_0_12px_rgba(15,23,42,0.03)]">
        <Link href="/" className="sidebar-brand">
          <BrandWordmark />
        </Link>
        <div className="sidebar-sections">
          <SidebarGroup
            label="Wish"
            section="shop"
            lists={shop}
            activeId={activeListId}
            categoryActive={path === "/" && section === "shop"}
            pulseListId={sidebarPulseListId}
          />
          <SidebarGroup
            label="Bucket"
            section="bucket"
            lists={bucket}
            activeId={activeListId}
            categoryActive={path === "/" && section === "bucket"}
            pulseListId={sidebarPulseListId}
          />
          <SidebarGroup
            label="To-do"
            section="todo"
            lists={todo}
            activeId={activeListId}
            categoryActive={path === "/" && section === "todo"}
            pulseListId={sidebarPulseListId}
          />
        </div>
        <div className="sidebar-foot mt-auto border-t border-slate-200/60 pt-3 mb-3">
          <Link className={`nav-item is-quiet ${archivedActive ? "is-active" : ""}`} href="/archived">
            <Archive className="h-4 w-4" strokeWidth={2} /> Archived
          </Link>
          <Link className={`nav-item is-quiet ${path === "/inbox" ? "is-active" : ""}`} href="/inbox">
            <Inbox className="h-4 w-4" strokeWidth={2} /> Catch
          </Link>
          <Link className={`nav-item is-quiet ${path === "/settings" ? "is-active" : ""}`} href="/settings">
            <Settings className="h-4 w-4" strokeWidth={2} /> Settings
          </Link>
          <Link className={`nav-item is-quiet ${path === "/profile" ? "is-active" : ""}`} href="/profile">
            {data?.profile?.avatarUrl ? (
              <img className="profile-nav-avatar" src={data.profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <UserRound className="h-4 w-4" strokeWidth={2} />
            )}
            {data?.profile?.name || (data?.profile?.provider === "google" ? "Profile" : "Sign in")}
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="topbar">
          <Link href="/" className="sidebar-brand">
            <BrandWordmark />
          </Link>
          <nav className="tabs text-sm">
            <Link className={`tab ${section === "shop" ? "is-active" : ""}`} href={sectionHref("shop")}>
              Wish
            </Link>
            <Link className={`tab ${section === "bucket" ? "is-active" : ""}`} href={sectionHref("bucket")}>
              Bucket
            </Link>
            <Link className={`tab ${section === "todo" ? "is-active" : ""}`} href={sectionHref("todo")}>
              To-do
            </Link>
            <Link className={`tab ${archivedActive ? "is-active" : ""}`} href="/archived" aria-label="Archived">
              <Archive className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link className={`tab ${path === "/inbox" ? "is-active" : ""}`} href="/inbox" aria-label="Catch">
              <Inbox className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link className={`tab ${path === "/settings" ? "is-active" : ""}`} href="/settings" aria-label="Settings">
              <Settings className="h-4 w-4" strokeWidth={2} />
            </Link>
          </nav>
        </div>
        <main className="main mx-auto flex w-full max-w-5xl flex-col px-8 pb-16 pt-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarGroup({
  label,
  section,
  lists,
  activeId,
  categoryActive = false,
  pulseListId,
}: {
  label: string;
  section: Section;
  lists: ListSummary[];
  activeId?: string;
  categoryActive?: boolean;
  pulseListId?: string | null;
}) {
  const router = useRouter();
  const storageKey = `petals.sidebar.${section}.collapsed`;
  const [collapsed, setCollapsed] = useState(false);
  const href = sectionHref(section);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function toggleCollapsed(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function openCreate(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    router.push(sectionHref(section, { new: "1" }));
  }

  return (
    <div className="sidebar-section">
      <div
        className={`group/section mt-4 mb-1 flex items-center justify-between rounded-lg px-3 py-1.5 transition-colors duration-150 ${
          categoryActive ? "sidebar-section-head is-active" : "sidebar-section-head"
        }`}
      >
        <Link
          href={href}
          className="sidebar-section-label flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
        >
          <span>{label}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/60 hover:text-slate-700 group-hover/section:opacity-100"
            onClick={openCreate}
            aria-label={`New ${label} list`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/60 hover:text-slate-700 group-hover/section:opacity-100"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="lists"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {lists.map((list) => (
              <SidebarListRow
                key={list.id}
                list={list}
                active={!categoryActive && activeId === list.id}
                pulsed={pulseListId === list.id}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarListRow({ list, active, pulsed = false }: { list: ListSummary; active: boolean; pulsed?: boolean }) {
  const { refresh, setToast } = useApp();
  const router = useRouter();
  const path = usePathname();
  const accent = brightenPastel(list.color);

  async function archive(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    await api(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ archivedAt: new Date().toISOString() }) });
    setToast({ message: "List archived." });
    if (path === `/l/${list.id}`) router.push("/");
    await refresh();
  }

  return (
    <motion.div
      className={`nav-row relative ${active ? "is-active" : ""}`}
      style={accentVars(list.color) as React.CSSProperties}
      animate={pulsed ? { scale: [1, 1.055, 1] } : { scale: 1 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
    >
      {active ? (
        <motion.div
          layoutId="activeSidebarIndicator"
          className="pointer-events-none absolute inset-0 rounded-[14px] sidebar-active-pill"
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
        />
      ) : null}
      <Link
        href={`/l/${list.id}`}
        className={`nav-item relative z-10 flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-sm transition-[color,background-color,box-shadow,transform] duration-150 ${
          active
            ? "is-active tracking-tight"
            : "font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-950"
        }`}
      >
        <SidebarFlower color={accent} />
        <span className="truncate">{list.title}</span>
      </Link>
      <button type="button" className="nav-archive z-10" onClick={(event) => void archive(event)} aria-label={`Archive ${list.title}`}>
        <Archive className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </motion.div>
  );
}

function SidebarFlower({ color }: { color: string }) {
  const normalized = color.toLowerCase();
  const mintBlossom = normalized === "#c8f0d8" || normalized === "#c4f0e8";
  const sunflower = normalized === "#ffe9a8" || normalized === "#ffd4c2" || normalized === "#fff3d6";
  const cherry = normalized === "#ffd6e0" || normalized === "#f8c4d4";
  const mintPetal = normalized === "#c4f0e8" ? "#0d9488" : "#10b981";

  return (
    <span className={`sidebar-flower ${mintBlossom ? "is-mint-blossom" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 20 20">
        {mintBlossom ? (
          <>
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse key={angle} cx="10" cy="6.1" rx="2.3" ry="3.45" fill={mintPetal} transform={`rotate(${angle} 10 10)`} />
            ))}
            <circle className="sidebar-flower-pistil" cx="10" cy="10" r="1.55" fill="#fef08a" />
          </>
        ) : sunflower ? (
          <>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <ellipse key={angle} cx="10" cy="5.8" rx="1.65" ry="3.35" fill={color} transform={`rotate(${angle} 10 10)`} />
            ))}
            <circle cx="10" cy="10" r="2" fill="#d97706" opacity="0.76" />
          </>
        ) : cherry ? (
          <>
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse key={angle} cx="10" cy="6.1" rx="2.3" ry="3.45" fill={color} transform={`rotate(${angle} 10 10)`} />
            ))}
            <circle cx="10" cy="10" r="1.45" fill="#ffffff" />
          </>
        ) : (
          <>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <ellipse key={angle} cx="10" cy="6" rx="1.9" ry="3.25" fill={color} transform={`rotate(${angle} 10 10)`} />
            ))}
            <circle cx="10" cy="10" r="1.55" fill="#ffffff" />
          </>
        )}
      </svg>
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <PetalMark className="empty-petal" />
      <h2>{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
        {body}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className = "",
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`chip ${active ? "is-active" : ""} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function Tab({
  active,
  children,
  onClick,
  className = "",
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`tab ${active ? "is-active" : ""} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

/** Shared frosted panel for Sort / Filter / More Actions toolbar menus. */
export const toolbarMenuPanelClass =
  "absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-xl";

export const toolbarMenuItemClass =
  "relative flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]";

export const toolbarMenuItemActiveClass = "bg-slate-100/80 font-semibold text-slate-900";

export const toolbarMenuIconClass = "h-4 w-4 shrink-0 text-slate-600 stroke-[1.75]";

export const toolbarMenuCheckClass = "h-3.5 w-3.5 shrink-0 text-slate-900";

export const toolbarMenuHintClass = "ml-auto text-[11px] font-mono text-slate-400";

export const toolbarMenuDividerClass = "my-1 border-t border-slate-100";

export function OverflowMenu({
  children,
  label = "More",
  align = "right",
  variant = "outline",
  panel = "default",
  icon,
  ariaLabel,
  active,
  className,
  panelClassName,
}: {
  children: React.ReactNode;
  label?: string;
  align?: "left" | "right" | "center";
  variant?: "outline" | "icon" | "ghost";
  panel?: "default" | "actions" | "tool";
  icon?: React.ReactNode;
  ariaLabel?: string;
  active?: boolean;
  className?: string;
  panelClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const node = ref.current;
      if (!node?.open) return;
      if (event.target instanceof Node && !node.contains(event.target)) {
        node.open = false;
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);
  const alignClass = align === "left" ? "is-left" : align === "center" ? "is-center" : "";
  const panelMod = panel === "actions" ? "is-actions" : panel === "tool" ? "is-tool" : "";
  const unified = panel === "actions" || panel === "tool" ? toolbarMenuPanelClass : "";
  return (
    <details ref={ref} className={`overflow-menu relative ${alignClass} ${className ?? ""}`.trim()}>
      <summary
        className={`overflow-trigger ${variant === "icon" ? "is-icon" : ""} ${variant === "ghost" ? "is-quiet-text" : ""} ${active ? "is-on" : ""}`}
        aria-label={ariaLabel || label}
      >
        {icon}
        {variant !== "icon" ? label : null}
      </summary>
      <div
        className={`overflow-menu-panel ${panelMod} ${unified} ${panelClassName ?? ""}`.trim()}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(".overflow-nested > summary")) return;
          if (target.closest("button") && ref.current) {
            ref.current.open = false;
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  variant = "default",
  footer,
  className,
}: {
  open: boolean;
  title?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  variant?: "default" | "item";
  footer?: React.ReactNode;
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    if (!open) {
      setScrollable(false);
      return;
    }
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open, children]);

  if (!open) return null;
  const isItem = variant === "item";
  return (
    <div
      className={isItem ? "modal-item-backdrop" : "modal-backdrop"}
      onClick={onClose}
    >
      <div
        className={
          isItem
            ? `modal-item ${className ?? ""}`.trim()
            : `modal-card ${className ?? ""}`.trim()
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className={isItem ? "modal-item-head" : "modal-head"}>
          {typeof title === "string" ? <h2>{title}</h2> : title ? title : <span />}
          <button
            className={isItem ? "modal-item-close" : "modal-close"}
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div
          ref={bodyRef}
          className={
            isItem
              ? `modal-item-body${scrollable ? " is-scrollable" : ""}`
              : `modal-body${scrollable ? " is-scrollable" : ""}`
          }
        >
          {children}
        </div>
        {footer ? (
          <div className={isItem ? "modal-item-foot" : "modal-foot"}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-sub" />
      <div className="board-grid mt-8">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-sub" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`skeleton skeleton-row ${i % 2 ? "is-short" : ""}`} />
        ))}
      </div>
    </div>
  );
}

function tagStyle(color: string, dim?: boolean): React.CSSProperties {
  const fill = brightenPastel(color);
  return {
    "--tag-fill": fill,
    "--tag-ink": readableInk(fill),
    opacity: dim ? 0.4 : undefined,
  } as React.CSSProperties;
}

export function TagPills({
  tags,
  selected,
  onToggle,
  onDelete,
  size = "default",
  tone = "default",
}: {
  tags: { id: string; name: string; color: string }[];
  selected?: string[];
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  size?: "default" | "micro";
  tone?: "default" | "quiet";
}) {
  if (!tags.length) return null;
  const micro = size === "micro";
  const quiet = tone === "quiet";
  return (
    <div className={micro ? "flex flex-wrap items-center gap-1.5" : "tag-pills"}>
      {tags.map((tag) => {
        const on = !selected || selected.includes(tag.id);
        const fill = brightenPastel(tag.color);
        const ink = readableInk(fill);
        const className = micro
          ? `petal-tag inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${selected && on ? "ring-1 ring-black/5" : ""} ${onDelete ? "gap-1 pr-1.5" : ""}`
          : `chip is-tag petal-tag ${selected && on ? "is-on" : ""} ${onDelete ? "has-delete" : ""}`;
        // Quiet = soft pastel wash with slate-700-adjacent ink (still readable, not gray-on-white)
        const style = micro
          ? ({
              background: quiet
                ? `color-mix(in srgb, ${fill} 62%, white)`
                : `color-mix(in srgb, ${fill} 72%, white)`,
              borderColor: quiet
                ? `color-mix(in srgb, ${fill} 38%, #cbd5e1 62%)`
                : `color-mix(in srgb, ${fill} 42%, transparent)`,
              color: quiet ? `color-mix(in srgb, ${ink} 82%, #334155 18%)` : ink,
              opacity: selected && !on ? 0.4 : undefined,
            } as React.CSSProperties)
          : tagStyle(tag.color, Boolean(selected && !on));
        const remove = onDelete ? (
          <button
            type="button"
            className={micro ? "item-tag-remove" : "tag-delete"}
            aria-label={`Remove ${tag.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(tag.id);
            }}
          >
            ×
          </button>
        ) : null;
        if (onToggle && onDelete) {
          return (
            <div key={tag.id} className={className} style={style}>
              <button type="button" className={micro ? "bg-transparent" : "tag-toggle"} onClick={() => onToggle(tag.id)}>
                {tag.name}
              </button>
              {remove}
            </div>
          );
        }
        if (!onToggle) {
          return (
            <span key={tag.id} className={className} style={style}>
              <span className={micro ? undefined : "tag-name"}>{tag.name}</span>
              {remove}
            </span>
          );
        }
        return (
          <button key={tag.id} type="button" className={className} style={style} onClick={() => onToggle(tag.id)}>
            <span className={micro ? undefined : "tag-name"}>{tag.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const TAG_CAP = 8;

export function tagFilterTone(name: string): "spring" | "summer" | "fall" | "winter" | "neutral" {
  const n = name.toLowerCase();
  if (n.includes("spring")) return "spring";
  if (n.includes("summer")) return "summer";
  if (n.includes("fall") || n.includes("autumn")) return "fall";
  if (n.includes("winter")) return "winter";
  // Soft day-of-week tones for weekly to-do filters
  if (n === "sun" || n === "sat") return "summer";
  if (n === "mon" || n === "tue") return "winter";
  if (n === "wed" || n === "thu") return "spring";
  if (n === "fri") return "fall";
  return "neutral";
}

const TAG_FILTER_ACTIVE_SHADOW =
  "0 1px 3px rgba(15, 23, 42, 0.08), inset 0 1px 1px rgba(255, 255, 255, 1)";

function tagFilterPillClass(active: boolean, tone: ReturnType<typeof tagFilterTone>) {
  const base =
    "inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full border px-3 py-0.5 text-[11px] font-medium leading-none tracking-tight transition-all duration-150";
  const inactive = "opacity-75 hover:opacity-100 hover:scale-105";
  const activeCls = "border-[1.5px] font-semibold";
  if (tone === "spring") {
    return active
      ? `${base} ${activeCls} border-emerald-300/70 bg-emerald-100/70 text-emerald-800`
      : `${base} ${inactive} border-emerald-200/50 bg-emerald-50/60 text-emerald-800`;
  }
  if (tone === "summer") {
    return active
      ? `${base} ${activeCls} border-amber-300/70 bg-amber-100/70 text-amber-800`
      : `${base} ${inactive} border-amber-200/50 bg-amber-50/60 text-amber-800`;
  }
  if (tone === "fall") {
    return active
      ? `${base} ${activeCls} border-orange-300/70 bg-orange-100/70 text-orange-800`
      : `${base} ${inactive} border-orange-200/50 bg-orange-50/60 text-orange-800`;
  }
  if (tone === "winter") {
    return active
      ? `${base} ${activeCls} border-sky-300/70 bg-sky-100/70 text-sky-800`
      : `${base} ${inactive} border-sky-200/50 bg-sky-50/60 text-sky-800`;
  }
  return active
    ? `${base} ${activeCls} border-slate-200/90 bg-white/95 text-slate-700`
    : `${base} ${inactive} border-slate-200/60 bg-white/70 text-slate-600`;
}

export function TagFilterRow({
  tags,
  selected,
  onSelect,
}: {
  tags: { id: string; name: string; color: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!tags.length) return null;
  const head = tags.slice(0, TAG_CAP);
  const rest = tags.slice(TAG_CAP);
  const visible = expanded ? tags : selected && rest.some((tag) => tag.id === selected) ? [...head, ...rest.filter((tag) => tag.id === selected)] : head;
  const hidden = expanded ? 0 : tags.length - visible.length;
  const allActive = !selected;
  const moreClass =
    "inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full border border-slate-200/60 bg-white/70 px-3 py-0.5 text-[11px] font-medium leading-none tracking-tight text-slate-600 opacity-75 transition-all duration-150 hover:scale-105 hover:opacity-100";
  return (
    <div className="list-tag-filters flex h-6 max-w-full items-center gap-1 overflow-x-auto">
      <button
        type="button"
        className={
          allActive
            ? "inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-slate-200/80 bg-white/90 px-3 py-0.5 text-[11px] font-semibold leading-none tracking-tight text-slate-900 transition-all duration-150"
            : "inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-transparent px-3 py-0.5 text-[11px] font-medium leading-none tracking-tight text-slate-600 opacity-75 transition-all duration-150 hover:scale-105 hover:opacity-100"
        }
        style={allActive ? { boxShadow: TAG_FILTER_ACTIVE_SHADOW } : undefined}
        onClick={() => onSelect("")}
      >
        All
      </button>
      {visible.map((tag) => {
        const tone = tagFilterTone(tag.name);
        const active = selected === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            className={tagFilterPillClass(active, tone)}
            style={active ? { boxShadow: TAG_FILTER_ACTIVE_SHADOW } : undefined}
            onClick={() => onSelect(selected === tag.id ? "" : tag.id)}
          >
            {tag.name}
          </button>
        );
      })}
      {!expanded && hidden > 0 ? (
        <button type="button" className={moreClass} onClick={() => setExpanded(true)}>
          +{hidden}
        </button>
      ) : null}
      <Link
        href="/settings"
        title="Add tag filter"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-700"
      >
        <Plus className="h-3 w-3 stroke-[2.5]" />
      </Link>
    </div>
  );
}
