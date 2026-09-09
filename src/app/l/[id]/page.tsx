"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ListWorkspace } from "@/components/list-workspace";
import { ListSkeleton, Shell } from "@/components/shell";

function ListInner() {
  const { id } = useParams<{ id: string }>();
  return (
    <Shell>
      <ListWorkspace listId={id} />
    </Shell>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<Shell><ListSkeleton /></Shell>}>
      <ListInner />
    </Suspense>
  );
}
