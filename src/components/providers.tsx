"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Bootstrap } from "@/lib/api";
import { api } from "@/lib/api";
import { ACCENT, appAccentVars } from "@/lib/palette";
import type { OwnerSettings, QuickCapture, Tag } from "@/lib/types";
import { QuickCaptureDock } from "./quick-capture";

type Toast = { message: string; action?: { label: string; onClick: () => void }; duration?: number; kind?: "filed" } | null;

const AppContext = createContext<{
  data: Bootstrap | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toast: Toast;
  setToast: (toast: Toast) => void;
  removeList: (listId: string) => void;
  sidebarPulseListId: string | null;
  pulseSidebarList: (listId: string) => void;
  patchSettings: (patch: Partial<OwnerSettings>) => Promise<void>;
} | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within Providers");
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isShare = path.startsWith("/s/");
  const isAuthPage = path.startsWith("/login");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sidebarPulseListId, setSidebarPulseListId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api<Bootstrap>("/api/bootstrap");
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t open your lists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isShare || isAuthPage) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh, isShare, isAuthPage]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.duration ?? 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const patchSettings = async (patch: Partial<OwnerSettings>) => {
    const result = await api<{ settings: OwnerSettings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setData((current) => (current ? { ...current, settings: result.settings } : current));
  };

  const removeList = useCallback((listId: string) => {
    setData((current) => (current ? { ...current, lists: current.lists.filter((list) => list.id !== listId) } : current));
  }, []);

  const pulseSidebarList = useCallback((listId: string) => {
    setSidebarPulseListId(listId);
    window.setTimeout(() => setSidebarPulseListId((current) => (current === listId ? null : current)), 520);
  }, []);

  const settings = data?.settings;
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.documentElement.dataset.motion = settings.reducedMotion ? "reduce" : "ok";
    document.documentElement.dataset.font = settings.defaultFont;
    document.documentElement.style.setProperty("--text", settings.largerText ? "18px" : "16px");
    const accent = settings.accentColor || ACCENT.hex;
    const vars = appAccentVars(accent);
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [settings]);

  const value = useMemo(
    () => ({ data, loading, error, refresh, toast, setToast, removeList, sidebarPulseListId, pulseSidebarList, patchSettings }),
    [data, loading, error, refresh, toast, removeList, sidebarPulseListId, pulseSidebarList],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {isShare || isAuthPage ? null : (
        <QuickCaptureDock
          captures={data?.captures ?? []}
          onChange={(captures: QuickCapture[]) => setData((current) => (current ? { ...current, captures } : current))}
        />
      )}
      {toast ? (
        <div className={`toast card px-4 py-3 max-w-sm flex items-center gap-3 ${toast.kind === "filed" ? "is-filed" : ""}`}>
          <p className="text-sm">{toast.message}</p>
          {toast.action ? (
            <button className="soft-btn text-sm" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

export function useTags(): Tag[] {
  return useApp().data?.tags ?? [];
}
