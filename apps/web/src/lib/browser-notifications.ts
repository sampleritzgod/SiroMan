"use client";

const SEEN_KEY = "siroman.reminder.seen";
const LAST_KEY = "siroman.reminder.lastNotificationAt";
const PROMPTED_KEY = "siroman.notif.firstReminderPrompted";
const ICON_PATH = "/icon-192.png";

/** Live Notification instances keyed by sticky id (tag). */
const liveByStickyId = new Map<string, Notification>();

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = [...ids].slice(-200);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // quota / private mode — ignore
  }
}

function markSeen(id: string) {
  const seen = readSeen();
  if (seen.has(id)) return;
  seen.add(id);
  writeSeen(seen);
}

function hasSeen(id: string): boolean {
  return readSeen().has(id);
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

export function getLastNotificationAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function setLastNotificationAt(iso: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_KEY, iso);
  } catch {
    // ignore
  }
}

export function wasFirstReminderPrompted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PROMPTED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstReminderPrompted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROMPTED_KEY, "1");
  } catch {
    // ignore
  }
}

/** Format due date (+ optional time) for notification body. */
export function formatNotificationDueBody(
  dueDate: string | null | undefined,
  dueTime?: string | null,
): string {
  if (!dueDate) return "Reminder for your sticky note.";

  let dateLabel = dueDate;
  try {
    const [y, m, d] = dueDate.split("-").map(Number);
    if (y && m && d) {
      dateLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    // keep raw civil date
  }

  if (dueTime) {
    const [hh, mm] = dueTime.split(":").map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      const period = hh >= 12 ? "PM" : "AM";
      const hour12 = hh % 12 === 0 ? 12 : hh % 12;
      const timeLabel = `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
      return `${dateLabel} · ${timeLabel}`;
    }
  }

  return dateLabel;
}

export type ShowBrowserNotificationInput = {
  /** Unique reminder id (inbox entry / occurrence) — used for dedupe. */
  reminderId: string;
  /** Sticky note id — used as Notification.tag. */
  stickyId: string;
  title: string;
  body: string;
  onClick?: () => void;
};

/**
 * Show a browser notification for a due reminder.
 * Returns true if a new notification was displayed.
 */
export function showBrowserNotification(
  input: ShowBrowserNotificationInput,
): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  if (hasSeen(input.reminderId)) return false;

  // Reserve seen slot before constructing — prevents duplicate storms on rapid polls.
  markSeen(input.reminderId);

  try {
    const icon =
      typeof window !== "undefined"
        ? new URL(ICON_PATH, window.location.origin).href
        : ICON_PATH;

    const previous = liveByStickyId.get(input.stickyId);
    previous?.close();

    const notification = new Notification(input.title, {
      body: input.body,
      icon,
      tag: input.stickyId,
    });

    liveByStickyId.set(input.stickyId, notification);
    setLastNotificationAt(new Date().toISOString());

    notification.onclick = () => {
      try {
        window.focus();
        input.onClick?.();
      } finally {
        notification.close();
      }
    };

    notification.onclose = () => {
      if (liveByStickyId.get(input.stickyId) === notification) {
        liveByStickyId.delete(input.stickyId);
      }
    };

    notification.onerror = () => {
      if (liveByStickyId.get(input.stickyId) === notification) {
        liveByStickyId.delete(input.stickyId);
      }
    };

    return true;
  } catch {
    // Construction can throw in restricted contexts — fail soft.
    return false;
  }
}

/** Close any live OS notification for a sticky (complete / archive / delete). */
export function cancelBrowserNotificationForSticky(stickyId: string) {
  const live = liveByStickyId.get(stickyId);
  if (!live) return;
  try {
    live.close();
  } catch {
    // ignore
  }
  liveByStickyId.delete(stickyId);
}

export function showTestBrowserNotification(): {
  ok: boolean;
  message: string;
} {
  if (!isBrowserNotificationSupported()) {
    return {
      ok: false,
      message: "Notifications aren’t supported in this browser.",
    };
  }
  const permission = Notification.permission;
  if (permission === "denied") {
    return {
      ok: false,
      message: "Notifications are blocked. Enable them in your browser settings.",
    };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      message: "Allow notifications first.",
    };
  }

  try {
    const icon = new URL(ICON_PATH, window.location.origin).href;
    const notification = new Notification("SiroMan", {
      body: "Test notification — you’re all set.",
      icon,
      tag: "siroman-test",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    setLastNotificationAt(new Date().toISOString());
    return { ok: true, message: "Test notification sent." };
  } catch {
    return { ok: false, message: "Couldn’t show a notification." };
  }
}

/**
 * Ask for permission on first dated sticky (never on page load).
 * Returns the resulting permission / unsupported.
 */
export async function maybePromptOnFirstReminder(opts: {
  hasDueDate: boolean;
  alreadyEnabled: boolean;
}): Promise<NotificationPermission | "unsupported" | "skipped"> {
  if (!opts.hasDueDate) return "skipped";
  if (opts.alreadyEnabled) return "skipped";
  if (wasFirstReminderPrompted()) return "skipped";
  if (!isBrowserNotificationSupported()) {
    markFirstReminderPrompted();
    return "unsupported";
  }
  if (Notification.permission !== "default") {
    markFirstReminderPrompted();
    return Notification.permission;
  }

  markFirstReminderPrompted();
  return requestBrowserNotificationPermission();
}

export function minuteToLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatLastNotificationLabel(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Never";
  }
}
