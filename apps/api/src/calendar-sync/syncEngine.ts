import type {
  CalendarDisconnectMode,
  CalendarProviderId,
  CalendarRemovePolicy,
} from "@stickyflow/shared";
import {
  formatCivilDate,
  normalizeIanaTimeZone,
} from "@stickyflow/shared";
import type { CalendarConnection, Item, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";
import type { Env } from "../config/env.js";
import { getCalendarProvider } from "./registry.js";
import {
  decryptSecret,
  encryptSecret,
  signOAuthState,
  verifyOAuthState,
} from "./tokenCrypto.js";
import type { SyncableSticky, SyncItemResult } from "./types.js";
import {
  applyCalendarSyncTransition,
  isPendingExternalId,
  makePendingExternalId,
  shouldPushToCalendar,
} from "./syncPolicy.js";
import {
  createStopwatch,
  logSyncPipelineTiming,
} from "./syncTiming.js";

let encryptionKey = "";
let runtimeEnv: Env | null = null;

/** In-memory access-token cache — avoids DB decrypt on every sticky sync. */
type CachedAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};
const accessTokenCache = new Map<string, CachedAccessToken>();

/** Coalesce concurrent sync jobs per sticky (latest state wins). */
const inflightItemSync = new Map<string, Promise<void>>();
const pendingItemSyncRerun = new Set<string>();

const TOKEN_SKEW_MS = 60_000;

export function configureCalendarSync(env: Env) {
  encryptionKey = env.TOKEN_ENCRYPTION_KEY ?? "";
  runtimeEnv = env;
}

function syncJobKey(userId: string, itemId: string) {
  return `${userId}:${itemId}`;
}

function cacheAccessToken(
  connectionId: string,
  accessToken: string,
  expiresAt: Date | null | undefined,
) {
  const expiresAtMs = expiresAt
    ? expiresAt.getTime()
    : Date.now() + 55 * 60_000;
  accessTokenCache.set(connectionId, { accessToken, expiresAtMs });
}

function invalidateAccessTokenCache(connectionId: string) {
  accessTokenCache.delete(connectionId);
}

function requireCryptoKey() {
  if (!encryptionKey) {
    throw new ApiError(
      503,
      "CALENDAR_SYNC_MISCONFIGURED",
      "TOKEN_ENCRYPTION_KEY is not configured",
    );
  }
  return encryptionKey;
}

function dueCivil(dueDate: Date | null): string | null {
  if (!dueDate) return null;
  return formatCivilDate(dueDate);
}

function toSyncable(item: Item, timezone: string): SyncableSticky {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    dueDate: dueCivil(item.dueDate),
    dueTime: item.dueTime ?? null,
    archived: item.archived,
    completedAt: item.completedAt?.toISOString() ?? null,
    priority: item.priority,
    timezone: normalizeIanaTimeZone(timezone),
  };
}

