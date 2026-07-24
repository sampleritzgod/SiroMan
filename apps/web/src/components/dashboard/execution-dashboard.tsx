"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Flame, Plus } from "lucide-react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { TaskRow } from "@/components/dashboard/task-row";
import { StickyCard } from "@/components/item/sticky-card";
import { StickyEditor } from "@/components/item/sticky-editor";
import { QuickAddSticky } from "@/components/item/quick-add-sticky";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { NotificationCard } from "@/components/md/notification-card";
import { PencilDivider } from "@/components/md/pencil-divider";
import { SectionHeader } from "@/components/md/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiError } from "@/lib/api-client";
import type { Me, StickyNoteInput, StickyNoteView } from "@/lib/types";
import {
  computeStreak,
  enrichSticky,
  formatRelativeActivity,
  greetingForHour,
  isCompletedToday,
  STICKY_CSS,
} from "@/lib/sticky-utils";
import { motionTokens } from "@/lib/motion";

type WorkspaceActions = {
  active: StickyNoteView[];
  archived: StickyNoteView[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  create: (input: StickyNoteInput) => Promise<unknown>;
  update: (id: string, patch: StickyNoteInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  togglePin: (id: string) => Promise<unknown>;
  toggleArchive: (id: string) => Promise<unknown>;
  toggleComplete: (id: string) => Promise<unknown>;
};

type ExecutionDashboardProps = {
  me: Me;
  stickies: WorkspaceActions;
};

function urgencyRank(note: StickyNoteView): number {
  if (note.status === "overdue") return 0;
  if (note.status === "today") return 1;
  if (note.pinned) return 2;
  if (note.priority === "high") return 3;
  return 4;
}

function activityBody(note: StickyNoteView): string {
  if (note.archived) return "Archived";
  if (note.completedAt) {
    return isCompletedToday(note.completedAt)
      ? "Completed today"
      : "Marked complete";
  }
  if (note.pinned) return "Pinned on board";
  if (note.status === "overdue") return "Still overdue";
  if (note.status === "today") return "Due today";
  return "Updated";
}

export function ExecutionDashboard({ me, stickies }: ExecutionDashboardProps) {
  const reduced = useReducedMotion();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StickyNoteView | null>(null);

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const firstName = me.displayName?.split(" ")[0] ?? "there";
  const activeNotes = useMemo(
    () => stickies.active.map((n) => enrichSticky(n)),
    [stickies.active],
  );
  const archivedNotes = useMemo(
    () => stickies.archived.map((n) => enrichSticky(n)),
    [stickies.archived],
  );
  const allNotes = useMemo(
    () => [...activeNotes, ...archivedNotes],
    [activeNotes, archivedNotes],
  );

  const openNotes = useMemo(
    () => activeNotes.filter((n) => !n.completedAt),
    [activeNotes],
  );

  const focusNotes = useMemo(() => {
    return openNotes
      .filter(
        (n) =>
          n.status === "today" ||
          n.status === "overdue" ||
          n.pinned ||
          n.priority === "high",
      )
      .sort((a, b) => {
        const diff = urgencyRank(a) - urgencyRank(b);
        if (diff !== 0) return diff;
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      })
      .slice(0, 4);
  }, [openNotes]);

  const overdueNotes = useMemo(() => {
    return openNotes
      .filter((n) => n.status === "overdue")
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [openNotes]);

  const upcomingNotes = useMemo(() => {
    return openNotes
      .filter(
        (n) =>
          n.dueDate &&
          (n.status === "upcoming" ||
            n.status === "tomorrow" ||
            n.status === "today"),
      )
      .sort((a, b) => {
        const byDate = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        if (byDate !== 0) return byDate;
        return (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
      })
      .slice(0, 8);
  }, [openNotes]);

  const completedToday = useMemo(() => {
    return allNotes
      .filter((n) => isCompletedToday(n.completedAt))
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 8);
  }, [allNotes]);

  const streak = useMemo(() => computeStreak(allNotes), [allNotes]);

  const activity = useMemo(() => {
    return [...allNotes]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);
  }, [allNotes]);

  const nextUp = focusNotes[0] ?? overdueNotes[0] ?? upcomingNotes[0] ?? null;
  const openCount = openNotes.length;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(note: StickyNoteView) {
    setEditing(note);
    setEditorOpen(true);
  }

  async function handleSave(input: StickyNoteInput) {
    if (editing) await stickies.update(editing.id, input);
    else await stickies.create(input);
  }

  if (stickies.isLoading) {
    return <DashboardSkeleton />;
  }

  if (stickies.isError) {
    const message = formatApiError(
      stickies.error,
      "Couldn’t load your sticky notes.",
    );
    return (
      <div className="space-y-4">
        <DoodleFrame
          preset="sketch-c"
          color="blush"
          className="max-w-lg"
          interactive={false}
        >
          <p className="font-hand text-2xl text-ink">Stickies didn’t sync</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        </DoodleFrame>
        <Button type="button" onClick={() => stickies.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: motionTokens.slow, ease: motionTokens.ease }
        }
        className="relative overflow-hidden rounded-[20px_24px_18px_22px] border-[1.75px] border-stroke-doodle/45 bg-surface/80 p-6 shadow-[var(--paper-shadow)] md:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(255,241,168,0.7), transparent 70%)",
          }}
        />
        <p className="text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-2 font-hand text-4xl leading-[0.95] text-ink md:text-5xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
          {nextUp
            ? `Next up: ${nextUp.title || "Untitled sticky"}${
                nextUp.status === "overdue"
                  ? " — overdue"
                  : nextUp.status === "today"
                    ? " — due today"
                    : ""
              }.`
            : openCount === 0
              ? "Board is clear. Capture the next commitment when you’re ready."
              : `${openCount} open stickies — pick one and move.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {nextUp ? (
            <Button type="button" onClick={() => openEdit(nextUp)}>
              Do this next
            </Button>
          ) : (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Add a sticky
            </Button>
          )}
          {overdueNotes.length > 0 ? (
            <Badge variant="danger">{overdueNotes.length} overdue</Badge>
          ) : null}
          {completedToday.length > 0 ? (
            <Badge variant="accent">
              {completedToday.length} done today
            </Badge>
          ) : null}
        </div>
      </motion.section>

      <section className="space-y-4">
        <SectionHeader
          title="Today’s focus"
          description="Overdue, due today, pinned, and high-priority — act here first."
        />
        {focusNotes.length === 0 ? (
          <DoodleFrame
            preset="sketch-b"
            color="sage"
            className="max-w-lg"
            interactive={false}
          >
            <p className="font-hand text-2xl text-ink">Clear horizon</p>
            <p className="mt-2 text-sm text-ink-muted">
              Nothing urgent right now. Pin a sticky or add a due date to shape
              today’s focus.
            </p>
            <Button
              type="button"
              className="mt-4"
              variant="secondary"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Quick add
            </Button>
          </DoodleFrame>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {focusNotes.map((note, index) => (
                <StickyCard
                  key={note.id}
                  note={note}
                  compact
                  delay={index * 0.04}
                  onEdit={openEdit}
                  onDelete={(id) => void stickies.remove(id)}
                  onTogglePin={(id) => void stickies.togglePin(id)}
                  onToggleArchive={(id) => void stickies.toggleArchive(id)}
                  onToggleComplete={(id) => void stickies.toggleComplete(id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader
            title="Overdue tasks"
            description="Still open past their due date."
            action={
              overdueNotes.length > 0 ? (
                <Badge variant="danger">{overdueNotes.length}</Badge>
              ) : null
            }
          />
          <div className="space-y-2">
            {overdueNotes.length === 0 ? (
              <DoodleFrame
                preset="sketch-a"
                color="mist"
                className="w-full"
                interactive={false}
              >
                <p className="font-hand text-xl text-ink">Nothing overdue</p>
                <p className="mt-1.5 text-sm text-ink-muted">
                  You’re caught up on dated commitments.
                </p>
              </DoodleFrame>
            ) : (
              overdueNotes.map((note) => (
                <TaskRow
                  key={note.id}
                  note={note}
                  onOpen={openEdit}
                  subtitle={
                    note.dueDate
                      ? `Due ${note.dueDate}${note.dueTime ? ` · ${note.dueTime}` : ""}`
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Upcoming tasks"
            description="Dated stickies coming up."
          />
          <div className="space-y-2">
            {upcomingNotes.length === 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-ink-muted">
                    No upcoming due dates. Add one when a sticky becomes a
                    commitment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              upcomingNotes.map((note) => (
                <TaskRow
                  key={note.id}
                  note={note}
                  onOpen={openEdit}
                  subtitle={
                    note.dueDate
                      ? `${note.dueDate}${note.dueTime ? ` · ${note.dueTime}` : ""}`
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>

      <PencilDivider label="momentum" />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader
            title="Current streak"
            description="Consecutive days with at least one completion."
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[1.6rem]">
                <Flame className="h-5 w-5 text-warning" strokeWidth={1.75} />
                Keep going
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-hand text-5xl text-ink">{streak}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {streak === 0
                  ? "Complete a sticky to start a streak."
                  : streak === 1
                    ? "day of kept commitments"
                    : "days of kept commitments"}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Completed today"
            description="Wins locked in for this civil day."
            action={
              completedToday.length > 0 ? (
                <Badge variant="accent">{completedToday.length}</Badge>
              ) : null
            }
          />
          <div className="space-y-2">
            {completedToday.length === 0 ? (
              <Card>
                <CardContent className="flex items-start gap-3 pt-5">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint"
                    strokeWidth={1.75}
                  />
                  <p className="text-sm text-ink-muted">
                    Nothing completed yet today. Checking one off keeps the
                    streak alive.
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedToday.map((note) => (
                <TaskRow
                  key={note.id}
                  note={note}
                  onOpen={openEdit}
                  subtitle={
                    note.completedAt
                      ? formatRelativeActivity(note.completedAt)
                      : undefined
                  }
                  className="opacity-90"
                />
              ))
            )}
          </div>
        </section>
      </div>

      <PencilDivider />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <QuickAddSticky
            onCreate={stickies.create}
            title="Quick add sticky"
            description="Capture without leaving the dashboard."
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Recent activity"
            description="Latest edits across your board."
          />
          <div className="space-y-2.5">
            {activity.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              activity.map((note) => (
                <NotificationCard
                  key={note.id}
                  title={note.title || "Untitled sticky"}
                  body={activityBody(note)}
                  timeLabel={formatRelativeActivity(note.updatedAt)}
                  unread={!note.archived && !note.completedAt}
                  accentColor={STICKY_CSS[note.color]}
                  actions={
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 min-h-8"
                      onClick={() => openEdit(note)}
                    >
                      Open
                    </Button>
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>

      <StickyEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editing}
        onSave={(input) => void handleSave(input)}
        onDelete={
          editing
            ? () => {
                void stickies.remove(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}
