import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGoogleApiError,
} from "./googleApiLog.js";
import { GoogleCalendarProvider } from "./googleProvider.js";

describe("Google Calendar provider", () => {
  const provider = new GoogleCalendarProvider({
    clientId: "test-client",
    clientSecret: "test-secret",
    redirectUri: "http://localhost:4000/v1/integrations/google/callback",
  });

  it("uses official scopes including calendar.events", () => {
    const url = provider.getAuthorizationUrl("state-token");
    assert.match(url, /googleapis\.com/);
    assert.match(
      decodeURIComponent(url),
      /https:\/\/www\.googleapis\.com\/auth\/calendar\.events/,
    );
    assert.match(
      decodeURIComponent(url),
      /https:\/\/www\.googleapis\.com\/auth\/calendar\.readonly/,
    );
  });

  it("resolves default calendar to primary", () => {
    assert.equal(provider.resolveCalendarId(undefined), "primary");
    assert.equal(provider.resolveCalendarId(""), "primary");
    assert.equal(provider.resolveCalendarId("default"), "primary");
    assert.equal(provider.resolveCalendarId("primary"), "primary");
    assert.equal(
      provider.resolveCalendarId("abc123@group.calendar.google.com"),
      "abc123@group.calendar.google.com",
    );
  });

  it("builds all-day event body without null date/dateTime fields", () => {
    const body = provider.toGoogleBody({
      stickyItemId: "item_1",
      title: "Ship it",
      description: "desc",
      dueDate: "2026-07-30",
      dueTime: null,
      timezone: "Asia/Kolkata",
      completed: false,
    });

    assert.equal(body.start.date, "2026-07-30");
    assert.equal(body.end.date, "2026-07-31");
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.start, "dateTime"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.end, "dateTime"),
      false,
    );
    assert.equal(JSON.stringify(body).includes("null"), false);
  });

  it("builds timed event body without null date fields", () => {
    const body = provider.toGoogleBody({
      stickyItemId: "item_1",
      title: "Call",
      description: "",
      dueDate: "2026-07-30",
      dueTime: "14:30",
      timezone: "Asia/Kolkata",
      completed: true,
    });

    assert.equal(body.summary, "✓ Call");
    assert.equal(body.start.dateTime, "2026-07-30T14:30:00");
    assert.equal(body.end.dateTime, "2026-07-30T15:30:00");
    assert.equal(body.start.timeZone, "Asia/Kolkata");
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.start, "date"),
      false,
    );
    assert.equal(JSON.stringify(body).includes(":null"), false);
  });

  it("formats full Google API error bodies (never suppresses)", () => {
    const formatted = formatGoogleApiError({
      code: 400,
      message: "Invalid Value",
      response: {
        status: 400,
        statusText: "Bad Request",
        data: {
          error: {
            code: 400,
            message: "Invalid value for: null is not a valid value",
            errors: [
              {
                domain: "global",
                reason: "invalid",
                message: "Invalid value for: null is not a valid value",
              },
            ],
          },
        },
        config: {
          method: "POST",
          url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          params: { alt: "json" },
        },
      },
    });

    assert.match(formatted, /HTTP 400/);
    assert.match(formatted, /null is not a valid value/);
    assert.match(formatted, /calendar\/v3\/calendars\/primary\/events/);
    assert.match(formatted, /body=/);
  });
});