async function getAccessToken(
  connection: CalendarConnection,
  env: Env,
): Promise<{
  accessToken: string;
  oauthTokenLookupMs: number;
  tokenRefreshMs: number;
  refreshed: boolean;
}> {
  const sw = createStopwatch();
  const provider = getCalendarProvider(connection.provider);
  if (!provider?.isConfigured()) {
    throw new ApiError(
      503,
      "PROVIDER_NOT_CONFIGURED",
      `${connection.provider} calendar is not configured`,
    );
  }

  const cached = accessTokenCache.get(connection.id);
  if (cached && cached.expiresAtMs > Date.now() + TOKEN_SKEW_MS) {
    return {
      accessToken: cached.accessToken,
      oauthTokenLookupMs: sw.lap(),
      tokenRefreshMs: 0,
      refreshed: false,
    };
  }

  const key = requireCryptoKey();
  const stillValid =
    connection.accessTokenEnc &&
    connection.expiresAt &&
    connection.expiresAt.getTime() > Date.now() + TOKEN_SKEW_MS;

  if (stillValid && connection.accessTokenEnc) {
    const accessToken = decryptSecret(connection.accessTokenEnc, key);
    cacheAccessToken(connection.id, accessToken, connection.expiresAt);
    return {
      accessToken,
      oauthTokenLookupMs: sw.lap(),
      tokenRefreshMs: 0,
      refreshed: false,
    };
  }

  const oauthTokenLookupMs = sw.lap();
  const refreshToken = decryptSecret(connection.refreshTokenEnc, key);

  try {
    // Hot path: refresh without tokeninfo round-trip (scopes checked at OAuth).
    const refreshed = await provider.refreshAccessToken(refreshToken, {
      validateScopes: false,
    });
    const tokenRefreshMs = sw.lap();
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encryptSecret(refreshed.accessToken, key),
        expiresAt: refreshed.expiresAt ?? null,
        refreshTokenEnc: refreshed.refreshToken
          ? encryptSecret(refreshed.refreshToken, key)
          : connection.refreshTokenEnc,
        status: "connected",
        lastError: null,
      },
    });
    cacheAccessToken(
      connection.id,
      refreshed.accessToken,
      refreshed.expiresAt ?? null,
    );
    return {
      accessToken: refreshed.accessToken,
      oauthTokenLookupMs,
      tokenRefreshMs,
      refreshed: true,
    };
  } catch (error) {
    invalidateAccessTokenCache(connection.id);
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : "Token refresh failed";
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        status: "error",
        lastError: `OAuth revoked or expired: ${message}`.slice(0, 2000),
        syncEnabled: false,
      },
    });
    throw new ApiError(
      401,
      "CALENDAR_AUTH_REVOKED",
      "Calendar connection needs to be reconnected",
    );
  }
}

export function beginOAuth(
  userId: string,
  providerId: CalendarProviderId,
  env: Env,
): { url: string } {
  requireCryptoKey();
  const provider = getCalendarProvider(providerId);
  if (!provider?.isConfigured()) {
    throw new ApiError(
      503,
      "PROVIDER_NOT_CONFIGURED",
      `${providerId} calendar is not configured on this server`,
    );
  }
  const state = signOAuthState(
    { userId, provider: providerId },
    requireCryptoKey(),
  );
  return { url: provider.getAuthorizationUrl(state) };
}

export async function completeOAuthCallback(input: {
  code: string;
  state: string;
  env: Env;
}): Promise<{ userId: string; provider: CalendarProviderId }> {
  const key = requireCryptoKey();
  const payload = verifyOAuthState(input.state, key);
  if (!payload) {
    throw new ApiError(400, "INVALID_OAUTH_STATE", "Invalid or expired OAuth state");
  }

  const providerId = payload.provider as CalendarProviderId;
  const provider = getCalendarProvider(providerId);
  if (!provider?.isConfigured()) {
    throw new ApiError(503, "PROVIDER_NOT_CONFIGURED", "Provider not configured");
  }

  const tokens = await provider.exchangeAuthorizationCode(input.code);
  if (!tokens.refreshToken) {
    // May happen on re-consent without prompt=consent; keep existing refresh if reconnecting.
    const existing = await prisma.calendarConnection.findUnique({
      where: {
        userId_provider: { userId: payload.userId, provider: providerId },
      },
    });
    if (!existing) {
      throw new ApiError(
        400,
        "MISSING_REFRESH_TOKEN",
        "Google did not return a refresh token. Disconnect the app in Google Account permissions and try again.",
      );
    }
  }

  const refreshEnc = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken, key)
    : (
        await prisma.calendarConnection.findUnique({
          where: {
            userId_provider: { userId: payload.userId, provider: providerId },
          },
        })
      )?.refreshTokenEnc;

  if (!refreshEnc) {
    throw new ApiError(400, "MISSING_REFRESH_TOKEN", "Missing refresh token");
  }

  // Always use the official Calendar v3 alias for the user's default calendar.
  const calendarId = "primary";

  await prisma.calendarConnection.upsert({
    where: {
      userId_provider: { userId: payload.userId, provider: providerId },
    },
    create: {
      userId: payload.userId,
      provider: providerId,
      refreshTokenEnc: refreshEnc,
      accessTokenEnc: encryptSecret(tokens.accessToken, key),
      expiresAt: tokens.expiresAt ?? null,
      accountEmail: tokens.accountEmail ?? null,
      syncEnabled: true,
      status: "connected",
      lastError: null,
      calendarId,
    },
    update: {
      refreshTokenEnc: refreshEnc,
      accessTokenEnc: encryptSecret(tokens.accessToken, key),
      expiresAt: tokens.expiresAt ?? null,
      accountEmail: tokens.accountEmail ?? null,
      syncEnabled: true,
      status: "connected",
      lastError: null,
      calendarId,
    },
  });

  const conn = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: { userId: payload.userId, provider: providerId },
    },
    select: { id: true },
  });
  if (conn) {
    cacheAccessToken(conn.id, tokens.accessToken, tokens.expiresAt ?? null);
  }

  console.info("[calendar-sync:oauth] connected", {
    userId: payload.userId,
    provider: providerId,
    accountEmail: tokens.accountEmail,
    calendarId,
    expiresAt: tokens.expiresAt?.toISOString() ?? null,
  });

  return { userId: payload.userId, provider: providerId };
}

