"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReminderFrequency, SnoozeReminderInput } from "@stickyflow/shared";
import { useApiClient } from "@/lib/api-client";
import type {
  InboxEntry,
  InboxSummary,
  Me,
  ReminderBoard,
} from "@/lib/types";

export const reminderKeys = {
  all: ["reminders"] as const,
  inbox: (unreadOnly?: boolean) =>
    ["reminders", "inbox", { unreadOnly: Boolean(unreadOnly) }] as const,
  summary: ["reminders", "summary"] as const,
  board: ["reminders", "board"] as const,
};

export function useInbox(unreadOnly = false) {
  const { api } = useApiClient();
  return useQuery({
    queryKey: reminderKeys.inbox(unreadOnly),
    queryFn: () =>
      api<{ data: InboxEntry[]; nextCursor: string | null }>(
        `/v1/inbox?unreadOnly=${unreadOnly ? "true" : "false"}&limit=50`,
      ),
    refetchInterval: 30_000,
  });
}

export function useInboxSummary() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: reminderKeys.summary,
    queryFn: () => api<InboxSummary>("/v1/inbox/summary"),
    refetchInterval: 30_000,
  });
}

export function useReminderBoard() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: reminderKeys.board,
    queryFn: () => api<ReminderBoard>("/v1/reminders/board"),
    refetchInterval: 60_000,
  });
}

export function useReminderMutations() {
  const { api } = useApiClient();
  const client = useQueryClient();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: reminderKeys.all });
  };

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/inbox/${id}/read`, { method: "POST" }),
    onSettled: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api<void>("/v1/inbox/read-all", { method: "POST" }),
    onSettled: invalidate,
  });

  const snooze = useMutation({
    mutationFn: ({
      occurrenceId,
      input,
    }: {
      occurrenceId: string;
      input: SnoozeReminderInput;
    }) =>
      api<{ occurrenceId: string; fireAt: string }>(
        `/v1/reminders/${occurrenceId}/snooze`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSettled: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: (occurrenceId: string) =>
      api<void>(`/v1/reminders/${occurrenceId}/dismiss`, {
        method: "POST",
      }),
    onSettled: invalidate,
  });

  return { markRead, markAllRead, snooze, dismiss };
}

export type ReminderSettingsPatch = {
  remindersEnabled?: boolean;
  reminderFrequency?: ReminderFrequency;
  reminderMorningMinute?: number;
  reminderEveningMinute?: number;
  quietHoursStartMinute?: number;
  quietHoursEndMinute?: number;
  browserNotificationsEnabled?: boolean;
  timezone?: string;
};

export function useUpdateMe() {
  const { api } = useApiClient();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (patch: ReminderSettingsPatch) =>
      api<Me>("/v1/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      client.setQueryData(["me"], data);
      void client.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}
