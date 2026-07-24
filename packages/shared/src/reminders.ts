import { z } from "zod";
import { formatCivilDate, remainingDays, toCivilDate } from "./dates.js";
import type { Priority } from "./schemas.js";

export const reminderFrequencySchema = z.enum([
  "gentle",
  "standard",
  "intensive",
]);

export type ReminderFrequency = z.infer<typeof reminderFrequencySchema>;

export const snoozePresetSchema = z.enum(["1h", "later_today", "tomorrow_9"]);
export type SnoozePreset = z.infer<typeof snoozePresetSchema>;

export const snoozeReminderSchema = z
  .object({
    preset: snoozePresetSchema.optional(),
    until: z.string().datetime().optional(),
  })
  .refine((value) => Boolean(value.preset || value.until), {
    message: "Provide a snooze preset or until timestamp",
  });

export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;

export type ReminderPolicyKey =
  | "d_minus_7"
  | "d_minus_3"
  | "d_minus_1"
  | "d_minus_1_evening"
  | "d_day"
  | "d_day_afternoon"
  | "overdue_daily"
  | "snooze";

export type ReminderPlanEntry = {
  policyKey: ReminderPolicyKey;
  fireAt: Date;
};

export type ReminderUserPrefs = {
  timezone: string;
  remindersEnabled: boolean;
  reminderFrequency: ReminderFrequency;
  reminderMorningMinute: number;
  reminderEveningMinute: number;
  quietHoursStartMinute: number;
  quietHoursEndMinute: number;
};

/** Read wall-clock parts in a timezone. */
export function getZonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") === 24 ? 0 : read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function civilDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Convert a local civil date + minute-of-day in `timeZone` to a UTC Date.
 * Uses an iterative offset correction (no external TZ deps).
 */
