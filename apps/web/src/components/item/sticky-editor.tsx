"use client";

import { useEffect, useState } from "react";
import type { Priority, StickyColor } from "@stickyflow/shared";
import { ColorPicker } from "@/components/item/color-picker";
import { PriorityPicker } from "@/components/item/priority-picker";
import { CalendarSyncBadge } from "@/components/item/calendar-sync-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStickyCalendarActions } from "@/hooks/use-calendar-sync";
import type { StickyNoteInput, StickyNoteView } from "@/lib/types";
import { STICKY_CSS } from "@/lib/sticky-utils";

type StickyEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: StickyNoteView | null;
  onSave: (input: StickyNoteInput) => void;
  onDelete?: () => void;
};

type FormState = {
  title: string;
  description: string;
  color: StickyColor;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  tags: string;
  pinned: boolean;
  archived: boolean;
};

function toForm(note?: StickyNoteView | null): FormState {
  return {
    title: note?.title ?? "",
    description: note?.description ?? "",
    color: note?.color ?? "butter",
    priority: note?.priority ?? "none",
    dueDate: note?.dueDate ?? "",
    dueTime: note?.dueTime ?? "",
    tags: note?.tags.join(", ") ?? "",
    pinned: note?.pinned ?? false,
    archived: note?.archived ?? false,
  };
}

export function StickyEditor({
  open,
  onOpenChange,
  note,
  onSave,
  onDelete,
}: StickyEditorProps) {
  const [form, setForm] = useState<FormState>(() => toForm(note));
  const isEdit = Boolean(note);
  const calendar = useStickyCalendarActions();
  const sync = note?.calendarSync;

  useEffect(() => {
    if (open) setForm(toForm(note));
  }, [open, note]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 8);

    onSave({
      title: form.title.trim() || null,
      description: form.description.trim(),
      color: form.color,
      priority: form.priority,
      dueDate: form.dueDate || null,
      dueTime: form.dueDate ? form.dueTime || null : null,
      tags,
      pinned: form.pinned,
      archived: form.archived,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0">
        <div
          className="h-2.5 w-full"
          style={{ backgroundColor: STICKY_CSS[form.color] }}
          aria-hidden
        />
        <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-4">
          <div>
            <DialogTitle>
              {isEdit ? "Edit sticky" : "New sticky note"}
            </DialogTitle>
            <p className="mt-1 text-sm text-ink-muted">
              Capture the commitment. Add a due date when it matters.
            </p>
          </div>

          <div>
            <Label htmlFor="sticky-title">Title</Label>
            <Input
              id="sticky-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What needs follow-through?"
              maxLength={120}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="sticky-body">Content</Label>
            <Textarea
              id="sticky-body"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Details, links, or context…"
            />
          </div>

          <div>
            <Label>Color</Label>
            <ColorPicker
              value={form.color}
              onChange={(color) => setForm((f) => ({ ...f, color }))}
            />
          </div>

          <div>
            <Label>Priority</Label>
            <PriorityPicker
              value={form.priority}
              onChange={(priority) => setForm((f) => ({ ...f, priority }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="sticky-due">Due date</Label>
              <Input
                id="sticky-due"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    dueDate: e.target.value,
                    dueTime: e.target.value ? f.dueTime : "",
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="sticky-time">Time (optional)</Label>
              <Input
                id="sticky-time"
                type="time"
                value={form.dueTime}
                disabled={!form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueTime: e.target.value }))
                }
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Empty = all-day on calendar
              </p>
            </div>
            <div>
              <Label htmlFor="sticky-tags">Tags</Label>
              <Input
                id="sticky-tags"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="design, client, billing"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ToggleChip
              active={form.pinned}
              label="Pinned"
              onClick={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
            />
            <ToggleChip
              active={form.archived}
              label="Archived"
              onClick={() => setForm((f) => ({ ...f, archived: !f.archived }))}
            />
          </div>

          {isEdit && sync ? (
            <div className="space-y-2 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/25 bg-sticky-ink/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarSyncBadge sync={sync} />
                {sync.htmlLink ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 min-h-8"
                    onClick={() =>
                      window.open(sync.htmlLink!, "_blank", "noopener,noreferrer")
                    }
                  >
                    Open in Google Calendar
                  </Button>
                ) : null}
                {note?.dueDate && !note.archived ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 min-h-8"
                      onClick={() => void calendar.syncNow.mutateAsync(note.id)}
                    >
                      {sync.status === "failed" ? "Retry sync" : "Sync Now"}
                    </Button>
                    {sync.status !== "local_only" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 min-h-8"
                        onClick={() =>
                          void calendar.removeFromCalendar.mutateAsync(note.id)
                        }
                      >
                        Remove from Calendar
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              {sync.status === "failed" && sync.lastError ? (
                <p className="text-xs text-danger">{sync.lastError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke-doodle/15 pt-4">
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">{isEdit ? "Save changes" : "Create sticky"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle bg-sticky-ink px-3 py-2 text-sm font-medium text-ink"
          : "rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/25 bg-transparent px-3 py-2 text-sm text-ink-muted hover:bg-sticky-ink/60"
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
