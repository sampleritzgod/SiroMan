"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calendarSyncKeys } from "@/hooks/use-calendar-sync";
import { itemsKeys } from "@/hooks/use-items";

/**
 * Handles /app?calendar_sync=connected|error after Google OAuth redirect.
 * Keeps existing shell/views — only surfaces status and cleans the URL.
 */
export function CalendarOAuthReturnBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const [banner, setBanner] = useState<{
    kind: "connected" | "error";
    reason?: string;
  } | null>(null);

  useEffect(() => {
    const flag = searchParams.get("calendar_sync");
    if (flag !== "connected" && flag !== "error") return;

    const reason = searchParams.get("reason") ?? undefined;
    setBanner({ kind: flag, reason });

    void client.invalidateQueries({ queryKey: calendarSyncKeys.all });
    void client.invalidateQueries({ queryKey: itemsKeys.all });

    const next = new URLSearchParams(searchParams.toString());
    next.delete("calendar_sync");
    next.delete("reason");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname, client]);

  if (!banner) return null;

  return (
    <div
      className={
        banner.kind === "connected"
          ? "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px_14px_11px_13px] border-[1.5px] border-accent/30 bg-accent-soft/50 px-3 py-2.5"
          : "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px_14px_11px_13px] border-[1.5px] border-danger/30 bg-sticky-blush/50 px-3 py-2.5"
      }
      role="status"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {banner.kind === "connected"
            ? "Google Calendar connected"
            : "Google Calendar connection failed"}
        </p>
        {banner.kind === "error" && banner.reason ? (
          <p className="mt-0.5 text-xs text-ink-muted">{banner.reason}</p>
        ) : banner.kind === "connected" ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            Dated stickies will sync outbound. Check status anytime in Reminders →
            Settings.
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={banner.kind === "connected" ? "accent" : "danger"}>
          {banner.kind === "connected" ? "Connected" : "Error"}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setBanner(null)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
