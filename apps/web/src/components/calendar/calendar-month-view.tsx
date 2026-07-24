"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarEvent } from "@/components/calendar/calendar-event";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import {
  type CalendarCell,
  weekdayLabelsShort,
  type WeekStartsOn,
} from "@/lib/calendar-utils";
import { STICKY_CSS } from "@/lib/sticky-utils";

type CalendarMonthViewProps = {
  cells: CalendarCell[];
  weekStartsOn: WeekStartsOn;
  selectedKey: string;
  onSelectDay: (key: string, date: Date) => void;
  onOpenNote: (note: StickyNoteView) => void;
};

export function CalendarMonthView({
  cells,
  weekStartsOn,
  selectedKey,
  onSelectDay,
  onOpenNote,
}: CalendarMonthViewProps) {
  const reduced = useReducedMotion();
  const labels = weekdayLabelsShort(weekStartsOn);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.slow, ease: motionTokens.ease }
      }
      className={cn(
        "notebook-surface overflow-hidden rounded-[16px_20px_18px_14px]",
        "border-[1.75px] border-stroke-doodle/55",
        "shadow-[1px_2px_0_rgba(42,38,34,0.06),var(--paper-shadow)]",
      )}
    >
      <div className="grid grid-cols-7 border-b border-stroke-doodle/10 bg-surface/70 px-2 pt-3 sm:px-3">
        {labels.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr gap-px bg-stroke-doodle/10 p-px">
        <AnimatePresence mode="popLayout" initial={false}>
          {cells.map((cell) => {
            const selected = cell.key === selectedKey;
            const visible = cell.notes.slice(0, 3);
            const overflow = cell.notes.length - visible.length;

            return (
              <motion.div
                key={cell.key}
                layout={!reduced}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDay(cell.key, cell.date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectDay(cell.key, cell.date);
                  }
                }}
                className={cn(
                  "flex min-h-[5.5rem] cursor-pointer flex-col gap-1 bg-surface p-1.5 text-left sm:min-h-[7rem] sm:p-2",
                  "transition-colors hover:bg-accent-soft/40",
                  cell.isOutside && "bg-sticky-ink/40 text-ink-faint",
                  cell.isToday && "bg-accent-soft/55",
                  selected && "ring-2 ring-inset ring-accent/50",
                )}
                aria-label={`${cell.date.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}, ${cell.notes.length} stickies`}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    cell.isToday && "bg-accent text-accent-foreground",
                    !cell.isToday && cell.isOutside && "text-ink-faint",
                    !cell.isToday && !cell.isOutside && "text-ink",
                  )}
                >
                  {cell.day}
                </span>

                <div className="hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden sm:flex">
                  {visible.map((note) => (
                    <CalendarEvent
                      key={note.id}
                      note={note}
                      onOpen={onOpenNote}
                      dense
                    />
                  ))}
                  {overflow > 0 ? (
                    <span className="px-1 text-[10px] font-medium text-ink-muted">
                      +{overflow} more
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                  {cell.notes.slice(0, 4).map((note) => (
                    <span
                      key={note.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        note.status === "overdue" && "ring-1 ring-danger",
                      )}
                      style={{ backgroundColor: STICKY_CSS[note.color] }}
                      title={note.title || "Sticky"}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
