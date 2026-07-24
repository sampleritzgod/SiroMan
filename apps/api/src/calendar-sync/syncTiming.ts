/** Precise stage timing for the Google Calendar sync hot path. */

export type SyncStageTimers = {
  dbSaveMs?: number;
  mapLookupMs?: number;
  oauthTokenLookupMs?: number;
  tokenRefreshMs?: number;
  eventPayloadMs?: number;
  googleApiMs?: number;
  dbMappingUpdateMs?: number;
  markPendingMs?: number;
  loadContextMs?: number;
};

export function createStopwatch() {
  const started = performance.now();
  let last = started;
  return {
    lap(): number {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      return elapsed;
    },
    total(): number {
      return performance.now() - started;
    },
  };
}

export function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

export function logSyncPipelineTiming(
  scope: string,
  meta: Record<string, unknown> & SyncStageTimers & { totalMs: number },
) {
  const stages: SyncStageTimers & { totalMs: number } = {
    totalMs: roundMs(meta.totalMs),
  };
  if (meta.dbSaveMs != null) stages.dbSaveMs = roundMs(meta.dbSaveMs);
  if (meta.mapLookupMs != null) stages.mapLookupMs = roundMs(meta.mapLookupMs);
  if (meta.markPendingMs != null) stages.markPendingMs = roundMs(meta.markPendingMs);
  if (meta.loadContextMs != null) stages.loadContextMs = roundMs(meta.loadContextMs);
  if (meta.oauthTokenLookupMs != null) {
    stages.oauthTokenLookupMs = roundMs(meta.oauthTokenLookupMs);
  }
  if (meta.tokenRefreshMs != null) stages.tokenRefreshMs = roundMs(meta.tokenRefreshMs);
  if (meta.eventPayloadMs != null) stages.eventPayloadMs = roundMs(meta.eventPayloadMs);
  if (meta.googleApiMs != null) stages.googleApiMs = roundMs(meta.googleApiMs);
  if (meta.dbMappingUpdateMs != null) {
    stages.dbMappingUpdateMs = roundMs(meta.dbMappingUpdateMs);
  }

  const { totalMs: _t, ...rest } = meta;
  console.info(`[calendar-sync:timing] ${scope}`, { ...rest, ...stages });
}
