"use client";

import { Bell } from "lucide-react";
import { useInboxSummary } from "@/hooks/use-reminders";
import { cn } from "@/lib/utils";

type ReminderBadgeButtonProps = {
  active?: boolean;
  onClick: () => void;
  className?: string;
};

export function ReminderBadgeButton({
  active,
  onClick,
  className,
}: ReminderBadgeButtonProps) {
  const summary = useInboxSummary();
  const count = summary.data?.unreadCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        count > 0 ? `Reminders, ${count} unread` : "Open reminders"
      }
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-[10px_12px_11px_13px] border-[1.5px] transition-colors",
        active
          ? "border-stroke-doodle bg-sticky-ink text-ink"
          : "border-stroke-doodle/25 text-ink-muted hover:bg-sticky-ink/70 hover:text-ink",
        className,
      )}
    >
      <Bell className="h-4 w-4" strokeWidth={1.75} />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}
