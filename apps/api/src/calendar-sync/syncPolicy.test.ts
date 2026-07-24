import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalendarProvider,
  ExternalEventInput,
  ExternalEventRef,
  OAuthTokenSet,
  RemoveEventMode,
  SyncableSticky,
} from "./types.js";
import {
  applyCalendarSyncTransition,
  isPendingExternalId,
  makePendingExternalId,
  shouldPushToCalendar,
} from "./syncPolicy.js";

class FakeGoogleProvider implements CalendarProvider {
  readonly id = "google" as const;
  events = new Map<string, ExternalEventInput>();
  removed: Array<{ id: string; mode: RemoveEventMode }> = [];
  failNext: Error | null = null;
  configured = true;

  isConfigured() {
    return this.configured;
  }

  getAuthorizationUrl(state: string) {
    return `https://example.test/oauth?state=${state}`;
  }

  async exchangeAuthorizationCode(): Promise<OAuthTokenSet> {
    return {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: new Date(Date.now() + 3600_000),
      accountEmail: "user@example.com",
    };
  }

  async refreshAccessToken(): Promise<OAuthTokenSet> {
    return {
      accessToken: "access-refreshed",
      refreshToken: "refresh",
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async createAllDayEvent(
    _accessToken: string,
    calendarId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef> {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
    const id = `evt_${this.events.size + 1}`;
    this.events.set(id, event);
    return {
      externalEventId: id,
      calendarId,
      etag: `"etag-${id}"`,
      htmlLink: `https://calendar.google.com/event?eid=${id}`,
    };
  }

  async updateAllDayEvent(
    _accessToken: string,
    calendarId: string,
    externalEventId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef> {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
    if (!this.events.has(externalEventId)) {
      throw Object.assign(new Error("Not found"), { code: 404 });
    }
    this.events.set(externalEventId, event);
    return {
      externalEventId,
      calendarId,
      etag: `"etag-${externalEventId}-u"`,
      htmlLink: `https://calendar.google.com/event?eid=${externalEventId}`,
    };
  }

  async removeEvent(
    _accessToken: string,
    _calendarId: string,
    externalEventId: string,
    mode: RemoveEventMode,
  ): Promise<void> {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
    this.events.delete(externalEventId);
    this.removed.push({ id: externalEventId, mode });
  }
}

function sticky(partial: Partial<SyncableSticky> = {}): SyncableSticky {
  return {
    id: "item_1",
    title: "Ship calendar sync",
    description: "Test sticky",
    dueDate: "2026-07-30",
    dueTime: null,
    archived: false,
    completedAt: null,
    priority: "medium",
    timezone: "Asia/Kolkata",
    ...partial,
  };
}

describe("calendar sync policy", () => {
  it("pushes only dated, non-archived stickies", () => {
    assert.equal(shouldPushToCalendar(sticky()), true);
    assert.equal(shouldPushToCalendar(sticky({ dueDate: null })), false);
    assert.equal(shouldPushToCalendar(sticky({ archived: true })), false);
  });

  it("creates an event for a new dated sticky", async () => {
    const provider = new FakeGoogleProvider();
    const transition = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: null,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });

    assert.equal(transition.result.ok, true);
    if (transition.result.ok) assert.equal(transition.result.action, "created");
    assert.equal(provider.events.size, 1);
    assert.equal(transition.next?.syncStatus, "synced");
    assert.equal(transition.next?.externalEventId, "evt_1");
  });

  it("updates the same event when the sticky changes", async () => {
    const provider = new FakeGoogleProvider();
    const created = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: null,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });
    assert.ok(created.next);

    const updated = await applyCalendarSyncTransition({
      sticky: sticky({
        title: "Ship calendar sync (v2)",
        dueDate: "2026-08-01",
        dueTime: "14:30",
      }),
      existing: created.next,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });

    assert.equal(updated.result.ok, true);
    if (updated.result.ok) assert.equal(updated.result.action, "updated");
    assert.equal(provider.events.size, 1);
    assert.equal(
      provider.events.get("evt_1")?.title,
      "Ship calendar sync (v2)",
    );
    assert.equal(provider.events.get("evt_1")?.dueTime, "14:30");
  });

  it("cancels the event when the sticky is archived", async () => {
    const provider = new FakeGoogleProvider();
    const created = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: null,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });
    assert.ok(created.next);

    const archived = await applyCalendarSyncTransition({
      sticky: sticky({ archived: true }),
      existing: created.next,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });

    assert.equal(archived.result.ok, true);
    if (archived.result.ok) assert.equal(archived.result.action, "removed");
    assert.deepEqual(provider.removed, [{ id: "evt_1", mode: "cancel" }]);
    assert.equal(archived.next?.syncStatus, "removed");
  });

  it("deletes the event when policy is delete (sticky deleted/cleared)", async () => {
    const provider = new FakeGoogleProvider();
    const created = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: null,
      calendarId: "primary",
      onRemovePolicy: "delete",
      provider,
      accessToken: "tok",
    });
    assert.ok(created.next);

    const cleared = await applyCalendarSyncTransition({
      sticky: sticky({ dueDate: null }),
      existing: created.next,
      calendarId: "primary",
      onRemovePolicy: "delete",
      provider,
      accessToken: "tok",
    });

    assert.equal(cleared.result.ok, true);
    if (cleared.result.ok) assert.equal(cleared.result.action, "removed");
    assert.deepEqual(provider.removed, [{ id: "evt_1", mode: "delete" }]);
  });

  it("stores a retryable error map when create fails", async () => {
    const provider = new FakeGoogleProvider();
    provider.failNext = new Error("Google 503");

    const failed = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: null,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });

    assert.equal(failed.result.ok, false);
    if (!failed.result.ok) {
      assert.equal(failed.result.retryable, true);
      assert.match(failed.result.error, /Google 503/);
    }
    assert.equal(failed.next?.syncStatus, "error");
    assert.ok(failed.next && isPendingExternalId(failed.next.externalEventId));
    assert.equal(
      failed.next?.externalEventId,
      makePendingExternalId("item_1"),
    );

    const retried = await applyCalendarSyncTransition({
      sticky: sticky(),
      existing: failed.next,
      calendarId: "primary",
      onRemovePolicy: "cancel",
      provider,
      accessToken: "tok",
    });
    assert.equal(retried.result.ok, true);
    if (retried.result.ok) assert.equal(retried.result.action, "created");
    assert.equal(retried.next?.syncStatus, "synced");
    assert.equal(retried.next?.externalEventId, "evt_1");
  });
});
