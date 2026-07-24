import type { CalendarProviderId } from "@stickyflow/shared";

/** Sticky commitment payload used by all calendar providers. */
export type SyncableSticky = {
  id: string;
  title: string | null;
  description: string;
  dueDate: string | null;
  /** HH:mm in user IANA timezone — null/undefined means all-day */
  dueTime: string | null;
  archived: boolean;
  completedAt: string | null;
  priority: string;
  /** IANA time zone, e.g. Asia/Kolkata */
  timezone: string;
};

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  accountEmail?: string | null;
};

export type ExternalEventInput = {
  stickyItemId: string;
  title: string;
  description: string;
  /** Civil due date YYYY-MM-DD */
  dueDate: string;
  /** HH:mm — when set, provider creates a timed event; otherwise all-day */
  dueTime: string | null;
  /** IANA time zone for timed events */
  timezone: string;
  completed: boolean;
};

export type ExternalEventRef = {
  externalEventId: string;
  calendarId: string;
  etag?: string | null;
  htmlLink?: string | null;
};

export type RemoveEventMode = "cancel" | "delete";

/**
 * Provider abstraction — implement once per calendar service.
 * Sync engine depends only on this interface (UI-independent).
 */
export interface CalendarProvider {
  readonly id: CalendarProviderId;

  isConfigured(): boolean;

  getAuthorizationUrl(state: string): string;

  exchangeAuthorizationCode(code: string): Promise<OAuthTokenSet>;

  refreshAccessToken(
    refreshToken: string,
    options?: { validateScopes?: boolean },
  ): Promise<OAuthTokenSet>;

  /** Upsert external event — all-day or timed based on event.dueTime */
  createAllDayEvent(
    accessToken: string,
    calendarId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef>;

  updateAllDayEvent(
    accessToken: string,
    calendarId: string,
    externalEventId: string,
    event: ExternalEventInput,
  ): Promise<ExternalEventRef>;

  removeEvent(
    accessToken: string,
    calendarId: string,
    externalEventId: string,
    mode: RemoveEventMode,
  ): Promise<void>;
}

export type SyncItemResult =
  | { ok: true; action: "created" | "updated" | "removed" | "skipped" | "unlinked" }
  | { ok: false; error: string; retryable: boolean };

export type StickyCalendarSyncStatus =
  | "local_only"
  | "syncing"
  | "synced"
  | "failed";
