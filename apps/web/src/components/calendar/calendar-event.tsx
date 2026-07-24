"use client";

import type { Priority } from "@stickyflow/shared";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import { STICKY_CSS } from "@/lib/sticky-utils";

const PRIORITY_BADGE: Record<
  Exclude<Priority, "none">,
  "danger" | "warning" | "accent"
> = {
  high: "danger",
  medium: "warning",
  low: "accent",
};

type CalendarEventProps = {
  note: StickyNoteView;
  onOpen: (note: StickyNoteView) => void;
  dense?: boolean;
  showDate?: boolean;
  className?: string;
};

export function CalendarEvent({
  note,
  onOpen,
  dense = false,
  showDate = false,
  className,
}: CalendarEventProps) {
  const reduced = useReducedMotion();
  const overdue = note.status === "overdue";
  const fill = STICKY_CSS[note.color];

  return (
    <motion.button
      type="button"
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.fast, ease: motionTokens.ease }
      }
      whileHover={
        reduced
          ? undefined
          : { y: -1, transition: { duration: motionTokens.fast } }
      }
      onClick={(event) => {
        event.stopPropagation();
        onOpen(note);
      }}
      className={cn(
        "group flex w-full items-start gap-2 text-left",
        "rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/30",
        "shadow-[0.5px_1px_0_var(--doodle-shadow-lift)]",
        "transition-[box-shadow,border-color] hover:border-stroke-doodle/55",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        overdue && "border-danger/35 bg-sticky-blush/50",
        className,
      )}
      style={
        overdue
          ? undefined
          : {
              backgroundColor: `color-mix(in srgb, ${fill} 55%, var(--surface))`,
            }
      }
      aria-label={`Open sticky: ${note.title || "Untitled sticky"}`}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0 rounded-full",
          dense ? "h-2 w-2" : "h-2.5 w-2.5",
          overdue ? "bg-danger" : "ring-1 ring-stroke-doodle/20",
        )}
        style={overdue ? undefined : { backgroundColor: fill }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-medium text-ink",
            dense ? "text-[11px] leading-tight" : "text-xs leading-snug",
          )}
        >
          {note.title || "Untitled sticky"}
        </span>
        {!dense ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {showDate && note.dueDate ? (
              <span className="text-[10px] text-ink-muted">{note.dueDate}</span>
            ) : null}
            {note.priority !== "none" ? (
              <Badge
                variant={PRIORITY_BADGE[note.priority]}
                className="px-1.5 py-0.5 text-[10px]"
              >
                {note.priority}
              </Badge>
            ) : null}
            {overdue ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-danger">
                <AlertCircle className="h-3 w-3" strokeWidth={1.75} />
                Overdue
              </span>
            ) : note.status === "today" ? (
              <span className="text-[10px] font-medium text-accent">Today</span>
            ) : null}
          </span>
        ) : (
          <span className="mt-0.5 flex items-center gap-1">
            {note.priority !== "none" ? (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  note.priority === "high" && "bg-danger",
                  note.priority === "medium" && "bg-warning",
                  note.priority === "low" && "bg-accent",
                )}
                title={`${note.priority} priority`}
              />
            ) : null}
            {overdue ? (
              <AlertCircle
                className="h-2.5 w-2.5 text-danger"
                strokeWidth={2}
                aria-label="Overdue"
              />
            ) : null}
          </span>
        )}
      </span>
    </motion.button>
  );
}
