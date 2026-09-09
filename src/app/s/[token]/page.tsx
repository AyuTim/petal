"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ListWorkspace } from "@/components/list-workspace";
import { BrandWordmark } from "@/components/petal-mark";
import { ListSkeleton } from "@/components/shell";

function ShareInner() {
  const { token } = useParams<{ token: string }>();
  const preview = useSearchParams().get("preview") === "1";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm font-semibold">
        <BrandWordmark />
      </p>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        Shared list — not the owner’s dashboard.
      </p>
      {preview ? (
        <p className="mb-4 text-sm">
          <Link className="underline" href="/">
            Back to your lists
          </Link>
        </p>
      ) : null}
      <ListWorkspace shareToken={token} preview={preview} />
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ShareInner />
    </Suspense>
  );
}
