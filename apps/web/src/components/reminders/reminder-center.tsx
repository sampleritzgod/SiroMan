"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  BellOff,
  CheckCheck,
  Clock3,
  Settings2,
} from "lucide-react";
import { NotificationCard } from "@/components/md/notification-card";
import { SectionHeader } from "@/components/md/section-header";
import { DoodleFrame } from "@/components/md/doodle-frame";
import { PencilDivider } from "@/components/md/pencil-divider";
import { DueChip } from "@/components/md/due-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StickyEditor } from "@/components/item/sticky-editor";
import { ReminderSettingsPanel } from "@/components/reminders/reminder-settings";
import { CalendarSyncSettingsPanel } from "@/components/calendar/calendar-sync-settings";
import {
  useInbox,
  useReminderBoard,
  useReminderMutations,
} from "@/hooks/use-reminders";
import { useStickyMutations } from "@/hooks/use-items";
import { useApiClient } from "@/lib/api-client";
import { formatApiError } from "@/lib/api-client";
import { formatRelativeActivity, STICKY_CSS } from "@/lib/sticky-utils";
import { motionTokens } from "@/lib/motion";
import type {
  InboxEntry,
  Me,
  ReminderBoardItem,
  StickyNote,
  StickyNoteInput,
  StickyNoteView,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ReminderCenterProps = {
  me: Me;
};

export function ReminderCenter({ me }: ReminderCenterProps) {
  const reduced = useReducedMotion();
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState<StickyNoteView | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const board = useReminderBoard();
  const inbox = useInbox(false);
  const mutations = useReminderMutations();
  const stickyMutations = useStickyMutations();
  const { api } = useApiClient();

  const entries = inbox.data?.data ?? [];
  const unread = useMemo(
    () => entries.filter((e) => !e.readAt),
    [entries],
  );

  async function openItem(itemId: string) {
    try {
      const note = await api<StickyNote>(`/v1/items/${itemId}`);
      setEditing(note);
      setEditorOpen(true);
      const related = entries.find((e) => e.itemId === itemId && !e.readAt);
      if (related) void mutations.markRead.mutateAsync(related.id);
    } catch {
      // ignore
    }
  }

  async function handleSave(input: StickyNoteInput) {
    if (!editing) return;
    await stickyMutations.update.mutateAsync({ id: editing.id, patch: input });
  }

  if (board.isLoading || inbox.isLoading) {
    return (
      <div className="space-y-4" role="status">
        <div className="h-10 w-56 animate-pulse rounded-[12px_16px_14px_18px] bg-sticky-ink" />
        <div className="h-40 animate-pulse rounded-[16px_20px_18px_14px] bg-sticky-ink/55" />
      </div>
    );
  }

  if (board.isError || inbox.isError) {
    const message = formatApiError(
      board.error ?? inbox.error,
      "Couldn’t load reminders.",
    );
    return (
      <div className="space-y-4">
        <DoodleFrame preset="sketch-c" color="blush" className="max-w-lg" interactive={false}>
          <p className="font-hand text-2xl text-ink">Reminders didn’t sync</p>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
        </DoodleFrame>
        <Button
          type="button"
          onClick={() => {
            void board.refetch();
            void inbox.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const data = board.data!;

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
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, var(--glow-blush), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
              {me.remindersEnabled ? (
                <Bell className="h-4 w-4 text-accent" strokeWidth={1.75} />
              ) : (
                <BellOff className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
              )}
              Reminder board
            </p>
            <SectionHeader
              className="mt-2"
              title="Reminders"
              description="Sticky notes with due dates — nudged gently so commitments stick."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={me.remindersEnabled ? "accent" : "outline"}>
              {me.remindersEnabled ? "On" : "Paused"}
            </Badge>
            <Badge variant="warning">{unread.length} unread</Badge>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.75} />
              Settings
            </Button>
            {unread.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void mutations.markAllRead.mutateAsync()}
              >
                <CheckCheck className="h-4 w-4" strokeWidth={1.75} />
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {showSettings ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <ReminderSettingsPanel me={me} />
            <CalendarSyncSettingsPanel />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PencilDivider label="live" />

      <div className="grid gap-6 xl:grid-cols-2">
        <ReminderSection
          title="Overdue"
          description="Past due — keep nudging until done or archived."
          tone="danger"
          items={data.overdue}
          empty="Nothing overdue. Nice."
          onOpen={(item) => void openItem(item.id)}
        />
        <ReminderSection
          title="Today"
          description="Due today."
          tone="accent"
          items={data.today}
          empty="Clear horizon for today."
          onOpen={(item) => void openItem(item.id)}
        />
        <ReminderSection
          title="Upcoming"
          description="Dated stickies still ahead."
          tone="default"
          items={data.upcoming}
          empty="No upcoming due dates."
          onOpen={(item) => void openItem(item.id)}
        />
        <ReminderSection
          title="Recently completed"
          description="Commitments you kept."
          tone="success"
          items={data.recentlyCompleted}
          empty="Complete a dated sticky to fill this board."
          onOpen={(item) => void openItem(item.id)}
        />
      </div>

      <PencilDivider label="inbox" />

      <section className="space-y-3">
        <SectionHeader
          title="Notification inbox"
          description="Fired reminders — snooze, dismiss, or open the sticky."
        />
        {entries.length === 0 ? (
          <DoodleFrame
            preset="sketch-b"
            color="mist"
            className="max-w-lg"
            interactive={false}
          >
            <p className="font-hand text-2xl text-ink">Inbox is quiet</p>
            <p className="mt-2 text-sm text-ink-muted">
              When a reminder fires, it pins here like a sticky on a cork board.
            </p>
          </DoodleFrame>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {entries.map((entry) => (
                <InboxRow
                  key={entry.id}
                  entry={entry}
                  onOpen={() => void openItem(entry.itemId)}
                  onRead={() => void mutations.markRead.mutateAsync(entry.id)}
                  onSnooze={(preset) =>
                    void mutations.snooze.mutateAsync({
                      occurrenceId: entry.occurrenceId,
                      input: { preset },
                    })
                  }
                  onDismiss={() =>
                    void mutations.dismiss.mutateAsync(entry.occurrenceId)
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <StickyEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={editing}
        onSave={(input) => void handleSave(input)}
        onDelete={
          editing
            ? () => {
                void stickyMutations.remove.mutateAsync(editing.id);
              }
            : undefined
        }
      />
    </div>
  );
}

function ReminderSection({
  title,
  description,
  items,
  empty,
  tone,
  onOpen,
}: {
  title: string;
  description: string;
  items: ReminderBoardItem[];
  empty: string;
  tone: "danger" | "accent" | "success" | "default";
  onOpen: (item: ReminderBoardItem) => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} description={description} />
      <div
        className={cn(
          "dot-surface min-h-[10rem] space-y-2 rounded-[16px_20px_18px_14px] border-[1.75px] p-3 shadow-[var(--paper-shadow)]",
          tone === "danger" && "border-danger/30 bg-sticky-blush/30",
          tone === "accent" && "border-accent/30 bg-accent-soft/40",
          tone === "success" && "border-success/25 bg-sticky-sage/35",
          tone === "default" && "border-stroke-doodle/45",
        )}
      >
        {items.length === 0 ? (
          <p className="px-1 py-3 text-sm text-ink-muted">{empty}</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-start gap-3 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/25 bg-surface/95 px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span
                className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: STICKY_CSS[item.color] }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {item.title || "Untitled sticky"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <DueChip
                    status={item.status}
                    remainingDays={item.remainingDays}
                  />
                  {item.priority !== "none" ? (
                    <Badge
                      variant={
                        item.priority === "high"
                          ? "danger"
                          : item.priority === "medium"
                            ? "warning"
                            : "accent"
                      }
                    >
                      {item.priority}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function InboxRow({
  entry,
  onOpen,
  onRead,
  onSnooze,
  onDismiss,
}: {
  entry: InboxEntry;
  onOpen: () => void;
  onRead: () => void;
  onSnooze: (preset: "1h" | "later_today" | "tomorrow_9") => void;
  onDismiss: () => void;
}) {
  const accent = entry.item
    ? STICKY_CSS[entry.item.color]
    : "var(--sticky-butter)";

  return (
    <NotificationCard
      title={entry.title}
      body={entry.body ?? undefined}
      timeLabel={formatRelativeActivity(entry.createdAt)}
      unread={!entry.readAt}
      accentColor={accent}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onOpen}>
            Open sticky
          </Button>
          {!entry.readAt ? (
            <Button type="button" size="sm" variant="ghost" onClick={onRead}>
              Mark read
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSnooze("1h")}
          >
            <Clock3 className="h-3.5 w-3.5" strokeWidth={1.75} />
            1h
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSnooze("later_today")}
          >
            Later
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSnooze("tomorrow_9")}
          >
            Tomorrow
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </>
      }
    />
  );
}
