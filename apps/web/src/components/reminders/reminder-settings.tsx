"use client";

import { useEffect, useState } from "react";
import type { ReminderFrequency } from "@stickyflow/shared";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUpdateMe } from "@/hooks/use-reminders";
import {
  formatLastNotificationLabel,
  getLastNotificationAt,
  getNotificationPermission,
  minuteToLabel,
  requestBrowserNotificationPermission,
  showTestBrowserNotification,
} from "@/lib/browser-notifications";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReminderSettingsPanelProps = {
  me: Me;
};

const FREQUENCIES: {
  value: ReminderFrequency;
  label: string;
  hint: string;
}[] = [
  {
    value: "gentle",
    label: "Gentle",
    hint: "Tomorrow · Today · Overdue",
  },
  {
    value: "standard",
    label: "Standard",
    hint: "7 days · 3 days · Tomorrow · Today · Overdue",
  },
  {
    value: "intensive",
    label: "Intensive",
    hint: "Standard + afternoon & evening nudges",
  },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour * 60);

function permissionLabel(permission: ReturnType<typeof getNotificationPermission>) {
  switch (permission) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    case "default":
      return "Not asked";
    case "unsupported":
      return "Unsupported";
    default:
      return permission;
  }
}

export function ReminderSettingsPanel({ me }: ReminderSettingsPanelProps) {
  const updateMe = useUpdateMe();
  const [permission, setPermission] = useState(getNotificationPermission());
  const [message, setMessage] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
    setLastAt(getLastNotificationAt());
  }, [me.browserNotificationsEnabled]);

  async function patch(partial: Parameters<typeof updateMe.mutateAsync>[0]) {
    setMessage(null);
    try {
      await updateMe.mutateAsync(partial);
      setMessage("Saved.");
    } catch {
      setMessage("Couldn’t save settings.");
    }
  }

  async function enableBrowserNotifications() {
    setMessage(null);
    const next = await requestBrowserNotificationPermission();
    setPermission(next);
    if (next === "granted") {
      await patch({ browserNotificationsEnabled: true });
      const result = showTestBrowserNotification();
      setLastAt(getLastNotificationAt());
      if (!result.ok) setMessage(result.message);
    } else if (next === "denied") {
      setMessage("Browser blocked notifications. Enable them in site settings.");
      await patch({ browserNotificationsEnabled: false });
    } else if (next === "default") {
      setMessage("Permission wasn’t granted yet.");
    } else {
      setMessage("Notifications aren’t available in this browser.");
    }
  }

  async function disableBrowserNotifications() {
    await patch({ browserNotificationsEnabled: false });
  }

  function handleTest() {
    setMessage(null);
    const result = showTestBrowserNotification();
    setLastAt(getLastNotificationAt());
    setMessage(result.message);
  }

  return (
    <div className="dot-surface space-y-5 rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/45 p-4 shadow-[var(--paper-shadow)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-hand text-2xl text-ink">Reminder settings</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tune how loudly SiroMan taps your shoulder — never spam.
          </p>
        </div>
        {message ? <Badge variant="outline">{message}</Badge> : null}
      </div>

      <ThemeToggle />

      <label className="flex items-center justify-between gap-4 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
        <span>
          <span className="block text-sm font-medium text-ink">
            Enable reminders
          </span>
          <span className="text-xs text-ink-muted">
            Master switch for the reminder engine
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={me.remindersEnabled}
          onChange={(e) =>
            void patch({ remindersEnabled: e.target.checked })
          }
        />
      </label>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          Reminder frequency
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {FREQUENCIES.map((freq) => {
            const selected = me.reminderFrequency === freq.value;
            return (
              <button
                key={freq.value}
                type="button"
                onClick={() => void patch({ reminderFrequency: freq.value })}
                className={cn(
                  "rounded-[12px_14px_11px_13px] border-[1.5px] px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-stroke-doodle bg-sticky-ink shadow-[1px_1px_0_var(--doodle-shadow-soft)]"
                    : "border-stroke-doodle/25 hover:bg-sticky-ink/50",
                )}
              >
                <p className="text-sm font-medium text-ink">{freq.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {freq.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          Morning reminder
          <select
            value={me.reminderMorningMinute}
            onChange={(e) =>
              void patch({ reminderMorningMinute: Number(e.target.value) })
            }
            className="h-10 rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface px-3 text-sm font-normal normal-case tracking-normal text-ink"
          >
            {HOUR_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>
                {minuteToLabel(minute)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          Evening reminder
          <select
            value={me.reminderEveningMinute}
            onChange={(e) =>
              void patch({ reminderEveningMinute: Number(e.target.value) })
            }
            className="h-10 rounded-[10px_12px_11px_13px] border-[1.5px] border-stroke-doodle/40 bg-surface px-3 text-sm font-normal normal-case tracking-normal text-ink"
          >
            {HOUR_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>
                {minuteToLabel(minute)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
        <p className="text-sm font-medium text-ink">Snooze options</p>
        <p className="mt-1 text-xs text-ink-muted">
          From any inbox reminder: <strong>1 hour</strong>,{" "}
          <strong>later today</strong> (evening time), or{" "}
          <strong>tomorrow morning</strong>.
        </p>
      </div>

      <div className="space-y-3 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <BellRing className="h-4 w-4 text-accent" strokeWidth={1.75} />
              Browser Notifications
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Deliver due reminders while this app tab is open.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <span className="text-xs text-ink-muted">
              {me.browserNotificationsEnabled ? "Enabled" : "Disabled"}
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={me.browserNotificationsEnabled}
              onChange={(e) => {
                if (e.target.checked) void enableBrowserNotifications();
                else void disableBrowserNotifications();
              }}
            />
          </label>
        </div>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-[10px_12px_11px_13px] border border-stroke-doodle/20 px-2.5 py-2">
            <dt className="text-ink-muted">Permission Status</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {permissionLabel(permission)}
            </dd>
          </div>
          <div className="rounded-[10px_12px_11px_13px] border border-stroke-doodle/20 px-2.5 py-2">
            <dt className="text-ink-muted">Last Notification Time</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {formatLastNotificationLabel(lastAt)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {permission !== "granted" && permission !== "unsupported" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void enableBrowserNotifications()}
            >
              Allow notifications
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleTest}
            disabled={
              permission !== "granted" || !me.browserNotificationsEnabled
            }
          >
            Test Notification
          </Button>
        </div>

        {permission === "denied" ? (
          <p className="text-xs text-ink-muted">
            Notifications are blocked for this site. Re-enable them in your
            browser’s site settings, then turn this switch on again.
          </p>
        ) : null}
        {permission === "unsupported" ? (
          <p className="text-xs text-ink-muted">
            This browser doesn’t support the Notification API.
          </p>
        ) : null}
      </div>

      {updateMe.isPending ? (
        <p className="text-xs text-ink-faint">Saving…</p>
      ) : null}
    </div>
  );
}
