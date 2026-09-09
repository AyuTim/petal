"use client";

import Link from "next/link";
import { ArchiveRestore } from "lucide-react";
import { useApp } from "@/components/providers";
import { EmptyState, PageSkeleton, Shell } from "@/components/shell";
import { api, listCountLabel, typeLabel, type ListSummary } from "@/lib/api";
import { accentVars, brightenPastel } from "@/lib/palette";

export default function ArchivedPage() {
  const { data, loading, error, refresh, setToast } = useApp();
  const archived = (data?.lists ?? [])
    .filter((list) => Boolean(list.archivedAt))
    .slice()
    .sort((a, b) => (b.archivedAt || b.updatedAt).localeCompare(a.archivedAt || a.updatedAt));

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
        <EmptyState title="Couldn’t open archived lists" body={error} action={<button className="primary-btn" onClick={() => void refresh()}>Try again</button>} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="dash-head">
        <div>
          <h1 className="page-title">Archived</h1>
          <p className="page-sub">
            {archived.length === 0 ? "No archived lists yet." : `${archived.length} ${archived.length === 1 ? "list" : "lists"} set aside`}
          </p>
        </div>
      </div>

      {archived.length === 0 ? (
        <EmptyState title="No archived lists yet." body="When you archive a list, it will wait here." />
      ) : (
        <div className="board-grid">
          {archived.map((list) => (
            <ArchivedTile
              key={list.id}
              list={list}
              onRestore={async () => {
                await api(`/api/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ archivedAt: null }) });
                setToast({ message: "List restored." });
                await refresh();
              }}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function ArchivedTile({ list, onRestore }: { list: ListSummary; onRestore: () => void }) {
  const count = listCountLabel(list.type, list.progress.total, list.progress.complete);
  return (
    <article className="board-tile is-text" style={accentVars(list.color) as React.CSSProperties}>
      <Link href={`/l/${list.id}`} className="board-text-card">
        <p className="board-title">
          <span className="color-dot" style={{ background: brightenPastel(list.color) }} />
          {list.title}
        </p>
        <p className="board-sub">
          {typeLabel(list.type)} · {count}
        </p>
      </Link>
      <div className="board-actions">
        <button
          type="button"
          className="board-pin"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRestore();
          }}
          aria-label={`Restore ${list.title}`}
        >
          <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}
