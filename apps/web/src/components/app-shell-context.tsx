"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppView } from "@/lib/types";

type AppShellContextValue = {
  view: AppView;
  setView: (view: AppView) => void;
  /** Sticky id requested for open (notification click / deep link). */
  pendingStickyId: string | null;
  requestOpenSticky: (stickyId: string) => void;
  clearPendingSticky: () => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

function readStickyQueryParam(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const sticky = params.get("sticky")?.trim();
    return sticky || null;
  } catch {
    return null;
  }
}

function clearStickyQueryParam() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("sticky")) return;
    url.searchParams.delete("sticky");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    // ignore
  }
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>("home");
  const [pendingStickyId, setPendingStickyId] = useState<string | null>(null);

  const requestOpenSticky = useCallback((stickyId: string) => {
    setPendingStickyId(stickyId);
  }, []);

  const clearPendingSticky = useCallback(() => {
    setPendingStickyId(null);
  }, []);

  // Cold open from /app?sticky=… (notification click when app was closed).
  useEffect(() => {
    const fromQuery = readStickyQueryParam();
    if (!fromQuery) return;
    setPendingStickyId(fromQuery);
    clearStickyQueryParam();
  }, []);

  // Service worker → focus existing tab and open sticky.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; stickyId?: string } | null;
      if (!data || data.type !== "OPEN_STICKY") return;
      if (typeof data.stickyId !== "string" || !data.stickyId.trim()) return;
      setPendingStickyId(data.stickyId.trim());
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const value = useMemo(
    () => ({
      view,
      setView,
      pendingStickyId,
      requestOpenSticky,
      clearPendingSticky,
    }),
    [view, pendingStickyId, requestOpenSticky, clearPendingSticky],
  );

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return ctx;
}
