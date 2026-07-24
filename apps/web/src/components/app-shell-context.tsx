"use client";

import {
  createContext,
  useCallback,
  useContext,
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

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>("home");
  const [pendingStickyId, setPendingStickyId] = useState<string | null>(null);

  const requestOpenSticky = useCallback((stickyId: string) => {
    setPendingStickyId(stickyId);
  }, []);

  const clearPendingSticky = useCallback(() => {
    setPendingStickyId(null);
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
