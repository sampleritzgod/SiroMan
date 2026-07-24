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
        "inline-flex items-center gap-1 rounded-[8px_10px_9px_11px] border-[1.5px] px-2 py-0.5 text-[11px] font-medium",
        sync.status === "synced" &&
          "border-accent/30 bg-accent-soft/70 text-accent",
        sync.status === "syncing" &&
          "border-stroke-doodle/25 bg-sticky-mist/70 text-ink-muted",
        sync.status === "failed" &&
          "border-danger/30 bg-sticky-blush/70 text-danger",
        sync.status === "local_only" &&
          "border-stroke-doodle/20 bg-sticky-ink/80 text-ink-faint",
        className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", sync.status === "syncing" && "animate-spin")}
        strokeWidth={1.75}
      />
      {LABELS[sync.status]}
    </span>
  );
}