export async function getConnectionStatus(userId: string) {
  const connections = await prisma.calendarConnection.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          events: { where: { syncStatus: { in: ["synced", "pending", "error"] } } },
        },
      },
    },
  });

  const errorMaps = await prisma.calendarEventMap.findMany({
    where: {
      syncStatus: "error",
      connection: { userId },
    },
    select: {
      id: true,
      itemId: true,
      provider: true,
      lastError: true,
      updatedAt: true,
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  return {
    providers: (["google"] as CalendarProviderId[]).map((id) => {
      const provider = getCalendarProvider(id);
      const conn = connections.find((c) => c.provider === id);
      return {
        id,
        configured: Boolean(provider?.isConfigured()),
        connected: Boolean(conn),
        connection: conn
          ? {
              id: conn.id,
              provider: conn.provider,
              syncEnabled: conn.syncEnabled,
              status: conn.status,
              calendarId: conn.calendarId,
              accountEmail: conn.accountEmail,
              lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
              lastError: conn.lastError,
              onRemovePolicy: conn.onRemovePolicy,
              mappedEvents: conn._count.events,
            }
          : null,
      };
    }),
    errors: errorMaps.map((row) => ({
      mapId: row.id,
      itemId: row.itemId,
      provider: row.provider,
      error: row.lastError,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function updateConnection(
  userId: string,
  providerId: CalendarProviderId,
  patch: {
    syncEnabled?: boolean;
    calendarId?: string;
    onRemovePolicy?: CalendarRemovePolicy;
  },
) {
  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: providerId } },
  });
  if (!conn) {
    throw new ApiError(404, "NOT_CONNECTED", "Calendar is not connected");
  }

  return prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      ...(patch.syncEnabled !== undefined
        ? {
            syncEnabled: patch.syncEnabled,
            status: patch.syncEnabled ? "connected" : "paused",
            lastError: patch.syncEnabled ? null : conn.lastError,
          }
        : {}),
      ...(patch.calendarId !== undefined ? { calendarId: patch.calendarId } : {}),
      ...(patch.onRemovePolicy !== undefined
        ? { onRemovePolicy: patch.onRemovePolicy }
        : {}),
    },
  });
}

