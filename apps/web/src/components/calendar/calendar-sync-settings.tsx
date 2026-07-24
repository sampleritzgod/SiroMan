"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CloudOff,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCalendarConnectionActions,
  useCalendarConnectionStatus,
} from "@/hooks/use-calendar-sync";
import { formatApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function statusLabel(status: string | undefined, connected: boolean) {
  if (!connected) return "Not connected";
  switch (status) {
    case "connected":
      return "Connected";
    case "syncing":
      return "Syncing…";
    case "error":
      return "Sync error";
    case "paused":
      return "Paused";
    case "disconnected":
      return "Disconnected";
    default:
      return status ?? "Unknown";
  }
}

export function CalendarSyncSettingsPanel() {
  const statusQuery = useCalendarConnectionStatus();
  const actions = useCalendarConnectionActions();
  const [message, setMessage] = useState<string | null>(null);

  const google = useMemo(
    () => statusQuery.data?.providers.find((p) => p.id === "google") ?? null,
    [statusQuery.data],
  );
  const connection = google?.connection ?? null;
  const itemErrors = statusQuery.data?.errors ?? [];

  async function run(label: string, fn: () => Promise<unknown>) {
    setMessage(null);
    try {
      await fn();
      setMessage(label);
    } catch (error) {
      setMessage(formatApiError(error, "Something went wrong."));
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="dot-surface rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/45 p-4 shadow-[var(--paper-shadow)] md:p-5">
        <p className="text-sm text-ink-muted">Loading calendar sync…</p>
      </div>
    );
  }

  if (statusQuery.isError) {
    const text = formatApiError(
      statusQuery.error,
      "Couldn’t load calendar connection status.",
    );
    return (
      <div className="dot-surface space-y-3 rounded-[16px_20px_18px_14px] border-[1.75px] border-danger/30 bg-sticky-blush/25 p-4 shadow-[var(--paper-shadow)] md:p-5">
        <p className="font-hand text-2xl text-ink">Calendar sync</p>
        <p className="text-sm text-ink-muted">{text}</p>
        <Button
          type="button"
          size="sm"
          onClick={() => void statusQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const configured = google?.configured ?? false;
  const connected = google?.connected ?? false;
  const hasConnectionError =
    connection?.status === "error" || Boolean(connection?.lastError);
  const busy =
    actions.connect.isPending ||
    actions.disconnect.isPending ||
    actions.update.isPending ||
    actions.forceSync.isPending;

  return (
    <div className="dot-surface space-y-5 rounded-[16px_20px_18px_14px] border-[1.75px] border-stroke-doodle/45 p-4 shadow-[var(--paper-shadow)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 font-hand text-2xl text-ink">
            <CalendarDays className="h-5 w-5 text-accent" strokeWidth={1.75} />
            Google Calendar
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Sync dated sticky notes one-way into your Google Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              hasConnectionError
                ? "danger"
                : connected && connection?.syncEnabled
                  ? "accent"
                  : "outline"
            }
          >
            {statusLabel(connection?.status, connected)}
          </Badge>
          {message ? <Badge variant="outline">{message}</Badge> : null}
        </div>
      </div>

      {!configured ? (
        <div className="rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
          <p className="text-sm font-medium text-ink">Not configured on server</p>
          <p className="mt-1 text-xs text-ink-muted">
            Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and
            TOKEN_ENCRYPTION_KEY on the API, then restart.
          </p>
        </div>
      ) : !connected ? (
        <div className="flex flex-col gap-3 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Connect Google Calendar</p>
            <p className="mt-1 text-xs text-ink-muted">
              Stickies with due dates sync one-way into your primary Google
              Calendar. If you connected earlier, disconnect and reconnect to
              grant updated calendar scopes.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void run("Redirecting…", () => actions.connect.mutateAsync())}
          >
            Connect Google
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
            <p className="text-sm font-medium text-ink">
              {connection?.accountEmail ?? "Google account connected"}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Calendar: {connection?.calendarId ?? "primary"}
              {connection?.mappedEvents != null
                ? ` · ${connection.mappedEvents} mapped events`
                : ""}
              {connection?.lastSyncAt
                ? ` · last sync ${new Date(connection.lastSyncAt).toLocaleString()}`
                : ""}
            </p>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-[12px_14px_11px_13px] border-[1.5px] border-stroke-doodle/30 bg-surface px-3 py-3">
            <span>
              <span className="block text-sm font-medium text-ink">
                Sync enabled
              </span>
              <span className="text-xs text-ink-muted">
                Pause outbound sync without disconnecting
              </span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={Boolean(connection?.syncEnabled)}
              disabled={busy}
              onChange={(e) =>
                void run(
                  e.target.checked ? "Sync enabled." : "Sync paused.",
                  () =>
                    actions.update.mutateAsync({
                      syncEnabled: e.target.checked,
                    }),
                )
              }
            />
          </label>

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
              When a sticky is archived or deleted
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "cancel" as const,
                    label: "Cancel event",
                    hint: "Keep it in Google as cancelled",
                  },
                  {
                    value: "delete" as const,
                    label: "Delete event",
                    hint: "Remove it from Google Calendar",
                  },
                ] as const
              ).map((option) => {
                const selected =
                  (connection?.onRemovePolicy ?? "cancel") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run("Saved.", () =>
                        actions.update.mutateAsync({
                          onRemovePolicy: option.value,
                        }),
                      )
                    }
                    className={cn(
                      "rounded-[12px_14px_11px_13px] border-[1.5px] px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-stroke-doodle bg-sticky-ink shadow-[1px_1px_0_var(--doodle-shadow-soft)]"
                        : "border-stroke-doodle/25 hover:bg-sticky-ink/50",
                    )}
                  >
                    <p className="text-sm font-medium text-ink">{option.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {option.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {(hasConnectionError || itemErrors.length > 0) && (
            <div className="space-y-2 rounded-[12px_14px_11px_13px] border-[1.5px] border-danger/30 bg-sticky-blush/40 px-3 py-3">
              <p className="text-sm font-medium text-danger">Sync needs attention</p>
              {connection?.lastError ? (
                <p className="text-xs text-ink-muted">{connection.lastError}</p>
              ) : null}
              {itemErrors.slice(0, 5).map((row) => (
                <p key={row.mapId} className="text-xs text-ink-muted">
                  Sticky {row.itemId.slice(0, 8)}… — {row.error ?? "Failed"}
                </p>
              ))}
              {connection?.status === "error" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run("Redirecting…", () => actions.connect.mutateAsync())
                  }
                >
                  Reconnect Google
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !connection?.syncEnabled}
                  onClick={() =>
                    void run("Sync finished.", async () => {
                      const report = await actions.forceSync.mutateAsync();
                      if (report.failed > 0) {
                        setMessage(
                          `Synced with ${report.failed} failure${report.failed === 1 ? "" : "s"}.`,
                        );
                      }
                    })
                  }
                >
                  {actions.forceSync.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  Retry failed syncs
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || !connection?.syncEnabled}
              onClick={() =>
                void run("Sync finished.", async () => {
                  const report = await actions.forceSync.mutateAsync();
                  if (report.failed > 0) {
                    setMessage(
                      `Synced with ${report.failed} failure${report.failed === 1 ? "" : "s"}.`,
                    );
                  }
                })
              }
            >
              {actions.forceSync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              )}
              Sync now
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run("Disconnected.", () =>
                  actions.disconnect.mutateAsync("leave"),
                )
              }
            >
              <Unplug className="h-4 w-4" strokeWidth={1.75} />
              Disconnect
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run("Disconnected and removed events.", () =>
                  actions.disconnect.mutateAsync("delete"),
                )
              }
            >
              <CloudOff className="h-4 w-4" strokeWidth={1.75} />
              Disconnect & delete events
            </Button>
          </div>
        </>
      )}

      {busy ? <p className="text-xs text-ink-faint">Working…</p> : null}
    </div>
  );
}
