import { formatCivilDate, toCivilDate } from "@stickyflow/shared";
import type {
  CalendarRangeFilter,
  StickyNoteView,
} from "@/lib/types";

export type WeekStartsOn = "sunday" | "monday";

export type CalendarCell = {
  /** Civil YYYY-MM-DD */
  key: string;
  date: Date;
  day: number;
  isToday: boolean;
  isOutside: boolean;
  isCurrentMonth: boolean;
  notes: StickyNoteView[];
};

export function civilKeyFromDate(date: Date): string {
  return formatCivilDate(toCivilDate(date));
}

export function civilKeyFromLocal(
  year: number,
  monthIndex: number,
  day: number,
): string {
  return formatCivilDate(
    toCivilDate(
      `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ),
  );
}

export function parseCivilLocal(value: string): Date {
  const civil = toCivilDate(value);
  return new Date(
    civil.getUTCFullYear(),
    civil.getUTCMonth(),
    civil.getUTCDate(),
  );
}

export function addDaysLocal(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfWeekLocal(
  date: Date,
  weekStartsOn: WeekStartsOn,
): Date {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = cursor.getDay();
  const offset =
    weekStartsOn === "monday" ? (day + 6) % 7 : day;
  cursor.setDate(cursor.getDate() - offset);
  return cursor;
}

export function endOfWeekLocal(date: Date, weekStartsOn: WeekStartsOn): Date {
  return addDaysLocal(startOfWeekLocal(date, weekStartsOn), 6);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function weekdayLabels(weekStartsOn: WeekStartsOn): string[] {
  const monFirst = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sunFirst = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekStartsOn === "monday" ? monFirst : sunFirst;
}

export function weekdayLabelsShort(weekStartsOn: WeekStartsOn): string[] {
  const monFirst = ["M", "T", "W", "T", "F", "S", "S"];
  const sunFirst = ["S", "M", "T", "W", "T", "F", "S"];
  return weekStartsOn === "monday" ? monFirst : sunFirst;
}

export function groupNotesByDueDate(
  notes: StickyNoteView[],
): Map<string, StickyNoteView[]> {
  const map = new Map<string, StickyNoteView[]>();
  for (const note of notes) {
    if (!note.dueDate) continue;
    const list = map.get(note.dueDate) ?? [];
    list.push(note);
    map.set(note.dueDate, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return (a.title ?? a.content).localeCompare(b.title ?? b.content);
    });
  }
  return map;
}

function priorityRank(priority: StickyNoteView["priority"]): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

export function buildMonthCells(
  anchor: Date,
  notes: StickyNoteView[],
  weekStartsOn: WeekStartsOn,
  today = new Date(),
): CalendarCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = startOfMonthLocal(anchor);
  const gridStart = startOfWeekLocal(first, weekStartsOn);
  const byDue = groupNotesByDueDate(notes);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = addDaysLocal(gridStart, i);
    const key = civilKeyFromLocal(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    cells.push({
      key,
      date,
      day: date.getDate(),
      isToday: isSameLocalDay(date, today),
      isOutside: date.getMonth() !== month || date.getFullYear() !== year,
      isCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
      notes: byDue.get(key) ?? [],
    });
  }

  return cells;
}

export function buildWeekCells(
  anchor: Date,
  notes: StickyNoteView[],
  weekStartsOn: WeekStartsOn,
  today = new Date(),
): CalendarCell[] {
  const weekStart = startOfWeekLocal(anchor, weekStartsOn);
  const byDue = groupNotesByDueDate(notes);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = addDaysLocal(weekStart, i);
    const key = civilKeyFromLocal(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    cells.push({
      key,
      date,
      day: date.getDate(),
      isToday: isSameLocalDay(date, today),
      isOutside: false,
      isCurrentMonth: true,
      notes: byDue.get(key) ?? [],
    });
  }

  return cells;
}

export function notesForDay(
  notes: StickyNoteView[],
  day: Date,
): StickyNoteView[] {
  const key = civilKeyFromLocal(day.getFullYear(), day.getMonth(), day.getDate());
  return groupNotesByDueDate(notes).get(key) ?? [];
}

export function filterNotesByRange(
  notes: StickyNoteView[],
  range: CalendarRangeFilter,
  anchor: Date,
  weekStartsOn: WeekStartsOn,
  today = new Date(),
): StickyNoteView[] {
  if (range === "all") return notes;

  let start: Date;
  let end: Date;

  if (range === "today") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    end = start;
  } else if (range === "week") {
    start = startOfWeekLocal(today, weekStartsOn);
    end = endOfWeekLocal(today, weekStartsOn);
  } else {
    start = startOfMonthLocal(anchor);
    end = endOfMonthLocal(anchor);
  }

  const startKey = civilKeyFromLocal(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endKey = civilKeyFromLocal(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );

  return notes.filter((note) => {
    if (!note.dueDate) return false;
    return note.dueDate >= startKey && note.dueDate <= endKey;
  });
}

export function todayNotes(
  notes: StickyNoteView[],
  today = new Date(),
): StickyNoteView[] {
  const key = civilKeyFromLocal(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return notes
    .filter((n) => n.dueDate === key || n.status === "overdue")
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    });
}

export function upcomingNotes(
  notes: StickyNoteView[],
  today = new Date(),
  limit = 8,
): StickyNoteView[] {
  const key = civilKeyFromLocal(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return notes
    .filter(
      (n) =>
        n.dueDate &&
        n.dueDate > key &&
        (n.status === "upcoming" || n.status === "tomorrow"),
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, limit);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekLabel(date: Date, weekStartsOn: WeekStartsOn): string {
  const start = startOfWeekLocal(date, weekStartsOn);
  const end = endOfWeekLocal(date, weekStartsOn);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shiftAnchor(
  anchor: Date,
  mode: "month" | "week" | "day",
  direction: -1 | 1,
): Date {
  if (mode === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  }
  if (mode === "week") {
    return addDaysLocal(anchor, direction * 7);
  }
  return addDaysLocal(anchor, direction);
}