export async function disconnectProvider(
  userId: string,
  providerId: CalendarProviderId,
  mode: CalendarDisconnectMode,
  env: Env,
) {
  const conn = await prisma.calendarConnection.findUnique({
    where: { userId_provider: { userId, provider: providerId } },
    include: { events: true },
  });
  if (!conn) {
    throw new ApiError(404, "NOT_CONNECTED", "Calendar is not connected");
  }

  if (mode === "delete" && conn.events.length > 0) {
    const provider = getCalendarProvider(providerId);
    if (provider?.isConfigured()) {
      try {
        const { accessToken } = await getAccessToken(conn, env);
        await Promise.all(
          conn.events.map(async (map) => {
            try {
              await provider.removeEvent(
                accessToken,
                map.calendarId,
                map.externalEventId,
                "delete",
              );
            } catch {
              // best-effort cleanup
            }
          }),
        );
      } catch {
        // still drop local connection
      }
    }
  }

  invalidateAccessTokenCache(conn.id);
  await prisma.calendarEventMap.deleteMany({ where: { connectionId: conn.id } });
  await prisma.calendarConnection.delete({ where: { id: conn.id } });
}

/**
 * Sync one sticky to all enabled provider connections for the user.
 * Never creates duplicate maps — unique (itemId, provider).
 */
export async function syncItemToCalendars(
  userId: string,
  itemId: string,
  env: Env,
): Promise<SyncItemResult[]> {
  const totalSw = createStopwatch();

  const markPendingMs = await markItemCalendarSyncPendingTimed(userId, itemId);

  const loadStarted = performance.now();
  const [user, item, connections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true },
    }),
    prisma.item.findFirst({ where: { id: itemId, userId } }),
    prisma.calendarConnection.findMany({
      where: { userId, syncEnabled: true, status: { not: "disconnected" } },
    }),
  ]);
  const loadContextMs = performance.now() - loadStarted;

  if (!user || !item || connections.length === 0) {
    logSyncPipelineTiming("item.skipped", {
      userId,
      itemId,
      markPendingMs,
      loadContextMs,
      totalMs: totalSw.total(),
      reason: !user ? "no_user" : !item ? "no_item" : "no_connections",
    });
    return [{ ok: true, action: "skipped" }];
  }

  const sticky = toSyncable(item, user.timezone);

  // Parallelize independent provider connections.
  const results = await Promise.all(
    connections.map((connection) =>
      syncItemWithConnection(sticky, connection, env),
    ),
  );

  logSyncPipelineTiming("item.complete", {
    userId,
    itemId,
    markPendingMs,
    loadContextMs,
    connections: connections.length,
    results: results.map((r) => (r.ok ? r.action : "error")),
    totalMs: totalSw.total(),
  });

  return results;
}

