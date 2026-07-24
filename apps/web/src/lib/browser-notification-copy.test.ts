import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDueTimeLabel,
  formatNotificationDueBody,
} from "./browser-notification-copy";

describe("formatDueTimeLabel", () => {
  it("formats 24h times to 12h labels", () => {
    assert.equal(formatDueTimeLabel("17:00"), "5:00 PM");
    assert.equal(formatDueTimeLabel("09:05"), "9:05 AM");
    assert.equal(formatDueTimeLabel("00:00"), "12:00 AM");
    assert.equal(formatDueTimeLabel("12:30"), "12:30 PM");
  });

  it("rejects invalid times", () => {
    assert.equal(formatDueTimeLabel("25:00"), null);
    assert.equal(formatDueTimeLabel("nope"), null);
  });
});

describe("formatNotificationDueBody", () => {
  it("prefers Due at time when dueTime is set", () => {
    assert.equal(
      formatNotificationDueBody("2026-07-26", "17:00", "Due tomorrow."),
      "Due at 5:00 PM",
    );
  });

  it("uses Reminder Engine body without trailing period", () => {
    assert.equal(
      formatNotificationDueBody("2026-07-25", null, "Due today."),
      "Due today",
    );
    assert.equal(
      formatNotificationDueBody("2026-07-24", null, "Overdue by 1 day."),
      "Overdue by 1 day",
    );
  });

  it("falls back when no engine body", () => {
    assert.equal(
      formatNotificationDueBody(null, null, null),
      "Reminder for your sticky note",
    );
  });
});
