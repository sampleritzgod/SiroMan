import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReminderCopy,
  buildReminderPlan,
  shiftOutOfQuietHours,
  zonedLocalToUtc,
} from "./reminders.js";

describe("buildReminderPlan", () => {
  it("schedules 7d → 3d → tomorrow → today for standard frequency", () => {
    const plan = buildReminderPlan({
      dueDate: "2026-08-20",
      priority: "medium",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      now: new Date("2026-07-24T03:00:00.000Z"),
      prefs: {
        timezone: "UTC",
        remindersEnabled: true,
        reminderFrequency: "standard",
        reminderMorningMinute: 540,
        reminderEveningMinute: 1080,
        quietHoursStartMinute: 1320,
        quietHoursEndMinute: 480,
      },
    });

    const keys = plan.map((p) => p.policyKey);
    assert.ok(keys.includes("d_minus_7"));
    assert.ok(keys.includes("d_minus_3"));
    assert.ok(keys.includes("d_minus_1"));
    assert.ok(keys.includes("d_day"));
    assert.ok(!keys.includes("overdue_daily"));
  });

  it("builds overdue rolling reminder when past due", () => {
    const plan = buildReminderPlan({
      dueDate: "2026-07-20",
      priority: "low",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      now: new Date("2026-07-24T12:00:00.000Z"),
      prefs: {
        timezone: "UTC",
        remindersEnabled: true,
        reminderFrequency: "gentle",
        reminderMorningMinute: 540,
        reminderEveningMinute: 1080,
        quietHoursStartMinute: 1320,
        quietHoursEndMinute: 480,
      },
    });

    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.policyKey, "overdue_daily");
  });
});

describe("buildReminderCopy", () => {
  it("matches product copy examples", () => {
    assert.equal(
      buildReminderCopy({
        title: "Build Portfolio",
        dueDate: "2026-07-25",
        today: new Date("2026-07-24T12:00:00.000Z"),
      }).body,
      "Due tomorrow.",
    );
    assert.equal(
      buildReminderCopy({
        title: "React Assignment",
        dueDate: "2026-07-24",
        today: new Date("2026-07-24T12:00:00.000Z"),
      }).body,
      "Due today.",
    );
    assert.equal(
      buildReminderCopy({
        title: "DSA Practice",
        dueDate: "2026-07-27",
        today: new Date("2026-07-24T12:00:00.000Z"),
      }).body,
      "3 days remaining.",
    );
  });
});

describe("quiet hours", () => {
  it("shifts fire time out of quiet window", () => {
    const late = zonedLocalToUtc("2026-07-24", 23 * 60, "UTC");
    const shifted = shiftOutOfQuietHours(late, "UTC", 1320, 480);
    assert.ok(shifted.getTime() > late.getTime());
  });
});
