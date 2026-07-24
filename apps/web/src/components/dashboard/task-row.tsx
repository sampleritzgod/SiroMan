"use client";

import { DueChip } from "@/components/md/due-chip";
import { Badge } from "@/components/ui/badge";
import type { StickyNoteView } from "@/lib/types";
import { STICKY_CSS } from "@/lib/sticky-utils";
import { cn } from "@/lib/utils";

type TaskRowProps = {
  note: StickyNoteView;
  onOpen: (note: StickyNoteView) => void;
  subtitle?: string;
  className?: string;
};

export function TaskRow({ note, onOpen, subtitle, className }: TaskRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px_16px_13px_15px]",
        "border-[1.5px] border-stroke-doodle/30 bg-surface/90 px-3.5 py-3 text-left",
        "shadow-[0.5px_1px_0_rgba(42,38,34,0.05)]",
        "transition-transform duration-150 hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: STICKY_CSS[note.color] }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {note.title || "Untitled sticky"}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {note.priority !== "none" ? (
          <Badge
            variant={
              note.priority === "high"
                ? "danger"
                : note.priority === "medium"
                  ? "warning"
                  : "accent"
            }
          >
            {note.priority}
          </Badge>
        ) : null}
        {note.status !== "note" ? (
          <DueChip status={note.status} remainingDays={note.remainingDays} />
        ) : null}
      </div>
    </button>
  );
}
