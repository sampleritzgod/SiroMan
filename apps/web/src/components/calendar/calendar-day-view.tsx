"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarEvent } from "@/components/calendar/calendar-event";
import { DoodleFrame } from "@/components/md/doodle-frame";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import { formatDayLabel } from "@/lib/calendar-utils";

type CalendarDayViewProps = {
  date: Date;
  notes: StickyNoteView[];
  onOpenNote: (note: StickyNoteView) => void;
};

export function CalendarDayView({
  date,
  notes,
  onOpenNote,
}: CalendarDayViewProps) {
  const reduced = useReducedMotion();

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
        "notebook-surface rounded-[16px_20px_18px_14px]",
        "border-[1.75px] border-stroke-doodle/55",
        "shadow-[1px_2px_0_var(--doodle-shadow-lift),var(--paper-shadow)]",
        "p-5 md:p-6",
      )}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-stroke-doodle/10 pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Day planner
          </p>
          <h3 className="mt-1 font-hand text-3xl leading-none text-ink">
            {formatDayLabel(date)}
          </h3>
        </div>
        <p className="text-sm text-ink-muted">
          {notes.length === 0
            ? "No dated stickies"
            : `${notes.length} sticky${notes.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {notes.length === 0 ? (
        <DoodleFrame
          preset="sketch-b"
          color="sage"
          className="max-w-md"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Quiet day</p>
          <p className="mt-2 text-sm text-ink-muted">
            No stickies are due on this date. Add a due date on a sticky and it
            will land here automatically.
          </p>
        </DoodleFrame>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {notes.map((note) => (
              <CalendarEvent
                key={note.id}
                note={note}
                onOpen={onOpenNote}
                showDate={note.status === "overdue"}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