async function syncItemWithConnection(
  sticky: SyncableSticky,
  connection: CalendarConnection,
  env: Env,
): Promise<SyncItemResult> {
  const sw = createStopwatch();
  const provider = getCalendarProvider(connection.provider);
  if (!provider?.isConfigured()) {
    return { ok: true, action: "skipped" };
  }

  const existing = await prisma.calendarEventMap.findUnique({
    where: {
      itemId_provider: { itemId: sticky.id, provider: connection.provider },
    },
  });
  const mapLookupMs = sw.lap();

  let accessToken: string;
  let oauthTokenLookupMs = 0;
  let tokenRefreshMs = 0;
  try {
    const token = await getAccessToken(connection, env);
    accessToken = token.accessToken;
    oauthTokenLookupMs = token.oauthTokenLookupMs;
    tokenRefreshMs = token.tokenRefreshMs;
  } catch (error) {
    if (error instanceof ApiError && error.code === "CALENDAR_AUTH_REVOKED") {
      if (existing) {
        await prisma.calendarEventMap.update({
          where: { id: existing.id },
          data: {
            syncStatus: "error",
            lastError: error.message.slice(0, 2000),
          },
        });
      } else if (shouldPushToCalendar(sticky)) {
        await prisma.calendarEventMap.create({
          data: {
            itemId: sticky.id,
            connectionId: connection.id,
            provider: connection.provider,
            externalEventId: makePendingExternalId(sticky.id),
            calendarId: connection.calendarId,
            syncStatus: "error",
            lastError: error.message.slice(0, 2000),
          },
        });
      }
      logSyncPipelineTiming("connection.auth_revoked", {
        itemId: sticky.id,
        provider: connection.provider,
        mapLookupMs,
        oauthTokenLookupMs,
        tokenRefreshMs,
        totalMs: sw.total(),
      });
      return { ok: false, error: error.message, retryable: false };
    }
    throw error;
  }

  const googleStarted = performance.now();
  const transition = await applyCalendarSyncTransition({
    sticky,
    existing: existing
      ? {
          externalEventId: existing.externalEventId,
          calendarId: existing.calendarId,
          syncStatus: existing.syncStatus,
          externalHtmlLink: existing.externalHtmlLink,
          etag: existing.etag,
        }
      : null,
    calendarId: connection.calendarId,
    onRemovePolicy:
      (connection.onRemovePolicy as CalendarRemovePolicy) === "delete"
        ? "delete"
        : "cancel",
    provider,
    accessToken,
  });
  // Provider logs split payload vs API; this captures the full Google stage.
  const googleApiMs = performance.now() - googleStarted;
  const eventPayloadMs = 0;

  if (!transition.result.ok) {
    const mapStarted = performance.now();
    if (transition.next) {
      await prisma.calendarEventMap.upsert({
        where: {
          itemId_provider: {
            itemId: sticky.id,
            provider: connection.provider,
          },
        },
        create: {
          itemId: sticky.id,
          connectionId: connection.id,
          provider: connection.provider,
          externalEventId: transition.next.externalEventId,
          calendarId: transition.next.calendarId,
          etag: transition.next.etag,
          externalHtmlLink: transition.next.externalHtmlLink,
          syncStatus: "error",
          lastError: transition.result.error,
        },
        update: {
          connectionId: connection.id,
          externalEventId: transition.next.externalEventId,
          calendarId: transition.next.calendarId,
          etag: transition.next.etag,
          externalHtmlLink: transition.next.externalHtmlLink,
          syncStatus: "error",
          lastError: transition.result.error,
        },
      });
    }
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { status: "error", lastError: transition.result.error },
    });
    logSyncPipelineTiming("connection.error", {
      itemId: sticky.id,
      provider: connection.provider,
      mapLookupMs,
      oauthTokenLookupMs,
      tokenRefreshMs,
      eventPayloadMs,
      googleApiMs,
      dbMappingUpdateMs: performance.now() - mapStarted,
      totalMs: sw.total(),
      error: transition.result.error,
    });
    return transition.result;
  }

  if (transition.result.action === "skipped") {
    logSyncPipelineTiming("connection.skipped", {
      itemId: sticky.id,
      provider: connection.provider,
      mapLookupMs,
      oauthTokenLookupMs,
      tokenRefreshMs,
      googleApiMs,
      totalMs: sw.total(),
    });
    return transition.result;
  }

  const mapStarted = performance.now();
  if (transition.result.action === "removed" && transition.next) {
    if (existing) {
      await Promise.all([
        prisma.calendarEventMap.update({
          where: { id: existing.id },
          data: {
            syncStatus: "removed",
            lastSyncedAt: new Date(),
            lastError: null,
            externalHtmlLink: null,
          },
        }),
        touchConnectionOk(connection.id),
      ]);
    } else {
      await touchConnectionOk(connection.id);
    }
    logSyncPipelineTiming("connection.removed", {
      itemId: sticky.id,
      provider: connection.provider,
      mapLookupMs,
      oauthTokenLookupMs,
      tokenRefreshMs,
      eventPayloadMs,
      googleApiMs,
      dbMappingUpdateMs: performance.now() - mapStarted,
      totalMs: sw.total(),
    });
    return transition.result;
  }

  if (transition.next && transition.result.ok) {
    await Promise.all([
      prisma.calendarEventMap.upsert({
        where: {
          itemId_provider: { itemId: sticky.id, provider: connection.provider },
        },
        create: {
          itemId: sticky.id,
          connectionId: connection.id,
          provider: connection.provider,
          externalEventId: transition.next.externalEventId,
          calendarId: transition.next.calendarId,
          etag: transition.next.etag,
          externalHtmlLink: transition.next.externalHtmlLink,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          lastError: null,
        },
        update: {
          connectionId: connection.id,
          externalEventId: transition.next.externalEventId,
          calendarId: transition.next.calendarId,
          etag: transition.next.etag,
          externalHtmlLink: transition.next.externalHtmlLink,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          lastError: null,
        },
      }),
      touchConnectionOk(connection.id),
    ]);
  }

  logSyncPipelineTiming("connection.ok", {
    itemId: sticky.id,
    provider: connection.provider,
    action: transition.result.ok ? transition.result.action : "error",
    mapLookupMs,
    oauthTokenLookupMs,
    tokenRefreshMs,
    eventPayloadMs,
    googleApiMs,
    dbMappingUpdateMs: performance.now() - mapStarted,
    totalMs: sw.total(),
  });

  return transition.result;
}

