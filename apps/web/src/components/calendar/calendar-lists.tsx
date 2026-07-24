"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarEvent } from "@/components/calendar/calendar-event";
import { SectionHeader } from "@/components/md/section-header";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

type CalendarListsProps = {
  today: StickyNoteView[];
  upcoming: StickyNoteView[];
  onOpenNote: (note: StickyNoteView) => void;
  className?: string;
};

export function CalendarLists({
  today,
  upcoming,
  onOpenNote,
  className,
}: CalendarListsProps) {
  const reduced = useReducedMotion();

  return (
    <motion.aside
      initial={reduced ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: motionTokens.slow, ease: motionTokens.ease }
      }
      className={cn("space-y-6", className)}
    >
      <section className="space-y-3">
        <SectionHeader
          title="Today"
          description="Due today plus anything overdue."
        />
        <div
          className={cn(
            "dot-surface space-y-2 rounded-[16px_18px_14px_16px] border-[1.75px] border-stroke-doodle/45 p-3",
            "shadow-[var(--paper-shadow)]",
          )}
        >
          {today.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink-muted">
              Nothing due today. Enjoy the margin.
            </p>
          ) : (
            today.map((note) => (
              <CalendarEvent
                key={note.id}
                note={note}
                onOpen={onOpenNote}
                showDate={note.status === "overdue"}
              />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Upcoming"
          description="Stickies with due dates ahead."
        />
        <div
          className={cn(
            "dot-surface space-y-2 rounded-[16px_18px_14px_16px] border-[1.75px] border-stroke-doodle/45 p-3",
            "shadow-[var(--paper-shadow)]",
          )}
        >
          {upcoming.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink-muted">
              No upcoming due dates on the horizon.
            </p>
          ) : (
            upcoming.map((note) => (
              <CalendarEvent
                key={note.id}
                note={note}
                onOpen={onOpenNote}
                showDate
              />
            ))
          )}
        </div>
      </section>
    </motion.aside>
  );
}
