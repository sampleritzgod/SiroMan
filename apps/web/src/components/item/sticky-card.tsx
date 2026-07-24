"use client";

import {
  Archive,
  Check,
  CloudOff,
  ExternalLink,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { DueChip } from "@/components/md/due-chip";
import { CalendarSyncBadge } from "@/components/item/calendar-sync-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStickyCalendarActions } from "@/hooks/use-calendar-sync";
import type { StickyNoteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";
import { sketchPresetForId, STICKY_CSS } from "@/lib/sticky-utils";

const presets = {
  "sketch-a":
    "M6.2,11.5 C9,3.8 19.5,5.2 28,6.8 C41,9.2 49,3.5 62,6.1 C74,8.5 83,4.2 95,7.4 C106,10.2 114,5.8 119.2,10.5 L118.4,88.2 C112,97.5 98,93.2 86,94.8 C72,96.6 61,90.5 48,93.2 C34,96.1 22,91.4 11.2,94.6 C6.8,95.8 4.5,91.2 5.1,86.5 Z",
  "sketch-b":
    "M5.5,13 C14,2.5 31,7.8 45,5.2 C61,2.2 74,9.5 89,5.8 C101,3.1 114,8.4 119,14.2 L117.2,87.5 C108,98 92,93.5 78,95.8 C62,98.4 49,91.2 34,94.5 C20,97.5 9.5,92.2 5.8,86.8 Z",
  "sketch-c":
    "M7.8,15.2 C18,3.5 37,8.8 52,5.5 C69,1.8 84,9.2 99,5.2 C110,2.5 117,10.8 118.5,16.5 L116.8,85.2 C104,97.8 86,92.5 70,95.2 C52,98.2 38,90.8 23,94.2 C12,96.5 5.5,90.5 6.2,84.8 Z",
} as const;

type StickyCardProps = {
  note: StickyNoteView;
  onEdit: (note: StickyNoteView) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onToggleComplete: (id: string) => void;
  delay?: number;
  compact?: boolean;
};

export function StickyCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onToggleComplete,
  delay = 0,
  compact = false,
}: StickyCardProps) {
  const reduced = useReducedMotion();
  const preset = sketchPresetForId(note.id);
  const path = presets[preset];
  const fill = STICKY_CSS[note.color];
  const done = Boolean(note.completedAt);
  const calendar = useStickyCalendarActions();
  const sync = note.calendarSync ?? {
    status: "local_only" as const,
    provider: null,
    externalEventId: null,
    htmlLink: null,
    lastError: null,
  };
  const canCalendarAct = Boolean(note.dueDate) && !note.archived;

  return (
    <motion.article
      layout
      initial={
        reduced ? false : { opacity: 0, y: 12, scale: 0.96, rotate: -1.2 }
      }
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.94, rotate: 1, transition: { duration: 0.15 } }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 380,
              damping: 24,
              delay,
            }
      }
      whileHover={
        reduced
          ? undefined
          : {
              y: -4,
              rotate: 0.6,
              transition: { duration: motionTokens.fast },
            }
      }
      className={cn(
        "group relative",
        compact ? "min-h-[140px]" : "min-h-[180px]",
        done && "opacity-70",
      )}
    >
      <div className="relative h-full">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 124 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={path}
            fill="none"
            stroke="var(--stroke-doodle)"
            strokeWidth="2.5"
            strokeOpacity="0.12"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            transform="translate(1.2 1.1)"
          />
          <path d={path} fill={fill} stroke="none" />
          <path
            d={path}
            fill="none"
            stroke="var(--stroke-doodle)"
            strokeWidth="1.85"
            strokeOpacity="0.88"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          className="relative m-[4.5%] flex h-[calc(100%-9%)] flex-col overflow-hidden rounded-[calc(var(--radius-md)-2px)] p-4 on-sticky"
          style={{
            backgroundColor: fill,
            boxShadow: "inset 0 1px 0 var(--paper-highlight)",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.15 0 0 0 0 0.12 0 0 0 0 0.1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundBlendMode: "multiply",
          }}
        >
          <span
            aria-hidden
            className="sticky-tape pointer-events-none absolute -top-1 left-1/2 h-3 w-11 -translate-x-1/2 rotate-[-2deg] rounded-[2px]"
          />

          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {note.pinned ? (
                <Badge variant="muted" className="bg-[color:var(--sticky-overlay)] text-[color:var(--on-sticky)]/70">
                  <Pin className="h-3 w-3" strokeWidth={1.75} />
                  Pinned
                </Badge>
              ) : null}
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
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Sticky actions"
                  className="rounded-[8px_10px_9px_11px] border border-transparent p-1 text-[color:var(--on-sticky)]/55 opacity-70 transition-colors hover:border-[color:var(--on-sticky)]/20 hover:bg-[color:var(--sticky-overlay)] hover:text-[color:var(--on-sticky)] group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8}>
                <DropdownMenuItem onSelect={() => onEdit(note)}>
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTogglePin(note.id)}>
                  {note.pinned ? (
                    <PinOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                  ) : (
                    <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  {note.pinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onToggleArchive(note.id)}>
                  <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {note.archived ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
                {canCalendarAct && sync.htmlLink ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      window.open(
                        sync.htmlLink!,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Open in Google Calendar
                  </DropdownMenuItem>
                ) : null}
                {canCalendarAct ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      void calendar.syncNow.mutateAsync(note.id);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {sync.status === "failed" ? "Retry sync" : "Sync Now"}
                  </DropdownMenuItem>
                ) : null}
                {canCalendarAct &&
                (sync.status === "synced" ||
                  sync.status === "failed" ||
                  sync.status === "syncing") ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      void calendar.removeFromCalendar.mutateAsync(note.id);
                    }}
                  >
                    <CloudOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Remove from Calendar
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem danger onSelect={() => onDelete(note.id)}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            type="button"
            onClick={() => onEdit(note)}
            className="min-w-0 flex-1 text-left"
          >
            <h3
              className={cn(
                "font-hand text-[1.45rem] leading-tight text-[color:var(--on-sticky)]",
                done && "line-through decoration-[color:var(--on-sticky)]/35",
              )}
            >
              {note.title?.trim() || "Untitled sticky"}
            </h3>
            {note.description ? (
              <p
                className={cn(
                  "mt-2 line-clamp-3 text-sm leading-relaxed text-[color:var(--on-sticky)]/80",
                  done && "line-through decoration-[color:var(--on-sticky)]/30",
                )}
              >
                {note.description}
              </p>
            ) : null}
          </button>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <DueChip status={note.status} remainingDays={note.remainingDays} />
            {note.dueTime ? (
              <Badge variant="muted" className="bg-[color:var(--sticky-overlay)] text-[color:var(--on-sticky)]/65">
                {note.dueTime}
              </Badge>
            ) : null}
            <CalendarSyncBadge sync={sync} />
            {note.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="muted"
                className="bg-[color:var(--sticky-overlay)] text-[color:var(--on-sticky)]/60"
              >
                #{tag}
              </Badge>
            ))}
            {note.tags.length > 2 ? (
              <Badge variant="muted">+{note.tags.length - 2}</Badge>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant={done ? "secondary" : "ghost"}
              className="h-8 min-h-8 px-2.5"
              onClick={() => onToggleComplete(note.id)}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              {done ? "Reopen" : "Complete"}
            </Button>
            <span className="sr-only">Color: {note.color}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
