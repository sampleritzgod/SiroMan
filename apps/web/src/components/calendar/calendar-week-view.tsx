"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarEvent } from "@/components/calendar/calendar-event";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import {
  type CalendarCell,
  weekdayLabels,
  type WeekStartsOn,
} from "@/lib/calendar-utils";

type CalendarWeekViewProps = {
  cells: CalendarCell[];
  weekStartsOn: WeekStartsOn;
  selectedKey: string;
  onSelectDay: (key: string, date: Date) => void;
  onOpenNote: (note: StickyNoteView) => void;
};

export function CalendarWeekView({
  cells,
  weekStartsOn,
  selectedKey,
  onSelectDay,
  onOpenNote,
}: CalendarWeekViewProps) {
  const reduced = useReducedMotion();
  const labels = weekdayLabels(weekStartsOn);

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
        "shadow-[1px_2px_0_var(--doodle-shadow-lift),var(--paper-shadow)]",
      )}
    >
      <div className="grid grid-cols-1 gap-px bg-stroke-doodle/10 md:grid-cols-7">
        {cells.map((cell, index) => {
          const selected = cell.key === selectedKey;
          return (
            <div
              key={cell.key}
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
                "flex min-h-[12rem] cursor-pointer flex-col bg-surface p-3 text-left transition-colors hover:bg-accent-soft/35",
                cell.isToday && "bg-accent-soft/50",
                selected && "ring-2 ring-inset ring-accent/45",
              )}
              aria-pressed={selected}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-stroke-doodle/10 pb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  {labels[index]}
                </span>
                <span
                  className={cn(
                    "font-hand text-2xl leading-none",
                    cell.isToday ? "text-accent" : "text-ink",
                  )}
                >
                  {cell.day}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                {cell.notes.length === 0 ? (
                  <p className="text-xs text-ink-faint">No due stickies</p>
                ) : (
                  cell.notes.map((note) => (
                    <CalendarEvent
                      key={note.id}
                      note={note}
                      onOpen={onOpenNote}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
