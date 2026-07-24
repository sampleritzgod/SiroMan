import { google } from "googleapis";
import type { CalendarProviderId } from "@stickyflow/shared";
import {
  addMinutesToDueTime,
  normalizeIanaTimeZone,
} from "@stickyflow/shared";
import type {
  CalendarProvider,
  ExternalEventInput,
  ExternalEventRef,
  OAuthTokenSet,
  RemoveEventMode,
} from "../../types.js";
import {
  attachGoogleApiLogging,
  formatGoogleApiError,
  logGoogleApiError,
  logGoogleApiRequest,
  logGoogleApiResponse,
} from "./googleApiLog.js";

/**
 * calendar.events — create/update/delete events (including on "primary")
 * calendar.readonly — calendarList.get/list + calendars.get for verification
 * userinfo.email — account email for Settings status
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

const SCOPES = [...GOOGLE_CALENDAR_SCOPES];

const EXT_KEY = "siromanItemId";
const EXT_PRIVATE = true;
const DEFAULT_TIMED_DURATION_MINUTES = 60;
const PRIMARY_CALENDAR_ID = "primary";

export type GoogleProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleTokenIntrospection = {
  active: boolean;
  expiresAt: Date | null;
  scopes: string[];
  email: string | null;
  audience: string | null;
  raw: unknown;
};

export type GooglePrimaryCalendar = {
  id: string;
  summary: string | null;
  timeZone: string | null;
  primary: boolean;
  accessRole: string | null;
};

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id: CalendarProviderId = "google";

  constructor(private readonly config: GoogleProviderConfig | null) {}

  isConfigured(): boolean {
    return Boolean(
      this.config?.clientId &&
        this.config?.clientSecret &&
        this.config?.redirectUri,
    );
  }

  private oauthClient(withLogging = true) {
    if (!this.config) {
      throw new Error("Google Calendar is not configured");
    }
    const client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
    );
    if (withLogging) {
      attachGoogleApiLogging(client, "google-oauth-client");
    }
    return client;
  }

  getAuthorizationUrl(state: string): string {
    const client = this.oauthClient(false);
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
      include_granted_scopes: true,
    });
    console.info("[google-calendar:oauth]", {
      action: "authorize_url",
      scopes: SCOPES,
      redirectUri: this.config?.redirectUri,
    });
    return url;
  }

  async exchangeAuthorizationCode(code: string): Promise<OAuthTokenSet> {
    const client = this.oauthClient();
    logGoogleApiRequest("oauth.exchangeAuthorizationCode", {
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      params: { grant_type: "authorization_code" },
      data: { code: `${code.slice(0, 8)}…` },
    });
    try {
      const { tokens } = await client.getToken(code);
      logGoogleApiResponse("oauth.exchangeAuthorizationCode", {
        status: 200,
        data: {
          hasAccessToken: Boolean(tokens.access_token),
          hasRefreshToken: Boolean(tokens.refresh_token),
          expiry_date: tokens.expiry_date ?? null,
          scope: tokens.scope ?? null,
          token_type: tokens.token_type ?? null,
        },
        config: {
          method: "POST",
          url: "https://oauth2.googleapis.com/token",
        },
      });
      if (!tokens.access_token) {
        throw new Error("Google OAuth did not return an access token");
      }

      client.setCredentials(tokens);

      // Verify token + scopes immediately (do not suppress failures).
      const introspection = await this.introspectAccessToken(tokens.access_token);
      this.assertCalendarScopes(introspection.scopes);

      let accountEmail: string | null = introspection.email;
      if (!accountEmail) {
        try {
          const oauth2 = google.oauth2({ version: "v2", auth: client });
          const me = await oauth2.userinfo.get();
          accountEmail = me.data.email ?? null;
        } catch (error) {
          const formatted = logGoogleApiError("oauth.userinfo.get", error);
          console.warn(
            "[google-calendar] userinfo.email failed (non-fatal):",
            formatted,
          );
        }
      }

      // Verify default calendar via official Calendar v3 calendarList.get("primary").
      await this.verifyPrimaryCalendar(tokens.access_token);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountEmail,
      };
    } catch (error) {
      throw new Error(formatGoogleApiError(error));
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    options?: { validateScopes?: boolean },
  ): Promise<OAuthTokenSet> {
    const client = this.oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    logGoogleApiRequest("oauth.refreshAccessToken", {
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      params: { grant_type: "refresh_token" },
    });
    try {
      const { credentials } = await client.refreshAccessToken();
      logGoogleApiResponse("oauth.refreshAccessToken", {
        status: 200,
        data: {
          hasAccessToken: Boolean(credentials.access_token),
          expiry_date: credentials.expiry_date ?? null,
          scope: credentials.scope ?? null,
        },
        config: {
          method: "POST",
          url: "https://oauth2.googleapis.com/token",
        },
      });
      if (!credentials.access_token) {
        throw new Error("Google token refresh failed — no access_token");
      }

      // Hot-path refreshes skip tokeninfo — scopes were validated at OAuth connect.
      if (options?.validateScopes !== false) {
        const introspection = await this.introspectAccessToken(
          credentials.access_token,
        );
        this.assertCalendarScopes(introspection.scopes);
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token ?? refreshToken,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      };
    } catch (error) {
      throw new Error(formatGoogleApiError(error));
    }
  }

  /**
   * Official tokeninfo endpoint — validates access token and returns granted scopes.
   * GET https://oauth2.googleapis.com/tokeninfo?access_token=…
   */
  async introspectAccessToken(
    accessToken: string,
  ): Promise<GoogleTokenIntrospection> {
    const url = new URL("https://oauth2.googleapis.com/tokeninfo");
    url.searchParams.set("access_token", accessToken);

    logGoogleApiRequest("oauth.tokeninfo", {
      method: "GET",
      url: "https://oauth2.googleapis.com/tokeninfo",
      params: { access_token: `${accessToken.slice(0, 8)}…` },
    });

    const res = await fetch(url);
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    logGoogleApiResponse("oauth.tokeninfo", {
      status: res.status,
      statusText: res.statusText,
      data: body
        ? {
            ...body,
            // avoid logging full token echoes
            access_token: undefined,
          }
        : null,
      config: {
        method: "GET",
        url: "https://oauth2.googleapis.com/tokeninfo",
      },
    });

    if (!res.ok) {
      throw new Error(
        formatGoogleApiError({
          code: res.status,
          message: "tokeninfo failed",
          response: {
            status: res.status,
            statusText: res.statusText,
            data: body,
            config: {
              method: "GET",
              url: "https://oauth2.googleapis.com/tokeninfo",
            },
          },
        }),
      );
    }

    const scopeStr = typeof body?.scope === "string" ? body.scope : "";
    const scopes = scopeStr.split(/\s+/).filter(Boolean);
    const exp =
      typeof body?.exp === "string"
        ? Number(body.exp)
        : typeof body?.exp === "number"
          ? body.exp
          : null;

    return {
      active: true,
      expiresAt: exp ? new Date(exp * 1000) : null,
      scopes,
      email: typeof body?.email === "string" ? body.email : null,
      audience: typeof body?.aud === "string" ? body.aud : null,
      raw: body,
    };
  }

  assertCalendarScopes(scopes: string[]) {
    const hasEvents = scopes.includes(
      "https://www.googleapis.com/auth/calendar.events",
    );
    const hasFullCalendar = scopes.includes(
      "https://www.googleapis.com/auth/calendar",
    );
    if (!hasEvents && !hasFullCalendar) {
      throw new Error(
        `OAuth token missing calendar.events (or calendar) scope. Granted: [${scopes.join(", ") || "none"}]`,
      );
    }
  }

  private calendar(accessToken: string) {
    const client = this.oauthClient();
    client.setCredentials({ access_token: accessToken });
    // Official Google Calendar API v3
    return google.calendar({ version: "v3", auth: client });
  }

  /**
   * Resolve the user's default calendar via Calendar v3:
   * GET /calendar/v3/users/me/calendarList/primary
   * Falls back to GET /calendar/v3/calendars/primary
   */
  async verifyPrimaryCalendar(
    accessToken: string,
  ): Promise<GooglePrimaryCalendar> {
    const calendar = this.calendar(accessToken);
    try {
      const listRes = await calendar.calendarList.get({
        calendarId: PRIMARY_CALENDAR_ID,
      });
      const entry = listRes.data;
      const resolved: GooglePrimaryCalendar = {
        id: entry.id || PRIMARY_CALENDAR_ID,
        summary: entry.summary ?? null,
        timeZone: entry.timeZone ?? null,
        primary: Boolean(entry.primary ?? true),
        accessRole: entry.accessRole ?? null,
      };
      console.info("[google-calendar:primary]", {
        source: "calendarList.get",
        calendar: resolved,
      });
      return resolved;
    } catch (listError) {
      const listFormatted = logGoogleApiError(
        "calendarList.get(primary)",
        listError,
      );
      console.warn(
        "[google-calendar] calendarList.get(primary) failed; trying calendars.get:",
        listFormatted,
      );
      try {
        const calRes = await calendar.calendars.get({
          calendarId: PRIMARY_CALENDAR_ID,
        });
        const resolved: GooglePrimaryCalendar = {
          id: calRes.data.id || PRIMARY_CALENDAR_ID,
          summary: calRes.data.summary ?? null,
          timeZone: calRes.data.timeZone ?? null,
          primary: true,
          accessRole: null,
        };
        console.info("[google-calendar:primary]", {
          source: "calendars.get",
          calendar: resolved,
        });
        return resolved;
      } catch (calError) {
        throw new Error(
          `Failed to fetch primary calendar. calendarList.get: ${listFormatted} | calendars.get: ${formatGoogleApiError(calError)}`,
        );
      }
    }
  }

  /** Normalize calendarId — empty/invalid → "primary". */
  resolveCalendarId(calendarId: string | null | undefined): string {
    const trimmed = calendarId?.trim();
    if (!trimmed || trimmed === "default" || trimmed === "null") {
      return PRIMARY_CALENDAR_ID;
    }
    return trimmed;
  }

  /**
   * Build event body for Calendar v3.
   * Never send null date/dateTime — Google rejects null values with 400.
   * All-day: start/end.date only. Timed: start/end.dateTime + timeZone only.
   */
  toGoogleBody(event: ExternalEventInput) {
    const title = event.completed ? `✓ ${event.title}` : event.title;
    const timeZone = normalizeIanaTimeZone(event.timezone);
    const base = {
      summary: title,
      description: event.description || undefined,
      extendedProperties: {
        private: {
          [EXT_KEY]: event.stickyItemId,
          source: "siroman",
        },
      },
      transparency: "transparent" as const,
    };

    if (event.dueTime) {
      const endTime = addMinutesToDueTime(
        event.dueTime,
        DEFAULT_TIMED_DURATION_MINUTES,
      );
      const crossesMidnight = endTime < event.dueTime;
      const endDate = crossesMidnight
        ? shiftCivilDate(event.dueDate, 1)
        : event.dueDate;

      return {
        ...base,
        start: {
          dateTime: `${event.dueDate}T${event.dueTime}:00`,
          timeZone,
        },
        end: {
          dateTime: `${endDate}T${endTime}:00`,
          timeZone,
        },
      };
    }

    return {
      ...base,
      start: {
        date: event.dueDate,
      },
      end: {
        date: shiftCivilDate(event.dueDate, 1),
      },
    };
  }

  async createAllDayEvent(
    accessToken: string,
    calendarId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef> {
    const payloadStarted = performance.now();
    const calendar = this.calendar(accessToken);
    const resolvedId = this.resolveCalendarId(calendarId);
    const requestBody = this.toGoogleBody(event);
    const payloadMs = performance.now() - payloadStarted;
    const apiStarted = performance.now();
    try {
      const res = await calendar.events.insert({
        calendarId: resolvedId,
        requestBody,
      });
      console.info("[google-calendar:timing]", {
        op: "events.insert",
        eventPayloadMs: Math.round(payloadMs * 10) / 10,
        googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
      });
      if (!res.data.id) {
        throw new Error(
          `Google events.insert returned no id. body=${JSON.stringify(res.data)}`,
        );
      }
      return {
        externalEventId: res.data.id,
        calendarId: resolvedId,
        etag: res.data.etag ?? null,
        htmlLink: res.data.htmlLink ?? null,
      };
    } catch (error) {
      console.info("[google-calendar:timing]", {
        op: "events.insert",
        ok: false,
        eventPayloadMs: Math.round(payloadMs * 10) / 10,
        googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
      });
      throw new Error(
        `events.insert failed: ${formatGoogleApiError(error)} | requestBody=${JSON.stringify(requestBody)}`,
      );
    }
  }

  async updateAllDayEvent(
    accessToken: string,
    calendarId: string,
    externalEventId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef> {
    const payloadStarted = performance.now();
    const calendar = this.calendar(accessToken);
    const resolvedId = this.resolveCalendarId(calendarId);
    const requestBody = this.toGoogleBody(event);
    const payloadMs = performance.now() - payloadStarted;
    const apiStarted = performance.now();
    try {
      const res = await calendar.events.patch({
        calendarId: resolvedId,
        eventId: externalEventId,
        requestBody,
      });
      console.info("[google-calendar:timing]", {
        op: "events.patch",
        eventPayloadMs: Math.round(payloadMs * 10) / 10,
        googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
      });
      return {
        externalEventId: res.data.id ?? externalEventId,
        calendarId: resolvedId,
        etag: res.data.etag ?? null,
        htmlLink: res.data.htmlLink ?? null,
      };
    } catch (error) {
      const status = (error as { code?: number; response?: { status?: number } })
        .response?.status ?? (error as { code?: number }).code;
      if (status === 404) {
        console.warn(
          "[google-calendar] events.patch 404 — recreating event",
          formatGoogleApiError(error),
        );
        return this.createAllDayEvent(accessToken, resolvedId, event);
      }
      console.info("[google-calendar:timing]", {
        op: "events.patch",
        ok: false,
        eventPayloadMs: Math.round(payloadMs * 10) / 10,
        googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
      });
      throw new Error(
        `events.patch failed: ${formatGoogleApiError(error)} | eventId=${externalEventId} | requestBody=${JSON.stringify(requestBody)}`,
      );
    }
  }

  async removeEvent(
    accessToken: string,
    calendarId: string,
    externalEventId: string,
    mode: RemoveEventMode,
  ): Promise<void> {
    const calendar = this.calendar(accessToken);
    const resolvedId = this.resolveCalendarId(calendarId);
    try {
      if (mode === "cancel") {
        await calendar.events.patch({
          calendarId: resolvedId,
          eventId: externalEventId,
          requestBody: { status: "cancelled" },
        });
      } else {
        await calendar.events.delete({
          calendarId: resolvedId,
          eventId: externalEventId,
        });
      }
    } catch (error) {
      const status = (error as { code?: number; response?: { status?: number } })
        .response?.status ?? (error as { code?: number }).code;
      if (status === 404 || status === 410) {
        console.info(
          "[google-calendar] removeEvent already gone",
          { mode, externalEventId, status },
        );
        return;
      }
      throw new Error(
        `events.${mode === "cancel" ? "patch(cancel)" : "delete"} failed: ${formatGoogleApiError(error)} | eventId=${externalEventId}`,
      );
    }
  }

  /** List calendars via official Calendar v3 calendarList.list (for debugging). */
  async listCalendars(accessToken: string) {
    const calendar = this.calendar(accessToken);
    try {
      const res = await calendar.calendarList.list({
        maxResults: 100,
        minAccessRole: "writer",
      });
      return (res.data.items ?? []).map((item) => ({
        id: item.id ?? "",
        summary: item.summary ?? null,
        primary: Boolean(item.primary),
        accessRole: item.accessRole ?? null,
        timeZone: item.timeZone ?? null,
      }));
    } catch (error) {
      throw new Error(`calendarList.list failed: ${formatGoogleApiError(error)}`);
    }
  }
}

function shiftCivilDate(civilDate: string, days: number): string {
  const [y, m, d] = civilDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export const GOOGLE_ITEM_EXTENDED_KEY = EXT_KEY;
export const GOOGLE_ITEM_EXTENDED_PRIVATE = EXT_PRIVATE;
export const GOOGLE_PRIMARY_CALENDAR_ID = PRIMARY_CALENDAR_ID;