async function touchConnectionOk(connectionId: string) {
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      status: "connected",
      lastSyncAt: new Date(),
      lastError: null,
    },
  });
}

/** Force-sync all dated open stickies + retry errored maps. */
export async function forceSyncUser(
  userId: string,
  providerId: CalendarProviderId | undefined,
  env: Env,
) {
  const connections = await prisma.calendarConnection.findMany({
    where: {
      userId,
      syncEnabled: true,
      ...(providerId ? { provider: providerId } : {}),
    },
  });
  if (!connections.length) {
    throw new ApiError(404, "NOT_CONNECTED", "No enabled calendar connection");
  }

  for (const conn of connections) {
    await prisma.calendarConnection.update({
      where: { id: conn.id },
      data: { status: "syncing", lastError: null },
    });
  }

  const items = await prisma.item.findMany({
    where: {
      userId,
      OR: [
        { dueDate: { not: null }, archived: false },
        {
          calendarEvents: {
            some: {
              syncStatus: { in: ["error", "synced", "pending"] },
              ...(providerId ? { provider: providerId } : {}),
            },
          },
        },
      ],
    },
    select: { id: true },
    take: 500,
  });

  const report = {
    attempted: 0,
    created: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
    failed: 0,
    errors: [] as Array<{ itemId: string; error: string }>,
  };

  for (const item of items) {
    const results = await syncItemToCalendars(userId, item.id, env);
    for (const result of results) {
      report.attempted += 1;
      if (!result.ok) {
        report.failed += 1;
        report.errors.push({ itemId: item.id, error: result.error });
        continue;
      }
      if (result.action === "created") report.created += 1;
      else if (result.action === "updated") report.updated += 1;
      else if (result.action === "removed") report.removed += 1;
      else report.skipped += 1;
    }
  }

  return report;
}

export async function retryItemSync(userId: string, itemId: string, _env: Env) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) {
    throw new ApiError(404, "ITEM_NOT_FOUND", "Sticky note not found");
  }
  // Return immediately — Google sync runs asynchronously (Keep-like).
  scheduleItemCalendarSync(userId, itemId);
  return [{ ok: true, action: "skipped" as const }];
}

/** Mark maps pending so UI shows Syncing while async sync runs (e.g. complete). */
export async function markItemCalendarSyncPending(
  userId: string,
  itemId: string,
) {
  await markItemCalendarSyncPendingTimed(userId, itemId);
}

