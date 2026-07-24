"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { itemsKeys } from "@/hooks/use-items";
import type { StickyNote } from "@/lib/types";

export type GoogleCalendarConnection = {
  id: string;
  provider: "google";
  syncEnabled: boolean;
  status: "connected" | "syncing" | "error" | "paused" | "disconnected";
  calendarId: string;
  accountEmail: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  onRemovePolicy: string;
  mappedEvents: number;
};

export type GoogleCalendarStatus = {
  id: "google";
  configured: boolean;
  connected: boolean;
  connection: GoogleCalendarConnection | null;
};

export type CalendarIntegrationsStatus = {
  providers: GoogleCalendarStatus[];
  errors: Array<{
    mapId: string;
    itemId: string;
    provider: string;
    error: string | null;
    updatedAt: string;
  }>;
};

export const calendarSyncKeys = {
  all: ["calendar-sync"] as const,
  status: ["calendar-sync", "status"] as const,
  google: ["calendar-sync", "google"] as const,
};

export function useCalendarConnectionStatus() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: calendarSyncKeys.status,
    queryFn: () =>
      api<CalendarIntegrationsStatus>("/v1/integrations/calendar"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useGoogleCalendarStatus() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: calendarSyncKeys.google,
    queryFn: () =>
      api<GoogleCalendarStatus>("/v1/integrations/google"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useCalendarConnectionActions() {
  const { api } = useApiClient();
  const client = useQueryClient();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: calendarSyncKeys.all });
    void client.invalidateQueries({ queryKey: itemsKeys.all });
  };

  const connect = useMutation({
    mutationFn: async () => {
      const res = await api<{ url: string }>("/v1/integrations/google/start");
      if (!res.url) throw new Error("Missing OAuth URL");
      window.location.assign(res.url);
      return res;
    },
  });

  const disconnect = useMutation({
    mutationFn: (mode: "leave" | "delete" = "leave") =>
      api<void>("/v1/integrations/google", {
        method: "DELETE",
        body: JSON.stringify({ mode }),
      }),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: (patch: {
      syncEnabled?: boolean;
      onRemovePolicy?: "cancel" | "delete";
    }) =>
      api("/v1/integrations/google", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSettled: invalidate,
  });

  const forceSync = useMutation({
    mutationFn: () =>
      api<{
        attempted: number;
        created: number;
        updated: number;
        removed: number;
        skipped: number;
        failed: number;
        errors: Array<{ itemId: string; error: string }>;
      }>("/v1/integrations/google/sync", { method: "POST" }),
    onSettled: invalidate,
  });

  return { connect, disconnect, update, forceSync };
}

export function useStickyCalendarActions() {
  const { api } = useApiClient();
  const client = useQueryClient();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: itemsKeys.all });
    void client.invalidateQueries({ queryKey: calendarSyncKeys.all });
  };

  const syncNow = useMutation({
    mutationFn: (itemId: string) =>
      api<{ results: unknown[] }>(`/v1/integrations/google/retry/${itemId}`, {
        method: "POST",
      }),
    onMutate: async (itemId) => {
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const entries = client.getQueriesData<{ data: StickyNote[] }>({
        queryKey: itemsKeys.all,
      });
      for (const [key, value] of entries) {
        if (!value?.data) continue;
        client.setQueryData(key, {
          ...value,
          data: value.data.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  calendarSync: {
                    ...item.calendarSync,
                    status: "syncing" as const,
                    lastError: null,
                  },
                }
              : item,
          ),
        });
      }
    },
    onSettled: invalidate,
  });

  const removeFromCalendar = useMutation({
    mutationFn: (itemId: string) =>
      api<{ results: unknown[] }>(`/v1/integrations/google/unlink/${itemId}`, {
        method: "POST",
      }),
    onSettled: invalidate,
  });

  return { syncNow, removeFromCalendar };
}
