import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveItemStatus, remainingDays, toCivilDate } from "./dates.js";

describe("remainingDays", () => {
  it("returns null without due date", () => {
    assert.equal(remainingDays(null), null);
  });

  it("today is 0", () => {
    const today = toCivilDate("2026-07-24");
    assert.equal(remainingDays("2026-07-24", today), 0);
  });

  it("tomorrow is 1", () => {
    const today = toCivilDate("2026-07-24");
    assert.equal(remainingDays("2026-07-25", today), 1);
  });

  it("yesterday is -1", () => {
    const today = toCivilDate("2026-07-24");
    assert.equal(remainingDays("2026-07-23", today), -1);
  });
});

describe("deriveItemStatus", () => {
  const today = toCivilDate("2026-07-24");

  it("done wins", () => {
    assert.equal(
      deriveItemStatus({
        dueDate: "2026-07-24",
        completedAt: "2026-07-24T10:00:00.000Z",
        today,
      }),
      "done",
    );
  });

  it("note without due", () => {
    assert.equal(
      deriveItemStatus({ dueDate: null, completedAt: null, today }),
      "note",
    );
  });

  it("today / tomorrow / overdue / upcoming", () => {
    assert.equal(
      deriveItemStatus({
        dueDate: "2026-07-24",
        completedAt: null,
        today,
      }),
      "today",
    );
    assert.equal(
      deriveItemStatus({
        dueDate: "2026-07-25",
        completedAt: null,
        today,
      }),
      "tomorrow",
    );
    assert.equal(
      deriveItemStatus({
        dueDate: "2026-07-20",
        completedAt: null,
        today,
      }),
      "overdue",
    );
    assert.equal(
      deriveItemStatus({
        dueDate: "2026-08-01",
        completedAt: null,
        today,
      }),
      "upcoming",
    );
  });
});
