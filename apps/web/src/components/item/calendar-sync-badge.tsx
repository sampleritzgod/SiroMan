"use client";

import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import type { StickyCalendarSync } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABELS: Record<StickyCalendarSync["status"], string> = {
  local_only: "Local Only",
  syncing: "Syncing",
  synced: "Synced",
  failed: "Failed",
};

type CalendarSyncBadgeProps = {
  sync: StickyCalendarSync;
  className?: string;
};

export function CalendarSyncBadge({ sync, className }: CalendarSyncBadgeProps) {
  const Icon =
    sync.status === "syncing"
      ? Loader2
      : sync.status === "synced"
        ? Cloud
        : sync.status === "failed"
          ? RefreshCw
          : CloudOff;

  return (
    <span
      title={sync.lastError ?? LABELS[sync.status]}
      className={cn(
        // Sync stays quiet — metadata-level emphasis, not a second accent.
        "inline-flex items-center gap-1 rounded-[8px_10px_9px_11px] border px-2 py-0.5 text-[11px] font-medium",
        sync.status === "synced" &&
          "border-stroke-doodle/20 bg-sticky-ink/60 text-ink-faint",
        sync.status === "syncing" &&
          "border-stroke-doodle/20 bg-sticky-ink/50 text-ink-muted",
        sync.status === "failed" &&
          "border-danger/25 bg-sticky-blush/40 text-danger",
        sync.status === "local_only" &&
          "border-stroke-doodle/15 bg-transparent text-ink-faint",
        className,
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3 opacity-80",
          sync.status === "syncing" && "animate-spin",
        )}
        strokeWidth={1.75}
      />
      {LABELS[sync.status]}
    </span>
  );
}
