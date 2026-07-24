"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import {
  CalendarToolbar,
  type CalendarFilters,
} from "@/components/calendar/calendar-toolbar";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CalendarDayView } from "@/components/calendar/calendar-day-view";
import { CalendarLists } from "@/components/calendar/calendar-lists";
import { StickyEditor } from "@/components/item/sticky-editor";
import { SectionHeader } from "@/components/md/section-header";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { PencilDivider } from "@/components/md/pencil-divider";
import { Button } from "@/components/ui/button";
import {
  useItems,
  useStickyMutations,
  useTags,
} from "@/hooks/use-items";
import { formatApiError } from "@/lib/api-client";
import { motionTokens } from "@/lib/motion";
import type {
  CalendarMode,
  Me,
  StickyNoteInput,
  StickyNoteView,
} from "@/lib/types";
import {
  buildMonthCells,
  buildWeekCells,
  civilKeyFromLocal,
  filterNotesByRange,
  notesForDay,
  shiftAnchor,
  todayNotes,
  upcomingNotes,
  type WeekStartsOn,
} from "@/lib/calendar-utils";
import { enrichSticky } from "@/lib/sticky-utils";

type CalendarPageProps = {
  me: Me;
};

export function CalendarPage({ me }: CalendarPageProps) {
  const reduced = useReducedMotion();
  const weekStartsOn: WeekStartsOn = me.weekStartsOn ?? "monday";
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() =>
    civilKeyFromLocal(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    ),
  );
  const [filters, setFilters] = useState<CalendarFilters>({
    q: "",
    tag: "",
    priority: "",
    range: "all",
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StickyNoteView | null>(null);

  const agenda = useItems({
    view: "agenda",
    q: filters.q,
    tag: filters.tag,
    priority: filters.priority,
    sort: "dueDate",
    limit: 250,
  });
  const tags = useTags();
  const mutations = useStickyMutations();

  const notes = useMemo(() => {
    const raw = (agenda.data?.data ?? []).map((n) => enrichSticky(n));
    return filterNotesByRange(
      raw,
      filters.range,
      anchor,
      weekStartsOn,
    );
  }, [agenda.data?.data, filters.range, anchor, weekStartsOn]);

  const monthCells = useMemo(
    () => buildMonthCells(anchor, notes, weekStartsOn),
    [anchor, notes, weekStartsOn],
  );
  const weekCells = useMemo(
    () => buildWeekCells(anchor, notes, weekStartsOn),
    [anchor, notes, weekStartsOn],
  );
  const dayNotes = useMemo(() => notesForDay(notes, anchor), [notes, anchor]);

  const focusToday = useMemo(() => todayNotes(notes), [notes]);
  const focusUpcoming = useMemo(() => upcomingNotes(notes), [notes]);

  function openNote(note: StickyNoteView) {
    setEditing(note);
    setEditorOpen(true);
  }

  async function handleSave(input: StickyNoteInput) {
    if (!editing) return;
    await mutations.update.mutateAsync({ id: editing.id, patch: input });
  }

  function handleSelectDay(key: string, date: Date) {
    setSelectedKey(key);
    setAnchor(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    if (mode === "month" || mode === "week") {
      setMode("day");
    }
  }

  if (agenda.isLoading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="h-10 w-56 animate-pulse rounded-[12px_16px_14px_18px] bg-sticky-ink" />
        <div className="h-4 w-80 animate-pulse rounded-[10px] bg-sticky-ink/70" />
        <div className="h-[28rem] animate-pulse rounded-[16px_20px_18px_14px] bg-sticky-ink/55" />
        <p className="sr-only">Loading calendar…</p>
      </div>
    );
  }

  if (agenda.isError) {
    const message = formatApiError(
      agenda.error,
      "Couldn’t load calendar stickies.",
    );
    return (
      <div className="space-y-4">
        <DoodleFrame
          preset="sketch-c"
          color="blush"
          className="max-w-lg"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Calendar didn’t sync</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        </DoodleFrame>
        <Button type="button" onClick={() => void agenda.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: motionTokens.slow, ease: motionTokens.ease }
        }
        className="relative overflow-hidden rounded-[20px_24px_18px_22px] border-[1.75px] border-stroke-doodle/45 bg-surface/80 p-5 shadow-[var(--paper-shadow)] md:p-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full opacity-45"
          style={{
            background:
              "radial-gradient(circle, rgba(212,245,223,0.85), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
              <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.75} />
              Paper planner
            </p>
            <SectionHeader
              className="mt-2"
              title="Calendar"
              description="Sticky notes with due dates — same notes, drawn on a planner. No duplicates."
            />
          </div>
          <p className="rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-sticky-ink/70 px-3 py-2 text-sm text-ink-muted">
            <span className="font-hand text-xl text-ink">{notes.length}</span>{" "}
            dated
          </p>
        </div>
      </motion.section>

      <CalendarToolbar
        mode={mode}
        onModeChange={setMode}
        anchor={anchor}
        onPrev={() => {
          setAnchor((prev) => {
            const next = shiftAnchor(prev, mode, -1);
            setSelectedKey(
              civilKeyFromLocal(
                next.getFullYear(),
                next.getMonth(),
                next.getDate(),
              ),
            );
            return next;
          });
        }}
        onNext={() => {
          setAnchor((prev) => {
            const next = shiftAnchor(prev, mode, 1);
            setSelectedKey(
              civilKeyFromLocal(
                next.getFullYear(),
                next.getMonth(),
                next.getDate(),
              ),
            );
            return next;
          });
        }}
        onToday={() => {
          const now = new Date();
          setAnchor(now);
          setSelectedKey(
            civilKeyFromLocal(now.getFullYear(), now.getMonth(), now.getDate()),
          );
        }}
        weekStartsOn={weekStartsOn}
        filters={filters}
        onFiltersChange={setFilters}
        tags={tags.data ?? []}
      />

      <PencilDivider label="planner" />

      {notes.length === 0 && !filters.q && !filters.tag && !filters.priority && filters.range === "all" ? (
        <DoodleFrame
          preset="sketch-a"
          color="butter"
          className="max-w-lg"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Empty planner pages</p>
          <p className="mt-2 text-sm text-ink-muted">
            Give any sticky a due date and it appears here automatically. The
            sticky stays the single source of truth.
          </p>
        </DoodleFrame>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.7fr)]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {mode === "month" ? (
              <CalendarMonthView
                key="month"
                cells={monthCells}
                weekStartsOn={weekStartsOn}
                selectedKey={selectedKey}
                onSelectDay={handleSelectDay}
                onOpenNote={openNote}
              />
            ) : null}
            {mode === "week" ? (
              <CalendarWeekView
                key="week"
                cells={weekCells}
                weekStartsOn={weekStartsOn}
                selectedKey={selectedKey}
                onSelectDay={handleSelectDay}
                onOpenNote={openNote}
              />
            ) : null}
            {mode === "day" ? (
              <CalendarDayView
                key="day"
                date={anchor}
                notes={dayNotes}
                onOpenNote={openNote}
              />
            ) : null}
          </AnimatePresence>
        </div>

        <CalendarLists
          today={focusToday}
          upcoming={focusUpcoming}
          onOpenNote={openNote}
        />
      </div>

      <StickyEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editing}
        onSave={(input) => void handleSave(input)}
        onDelete={
          editing
            ? () => {
                void mutations.remove.mutateAsync(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}