export function zonedLocalToUtc(
  civilDate: string,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) {
    throw new Error(`Invalid civil date: ${civilDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function addCivilDays(civilDate: string, days: number): string {
  const base = toCivilDate(civilDate);
  base.setUTCDate(base.getUTCDate() + days);
  return formatCivilDate(base);
}

export function isInQuietHours(
  date: Date,
  timeZone: string,
  quietStartMinute: number,
  quietEndMinute: number,
): boolean {
  const parts = getZonedParts(date, timeZone);
  const minute = parts.hour * 60 + parts.minute;
  if (quietStartMinute === quietEndMinute) return false;
  if (quietStartMinute < quietEndMinute) {
    return minute >= quietStartMinute && minute < quietEndMinute;
  }
  // Wraps midnight (e.g. 22:00–08:00)
  return minute >= quietStartMinute || minute < quietEndMinute;
}

/** If fireAt lands in quiet hours, shift to quiet-hours end that day (or next). */
export function shiftOutOfQuietHours(
  fireAt: Date,
  timeZone: string,
  quietStartMinute: number,
  quietEndMinute: number,
): Date {
  if (
    !isInQuietHours(fireAt, timeZone, quietStartMinute, quietEndMinute)
  ) {
    return fireAt;
  }

  const parts = getZonedParts(fireAt, timeZone);
  const civil = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const minute = parts.hour * 60 + parts.minute;

  // If quiet wraps midnight and we're after start, end is next civil morning.
  if (quietStartMinute > quietEndMinute && minute >= quietStartMinute) {
    return zonedLocalToUtc(addCivilDays(civil, 1), quietEndMinute, timeZone);
  }
  return zonedLocalToUtc(civil, quietEndMinute, timeZone);
}

function policiesForFrequency(
  frequency: ReminderFrequency,
  priority: Priority,
): ReminderPolicyKey[] {
  if (frequency === "gentle") {
    return ["d_minus_1", "d_day", "overdue_daily"];
  }

  const base: ReminderPolicyKey[] = [
    "d_minus_7",
    "d_minus_3",
    "d_minus_1",
    "d_day",
    "overdue_daily",
  ];

  if (frequency === "intensive") {
    base.push("d_day_afternoon");
    if (priority === "high") base.push("d_minus_1_evening");
  } else if (priority === "high") {
    base.push("d_minus_1_evening");
  }

  return base;
}

function offsetAndMinute(
  policyKey: ReminderPolicyKey,
  morningMinute: number,
  eveningMinute: number,
): { dayOffset: number; minute: number } | null {
  switch (policyKey) {
    case "d_minus_7":
      return { dayOffset: -7, minute: morningMinute };
    case "d_minus_3":
      return { dayOffset: -3, minute: morningMinute };
    case "d_minus_1":
      return { dayOffset: -1, minute: morningMinute };
    case "d_minus_1_evening":
      return { dayOffset: -1, minute: eveningMinute };
    case "d_day":
      return { dayOffset: 0, minute: morningMinute };
    case "d_day_afternoon":
      return { dayOffset: 0, minute: Math.min(1439, Math.max(morningMinute + 360, 15 * 60)) };
    case "overdue_daily":
      return { dayOffset: 1, minute: morningMinute };
    default:
      return null;
  }
}

/**
 * Build future reminder fire times for a dated sticky.
 * Overdue uses a rolling next-morning occurrence (not a year of rows).
 */
export function buildReminderPlan(input: {
  dueDate: string;
  priority: Priority;
  createdAt: Date;
  now?: Date;
  prefs: ReminderUserPrefs;
}): ReminderPlanEntry[] {
  if (!input.prefs.remindersEnabled) return [];

  const now = input.now ?? new Date();
  const { prefs } = input;
  const keys = policiesForFrequency(prefs.reminderFrequency, input.priority);
  const createdCivil = civilDateInTimeZone(input.createdAt, prefs.timezone);
  const todayCivil = civilDateInTimeZone(now, prefs.timezone);
  const plan: ReminderPlanEntry[] = [];

  for (const policyKey of keys) {
    if (policyKey === "overdue_daily") {
      if (input.dueDate >= todayCivil) continue;
      // Next morning reminder while overdue (rolling).
      const tomorrow = addCivilDays(todayCivil, 1);
      let fireAt = zonedLocalToUtc(
        todayCivil,
        prefs.reminderMorningMinute,
        prefs.timezone,
      );
      if (fireAt.getTime() <= now.getTime()) {
        fireAt = zonedLocalToUtc(
          tomorrow,
          prefs.reminderMorningMinute,
          prefs.timezone,
        );
      }
      fireAt = shiftOutOfQuietHours(
        fireAt,
        prefs.timezone,
        prefs.quietHoursStartMinute,
        prefs.quietHoursEndMinute,
      );
      if (fireAt.getTime() > now.getTime()) {
        plan.push({ policyKey, fireAt });
      }
      continue;
    }

    const meta = offsetAndMinute(
      policyKey,
      prefs.reminderMorningMinute,
      prefs.reminderEveningMinute,
    );
    if (!meta) continue;

    const fireCivil = addCivilDays(input.dueDate, meta.dayOffset);
    if (fireCivil < createdCivil) continue;

    let fireAt = zonedLocalToUtc(fireCivil, meta.minute, prefs.timezone);
    fireAt = shiftOutOfQuietHours(
      fireAt,
      prefs.timezone,
      prefs.quietHoursStartMinute,
      prefs.quietHoursEndMinute,
    );

    if (fireAt.getTime() <= now.getTime()) continue;
    plan.push({ policyKey, fireAt });
  }

  return plan.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

export function resolveSnoozeUntil(
  input: SnoozeReminderInput,
  prefs: Pick<
    ReminderUserPrefs,
    "timezone" | "reminderMorningMinute" | "reminderEveningMinute"
  >,
  now = new Date(),
): Date {
  if (input.until) return new Date(input.until);

  const today = civilDateInTimeZone(now, prefs.timezone);
  switch (input.preset) {
    case "1h":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "later_today": {
      const evening = zonedLocalToUtc(
        today,
        prefs.reminderEveningMinute,
        prefs.timezone,
      );
      if (evening.getTime() > now.getTime() + 5 * 60 * 1000) return evening;
      return new Date(now.getTime() + 60 * 60 * 1000);
    }
    case "tomorrow_9":
      return zonedLocalToUtc(
        addCivilDays(today, 1),
        prefs.reminderMorningMinute,
        prefs.timezone,
      );
    default:
      return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

/** Browser / inbox copy — single source for notification wording. */
export function buildReminderCopy(input: {
  title: string | null;
  dueDate: string | null;
  today?: Date;
}): { title: string; body: string } {
  const title = input.title?.trim() || "Untitled sticky";
  const days = remainingDays(input.dueDate, input.today);

  if (days === null) {
    return { title, body: "Reminder for your sticky note." };
  }
  if (days < 0) {
    const n = Math.abs(days);
    return {
      title,
      body: n === 1 ? "Overdue by 1 day." : `Overdue by ${n} days.`,
    };
  }
  if (days === 0) return { title, body: "Due today." };
  if (days === 1) return { title, body: "Due tomorrow." };
  if (days === 3) return { title, body: "3 days remaining." };
  if (days === 7) return { title, body: "7 days remaining." };
  return { title, body: `${days} days remaining.` };
}

export function reminderBucketFromDays(
  days: number | null,
): "upcoming" | "today" | "overdue" | "none" {
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}
