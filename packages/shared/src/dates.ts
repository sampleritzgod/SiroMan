import type { ItemStatus } from "./schemas.js";

/** Difference in calendar days: dueDate - today (negative = overdue). */
export function remainingDays(
  dueDate: Date | string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!dueDate) return null;
  const due = toCivilDate(dueDate);
  const now = toCivilDate(today);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

export function deriveItemStatus(input: {
  dueDate: Date | string | null | undefined;
  completedAt: Date | string | null | undefined;
  today?: Date;
}): ItemStatus {
  if (input.completedAt) return "done";
  if (!input.dueDate) return "note";

  const days = remainingDays(input.dueDate, input.today ?? new Date());
  if (days === null) return "note";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "upcoming";
}

/** Normalize to UTC midnight for civil-date math (YYYY-MM-DD semantics). */
export function toCivilDate(value: Date | string): Date {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      return new Date(Date.UTC(y, m - 1, d));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function formatCivilDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
