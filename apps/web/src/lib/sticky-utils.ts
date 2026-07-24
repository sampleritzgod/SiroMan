import {
  deriveItemStatus,
  remainingDays,
  type StickyColor,
} from "@stickyflow/shared";
import type { StickyNote, StickyNoteView } from "@/lib/types";

export const STICKY_COLORS: StickyColor[] = [
  "butter",
  "mist",
  "sage",
  "blush",
  "slate",
  "lavender",
  "peach",
  "ink",
];

export const STICKY_COLOR_LABELS: Record<StickyColor, string> = {
  butter: "Butter",
  mist: "Mist",
  sage: "Sage",
  blush: "Blush",
  slate: "Slate",
  lavender: "Lavender",
  peach: "Peach",
  ink: "Ink",
};

export const STICKY_CSS: Record<StickyColor, string> = {
  butter: "var(--sticky-butter)",
  mist: "var(--sticky-mist)",
  sage: "var(--sticky-sage)",
  blush: "var(--sticky-blush)",
  slate: "var(--sticky-slate)",
  lavender: "var(--sticky-lavender)",
  peach: "var(--sticky-peach)",
  ink: "var(--sticky-ink)",
};

export function enrichSticky(note: StickyNote, today = new Date()): StickyNoteView {
  const status =
    note.status ??
    deriveItemStatus({
      dueDate: note.dueDate,
      completedAt: note.completedAt,
      today,
    });
  const days =
    note.remainingDays ?? remainingDays(note.dueDate, today);

  return {
    ...note,
    content: note.content ?? note.description,
    description: note.description ?? note.content,
    status,
    remainingDays: days,
  };
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function formatRelativeActivity(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function civilDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isCompletedToday(
  completedAt: string | null | undefined,
  today = new Date(),
): boolean {
  if (!completedAt) return false;
  return civilDayKey(new Date(completedAt)) === civilDayKey(today);
}

export function computeStreak(notes: StickyNote[], today = new Date()): number {
  const completedDays = new Set(
    notes
      .filter((n) => n.completedAt)
      .map((n) => civilDayKey(new Date(n.completedAt!))),
  );

  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const todayKey = civilDayKey(cursor);
  if (!completedDays.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (completedDays.has(civilDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function sketchPresetForId(id: string): "sketch-a" | "sketch-b" | "sketch-c" {
  const presets = ["sketch-a", "sketch-b", "sketch-c"] as const;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 97;
  }
  return presets[hash % 3];
}
