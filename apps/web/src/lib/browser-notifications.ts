"use client";

export {
  formatNotificationDueBody,
  formatDueTimeLabel,
} from "@/lib/browser-notification-copy";

const SEEN_KEY = "siroman.reminder.seen";
const LAST_KEY = "siroman.reminder.lastNotificationAt";
const PROMPTED_KEY = "siroman.notif.firstReminderPrompted";
const ICON_PATH = "/icon-192.png";
const SW_PATH = "/sw-notifications.js";

/** Live page-level Notification instances keyed by sticky id (tag). */
const liveByStickyId = new Map<string, Notification>();

let swRegisterPromise: Promise<ServiceWorkerRegistration | null> | null = null;

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

function iconHref(): string {
  return typeof window !== "undefined"
    ? new URL(ICON_PATH, window.location.origin).href
    : ICON_PATH;
}

/** Register the click-handling SW once (no scheduling inside the worker). */
export function ensureNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swRegisterPromise) {
    swRegisterPromise = navigator.serviceWorker
      .register(SW_PATH)
      .catch(() => null);
  }
  return swRegisterPromise;
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

function notificationOptions(
  input: ShowBrowserNotificationInput,
): NotificationOptions {
  return {
    body: input.body,
    icon: iconHref(),
    tag: input.stickyId,
    data: { stickyId: input.stickyId, reminderId: input.reminderId },
  };
}

function tryShowPageNotification(
  input: ShowBrowserNotificationInput,
): boolean {
  try {
    const previous = liveByStickyId.get(input.stickyId);
    previous?.close();

    const notification = new Notification(
      input.title,
      notificationOptions(input),
    );
    liveByStickyId.set(input.stickyId, notification);
    markSeen(input.reminderId);
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
    return false;
  }
}

/**
 * Show a browser notification for a due reminder.
 * Prefers Service Worker so click can reopen the app if the tab was closed.
 * Returns true if a new notification was displayed (or queued via SW).
 */
export function showBrowserNotification(
  input: ShowBrowserNotificationInput,
): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  if (hasSeen(input.reminderId)) return false;

  // Prefer SW when it already controls the page (reliable click → open).
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    // Reserve seen before async show — prevents duplicate storms on rapid polls.
    markSeen(input.reminderId);
    void ensureNotificationServiceWorker()
      .then(async (reg) => {
        const registration = reg ?? (await navigator.serviceWorker.ready);
        await registration.showNotification(
          input.title,
          notificationOptions(input),
        );
        setLastNotificationAt(new Date().toISOString());
      })
      .catch(() => {
        // SW show failed — attempt page Notification (seen already reserved).
        tryShowPageNotification(input);
      });
    return true;
  }

  // First visit / no controller yet: page Notification + register SW for later.
  void ensureNotificationServiceWorker();
  return tryShowPageNotification(input);
}

/** Close any live OS notification for a sticky (complete / archive / delete). */
export function cancelBrowserNotificationForSticky(stickyId: string) {
  const live = liveByStickyId.get(stickyId);
  if (live) {
    try {
      live.close();
    } catch {
      // ignore
    }
    liveByStickyId.delete(stickyId);
  }

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready
    .then(async (reg) => {
      const notes = await reg.getNotifications({ tag: stickyId });
      for (const note of notes) {
        try {
          note.close();
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {
      // ignore
    });
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

  const title = "SiroMan";
  const options: NotificationOptions = {
    body: "Test notification — you’re all set.",
    icon: iconHref(),
    tag: "siroman-test",
    data: { stickyId: null, reminderId: "test" },
  };

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      void ensureNotificationServiceWorker()
        .then(async (reg) => {
          const registration = reg ?? (await navigator.serviceWorker.ready);
          await registration.showNotification(title, options);
        })
        .catch(() => {
          const notification = new Notification(title, options);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        });
    } else {
      void ensureNotificationServiceWorker();
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
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