async function markItemCalendarSyncPendingTimed(
  userId: string,
  itemId: string,
): Promise<number> {
  const started = performance.now();
  const [connections, item] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: { userId, syncEnabled: true, status: { not: "disconnected" } },
      select: { id: true, provider: true, calendarId: true },
    }),
    prisma.item.findFirst({
      where: { id: itemId, userId },
      select: { dueDate: true, archived: true },
    }),
  ]);
  if (!connections.length) return performance.now() - started;

  if (!item?.dueDate || item.archived) {
    await prisma.calendarEventMap.updateMany({
      where: {
        itemId,
        syncStatus: { in: ["synced", "error", "pending"] },
        connection: { userId, syncEnabled: true },
      },
      data: { syncStatus: "pending", lastError: null },
    });
    return performance.now() - started;
  }

  await Promise.all(
    connections.map(async (connection) => {
      const existing = await prisma.calendarEventMap.findUnique({
        where: {
          itemId_provider: { itemId, provider: connection.provider },
        },
        select: { id: true, syncStatus: true },
      });
      if (existing) {
        if (existing.syncStatus === "removed") return;
        if (existing.syncStatus === "pending") return;
        await prisma.calendarEventMap.update({
          where: { id: existing.id },
          data: { syncStatus: "pending", lastError: null },
        });
        return;
      }
      await prisma.calendarEventMap.create({
        data: {
          itemId,
          connectionId: connection.id,
          provider: connection.provider,
          externalEventId: makePendingExternalId(itemId),
          calendarId: connection.calendarId,
          syncStatus: "pending",
          lastError: null,
        },
      });
    }),
  );

  return performance.now() - started;
}

/**
 * Remove sticky from external calendar without archiving/deleting the note.
 * Sticky remains local source of truth.
 */
export async function unlinkItemFromCalendar(
  userId: string,
  itemId: string,
  providerId: CalendarProviderId | undefined,
  env: Env,
): Promise<SyncItemResult[]> {
  const item = await prisma.item.findFirst({ where: { id: itemId, userId } });
  if (!item) {
    throw new ApiError(404, "ITEM_NOT_FOUND", "Sticky note not found");
  }

  const connections = await prisma.calendarConnection.findMany({
    where: {
      userId,
      syncEnabled: true,
      ...(providerId ? { provider: providerId } : {}),
    },
  });

  const results = await Promise.all(
    connections.map(async (connection) => {
      const provider = getCalendarProvider(connection.provider);
      const existing = await prisma.calendarEventMap.findUnique({
        where: {
          itemId_provider: { itemId, provider: connection.provider },
        },
      });
      if (!existing || existing.syncStatus === "removed") {
        return { ok: true, action: "skipped" } as const;
      }
      if (!provider?.isConfigured()) {
        return { ok: true, action: "skipped" } as const;
      }

      try {
        if (!isPendingExternalId(existing.externalEventId)) {
          const { accessToken } = await getAccessToken(connection, env);
          const mode =
            (connection.onRemovePolicy as CalendarRemovePolicy) === "delete"
              ? "delete"
              : "cancel";
          await provider.removeEvent(
            accessToken,
            existing.calendarId,
            existing.externalEventId,
            mode,
          );
        }
        await prisma.calendarEventMap.update({
          where: { id: existing.id },
          data: {
            syncStatus: "removed",
            lastSyncedAt: new Date(),
            lastError: null,
            externalHtmlLink: null,
          },
        });
        return { ok: true, action: "unlinked" } as const;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 2000) : "Unlink failed";
        await prisma.calendarEventMap.update({
          where: { id: existing.id },
          data: { syncStatus: "error", lastError: message },
        });
        return { ok: false, error: message, retryable: true } as const;
      }
    }),
  );

  return results;
}

/**
 * Fire-and-forget helper for itemService hooks — does not throw.
 * Coalesces duplicate in-flight syncs for the same sticky (latest wins).
 */
export function scheduleItemCalendarSync(userId: string, itemId: string) {
  if (!runtimeEnv?.TOKEN_ENCRYPTION_KEY) return;
  const env = runtimeEnv;
  const key = syncJobKey(userId, itemId);

  if (inflightItemSync.has(key)) {
    pendingItemSyncRerun.add(key);
    console.info("[calendar-sync:dedupe] coalesced", { userId, itemId });
    return;
  }

  const run = async () => {
    do {
      pendingItemSyncRerun.delete(key);
      const started = performance.now();
      try {
        await syncItemToCalendars(userId, itemId, env);
      } catch (error) {
        console.error("[calendar-sync] item sync failed", itemId, error);
      } finally {
        logSyncPipelineTiming("schedule.end_to_end", {
          userId,
          itemId,
          totalMs: performance.now() - started,
        });
      }
    } while (pendingItemSyncRerun.has(key));
  };

  const job = run().finally(() => {
    inflightItemSync.delete(key);
    // Cover the race where a coalesce landed after the last while-check.
    if (pendingItemSyncRerun.has(key)) {
      scheduleItemCalendarSync(userId, itemId);
    }
  });
  inflightItemSync.set(key, job);
}

