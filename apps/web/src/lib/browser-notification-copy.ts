/**
 * Pure copy helpers for browser notifications.
 * Kept free of DOM APIs so unit tests can run in Node.
 */

/** Format HH:mm → "5:00 PM". Returns null if invalid. */
export function formatDueTimeLabel(dueTime: string): string | null {
  const [hhRaw, mmRaw] = dueTime.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
}

/**
 * Notification body:
 * - Timed sticky → "Due at 5:00 PM"
 * - Else Reminder Engine body (strip trailing period) → "Due today"
 * - Else fallback
 */
export function formatNotificationDueBody(
  dueDate: string | null | undefined,
  dueTime?: string | null,
  engineBody?: string | null,
): string {
  if (dueTime) {
    const timeLabel = formatDueTimeLabel(dueTime);
    if (timeLabel) return `Due at ${timeLabel}`;
  }

  const fromEngine = engineBody?.trim();
  if (fromEngine) {
    return fromEngine.replace(/\.$/, "");
  }

  if (!dueDate) return "Reminder for your sticky note";

  let dateLabel = dueDate;
  try {
    const [y, m, d] = dueDate.split("-").map(Number);
    if (y && m && d) {
      dateLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  } catch {
    // keep raw civil date
  }

  return `Due ${dateLabel}`;
}
