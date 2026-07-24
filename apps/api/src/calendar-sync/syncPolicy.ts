import type { CalendarRemovePolicy } from "@stickyflow/shared";
import type {
  CalendarProvider,
  ExternalEventInput,
  SyncableSticky,
  SyncItemResult,
} from "./types.js";

export const PENDING_EXTERNAL_PREFIX = "pending:";

export function makePendingExternalId(itemId: string): string {
  return `${PENDING_EXTERNAL_PREFIX}${itemId}`;
}

export function isPendingExternalId(externalEventId: string): boolean {
  return externalEventId.startsWith(PENDING_EXTERNAL_PREFIX);
}

export function shouldPushToCalendar(sticky: SyncableSticky): boolean {
  return Boolean(sticky.dueDate) && !sticky.archived;
}

export function toExternalEvent(sticky: SyncableSticky): ExternalEventInput {
  return {
    stickyItemId: sticky.id,
    title: sticky.title?.trim() || "Untitled sticky",
    description: sticky.description?.slice(0, 8000) ?? "",
    dueDate: sticky.dueDate!,
    dueTime: sticky.dueTime,
    timezone: sticky.timezone,
    completed: Boolean(sticky.completedAt),
  };
}

export type EventMapSnapshot = {
  externalEventId: string;
  calendarId: string;
  syncStatus: string;
  externalHtmlLink: string | null;
  etag: string | null;
};

export type SyncTransition =
  | {
      result: Extract<SyncItemResult, { ok: true }>;
      next: EventMapSnapshot | null;
    }
  | {
      result: Extract<SyncItemResult, { ok: false }>;
      next: EventMapSnapshot | null;
    };

/**
 * Pure provider-facing sync transition (create / update / remove).
 * Persistence is left to the caller — keeps sticky → Google mapping testable.
 */
export async function applyCalendarSyncTransition(input: {
  sticky: SyncableSticky;
  existing: EventMapSnapshot | null;
  calendarId: string;
  onRemovePolicy: CalendarRemovePolicy;
  provider: CalendarProvider;
  accessToken: string;
}): Promise<SyncTransition> {
  const { sticky, existing, calendarId, onRemovePolicy, provider, accessToken } =
    input;
  const push = shouldPushToCalendar(sticky);

  try {
    if (!push) {
      if (!existing || existing.syncStatus === "removed") {
        return { result: { ok: true, action: "skipped" }, next: null };
      }
      if (isPendingExternalId(existing.externalEventId)) {
        return {
          result: { ok: true, action: "removed" },
          next: {
            ...existing,
            syncStatus: "removed",
            externalHtmlLink: null,
          },
        };
      }
      const mode = onRemovePolicy === "delete" ? "delete" : "cancel";
      await provider.removeEvent(
        accessToken,
        existing.calendarId,
        existing.externalEventId,
        mode,
      );
      return {
        result: { ok: true, action: "removed" },
        next: {
          ...existing,
          syncStatus: "removed",
          externalHtmlLink: null,
        },
      };
    }

    const payloadStarted = performance.now();
    const event = toExternalEvent(sticky);
    const eventPayloadMs = performance.now() - payloadStarted;
    const hasLiveExternal =
      existing &&
      existing.syncStatus !== "removed" &&
      !isPendingExternalId(existing.externalEventId);

    if (hasLiveExternal && existing) {
      const apiStarted = performance.now();
      const ref = await provider.updateAllDayEvent(
        accessToken,
        existing.calendarId || calendarId,
        existing.externalEventId,
        event,
      );
      console.info("[calendar-sync:timing] transition.update", {
        itemId: sticky.id,
        eventPayloadMs: Math.round(eventPayloadMs * 10) / 10,
        googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
      });
      return {
        result: { ok: true, action: "updated" },
        next: {
          externalEventId: ref.externalEventId,
          calendarId: ref.calendarId,
          etag: ref.etag ?? null,
          externalHtmlLink: ref.htmlLink ?? existing.externalHtmlLink,
          syncStatus: "synced",
        },
      };
    }

    const apiStarted = performance.now();
    const ref = await provider.createAllDayEvent(
      accessToken,
      calendarId,
      event,
    );
    console.info("[calendar-sync:timing] transition.create", {
      itemId: sticky.id,
      eventPayloadMs: Math.round(eventPayloadMs * 10) / 10,
      googleApiMs: Math.round((performance.now() - apiStarted) * 10) / 10,
    });
    return {
      result: { ok: true, action: "created" },
      next: {
        externalEventId: ref.externalEventId,
        calendarId: ref.calendarId,
        etag: ref.etag ?? null,
        externalHtmlLink: ref.htmlLink ?? null,
        syncStatus: "synced",
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : "Sync failed";
    const next: EventMapSnapshot | null = shouldPushToCalendar(sticky)
      ? {
          externalEventId:
            existing && !isPendingExternalId(existing.externalEventId)
              ? existing.externalEventId
              : makePendingExternalId(sticky.id),
          calendarId: existing?.calendarId || calendarId,
          etag: existing?.etag ?? null,
          externalHtmlLink: existing?.externalHtmlLink ?? null,
          syncStatus: "error",
        }
      : existing && existing.syncStatus !== "removed"
        ? {
            ...existing,
            syncStatus: "error",
          }
        : null;

    return {
      result: { ok: false, error: message, retryable: true },
      next,
    };
  }
}