type ExternalRemovalSnapshot = {
  connection: CalendarConnection;
  maps: Array<{ externalEventId: string; calendarId: string }>;
};

/**
 * Snapshot live Google event ids before item delete (maps cascade-delete with item).
 */
export async function snapshotCalendarEventsForRemoval(
  userId: string,
  itemId: string,
): Promise<ExternalRemovalSnapshot[]> {
  if (!runtimeEnv?.TOKEN_ENCRYPTION_KEY) return [];

  const connections = await prisma.calendarConnection.findMany({
    where: { userId, syncEnabled: true },
  });
  if (!connections.length) return [];

  const maps = await prisma.calendarEventMap.findMany({
    where: {
      itemId,
      syncStatus: { in: ["synced", "pending", "error"] },
      connectionId: { in: connections.map((c) => c.id) },
    },
  });

  return connections
    .map((connection) => ({
      connection,
      maps: maps
        .filter(
          (m) =>
            m.connectionId === connection.id &&
            !isPendingExternalId(m.externalEventId),
        )
        .map((m) => ({
          externalEventId: m.externalEventId,
          calendarId: m.calendarId,
        })),
    }))
    .filter((row) => row.maps.length > 0);
}

/** Async Google cleanup after sticky DB delete — never blocks HTTP. */
export function scheduleExternalCalendarCleanup(
  snapshots: ExternalRemovalSnapshot[],
) {
  if (!runtimeEnv?.TOKEN_ENCRYPTION_KEY || snapshots.length === 0) return;
  const env = runtimeEnv;
  void (async () => {
    const started = performance.now();
    await Promise.all(
      snapshots.map(async ({ connection, maps }) => {
        const provider = getCalendarProvider(connection.provider);
        if (!provider?.isConfigured()) return;
        try {
          const { accessToken } = await getAccessToken(connection, env);
          const mode =
            (connection.onRemovePolicy as CalendarRemovePolicy) === "delete"
              ? "delete"
              : "cancel";
          await Promise.all(
            maps.map((map) =>
              provider
                .removeEvent(
                  accessToken,
                  map.calendarId,
                  map.externalEventId,
                  mode,
                )
                .catch((error) => {
                  console.error(
                    "[calendar-sync] post-delete Google remove failed",
                    map.externalEventId,
                    error,
                  );
                }),
            ),
          );
        } catch (error) {
          console.error(
            "[calendar-sync] post-delete token/cleanup failed",
            connection.id,
            error,
          );
        }
      }),
    );
    logSyncPipelineTiming("delete.cleanup", {
      connections: snapshots.length,
      totalMs: performance.now() - started,
    });
  })();
}

/**
 * @deprecated Prefer snapshot + scheduleExternalCalendarCleanup so HTTP delete
 * is not blocked by Google. Kept for callers that still await removal first.
 */
export async function syncItemRemovalBeforeDelete(
  userId: string,
  itemId: string,
) {
  if (!runtimeEnv?.TOKEN_ENCRYPTION_KEY) return;
  const env = runtimeEnv;
  const item = await prisma.item.findFirst({ where: { id: itemId, userId } });
  if (!item) return;

  const removalSticky: Item = { ...item, archived: true, dueDate: null };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const connections = await prisma.calendarConnection.findMany({
    where: { userId, syncEnabled: true },
  });
  const sticky = toSyncable(removalSticky, user.timezone);
  await Promise.all(
    connections.map((connection) =>
      syncItemWithConnection(sticky, connection, env),
    ),
  );
}
