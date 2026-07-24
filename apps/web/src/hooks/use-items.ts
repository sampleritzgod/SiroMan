"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ItemSort, Priority } from "@stickyflow/shared";
import { useApiClient, isApiClientError } from "@/lib/api-client";
import { cancelBrowserNotificationForSticky } from "@/lib/browser-notifications";
import { maybeEnableNotificationsForFirstReminder } from "@/lib/first-reminder-notifications";
import type {
  ItemsListResponse,
  ItemsQuery,
  Me,
  StickyNote,
  StickyNoteInput,
  StickyTag,
} from "@/lib/types";
import { reminderKeys } from "@/hooks/use-reminders";

export const itemsKeys = {
  all: ["items"] as const,
  list: (query: ItemsQuery) => ["items", "list", query] as const,
  tags: ["tags"] as const,
};

function toSearchParams(query: ItemsQuery) {
  const params = new URLSearchParams();
  params.set("view", query.view ?? "board");
  params.set("sort", query.sort ?? "pinned");
  params.set("limit", String(query.limit ?? 100));
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.tag) params.set("tag", query.tag);
  if (query.priority) params.set("priority", query.priority);
  if (query.hideCompleted) params.set("hideCompleted", "true");
  return params.toString();
}

function patchLists(
  client: ReturnType<typeof useQueryClient>,
  updater: (items: StickyNote[]) => StickyNote[],
) {
  const entries = client.getQueriesData<ItemsListResponse>({
    queryKey: itemsKeys.all,
  });
  for (const [key, value] of entries) {
    if (!value?.data) continue;
    client.setQueryData(key, {
      ...value,
      data: updater(value.data),
    });
  }
}

function markCalendarSyncing(item: StickyNote, patch?: StickyNoteInput): StickyNote {
  const nextDue =
    patch?.dueDate !== undefined ? patch.dueDate : item.dueDate;
  const nextArchived =
    patch?.archived !== undefined ? patch.archived : item.archived;
  if (!nextDue || nextArchived) {
    return {
      ...item,
      calendarSync: {
        status: "local_only",
        provider: null,
        externalEventId: null,
        htmlLink: null,
        lastError: null,
      },
    };
  }
  const status = item.calendarSync?.status;
  // Only optimistic Syncing when calendar was already involved (avoid false badge).
  if (status === "synced" || status === "failed" || status === "syncing") {
    return {
      ...item,
      calendarSync: {
        ...item.calendarSync!,
        status: "syncing",
        lastError: null,
      },
    };
  }
  return item;
}

function isCalendarTouchingPatch(patch: StickyNoteInput) {
  return (
    patch.dueDate !== undefined ||
    patch.dueTime !== undefined ||
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.content !== undefined ||
    patch.archived !== undefined
  );
}

export function useItems(query: ItemsQuery = {}) {
  const { api } = useApiClient();
  const normalized: ItemsQuery = {
    view: query.view ?? "board",
    q: query.q ?? "",
    tag: query.tag ?? "",
    priority: query.priority ?? "",
    sort: query.sort ?? "pinned",
    hideCompleted: query.hideCompleted ?? false,
    limit: query.limit ?? 100,
  };

  return useQuery({
    queryKey: itemsKeys.list(normalized),
    queryFn: () =>
      api<ItemsListResponse>(`/v1/items?${toSearchParams(normalized)}`),
    retry: (count, error) => {
      if (isApiClientError(error) && error.status === 401) return false;
      return count < 2;
    },
    // Keep badge snappy: poll while any sticky is Syncing, stop when settled.
    refetchInterval: (query) => {
      const items = query.state.data?.data;
      if (!items?.some((item) => item.calendarSync?.status === "syncing")) {
        return false;
      }
      return 400;
    },
  });
}

export function useTags() {
  const { api } = useApiClient();
  return useQuery({
    queryKey: itemsKeys.tags,
    queryFn: () => api<{ data: StickyTag[] }>("/v1/tags"),
    select: (res) => res.data,
  });
}

export function useStickyMutations() {
  const { api } = useApiClient();
  const client = useQueryClient();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: itemsKeys.all });
    void client.invalidateQueries({ queryKey: itemsKeys.tags });
    void client.invalidateQueries({ queryKey: reminderKeys.all });
  };

  const create = useMutation({
    mutationFn: (input: StickyNoteInput) =>
      api<StickyNote>("/v1/items", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: input.description ?? input.content ?? "",
          color: input.color,
          priority: input.priority,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          tags: input.tags,
          pinned: input.pinned,
        }),
      }),
    onSuccess: (created) => {
      // Keep badge optimistic Syncing when calendar is involved; never invent it for local-only.
      const optimistic =
        created.dueDate &&
        created.calendarSync &&
        created.calendarSync.status !== "local_only"
          ? {
              ...created,
              calendarSync: {
                ...created.calendarSync,
                status: "syncing" as const,
                lastError: null,
              },
            }
          : created;
      patchLists(client, (items) => [
        optimistic,
        ...items.filter((i) => i.id !== created.id),
      ]);
      invalidate();
      if (created.dueDate) {
        void maybeEnableNotificationsForFirstReminder({
          dueDate: created.dueDate,
          me: client.getQueryData<Me>(["me"]),
          patchMe: (patch) =>
            api<Me>("/v1/me", {
              method: "PATCH",
              body: JSON.stringify(patch),
            }),
          queryClient: client,
        });
      }
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StickyNoteInput }) =>
      api<StickyNote>(`/v1/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...patch,
          description: patch.description ?? patch.content,
        }),
      }),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      const entries = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      const calendarTouching = isCalendarTouchingPatch(patch);
      for (const [key, value] of entries) {
        if (!value?.data) continue;
        const keyObj = key as unknown[];
        const query = keyObj[2] as ItemsQuery | undefined;
        const view = query?.view ?? "board";
        let next = value.data.map((item) => {
          if (item.id !== id) return item;
          let updated: StickyNote = {
            ...item,
            ...patch,
            title: patch.title !== undefined ? patch.title : item.title,
            description:
              patch.description !== undefined
                ? patch.description
                : patch.content !== undefined
                  ? patch.content
                  : item.description,
            content:
              patch.description !== undefined
                ? patch.description
                : patch.content !== undefined
                  ? patch.content
                  : item.content,
            tags: patch.tags ?? item.tags,
            updatedAt: new Date().toISOString(),
          };
          if (calendarTouching) {
            updated = markCalendarSyncing(updated, patch);
          }
          return updated;
        });
        if (view === "agenda") {
          next = next.filter(
            (item) =>
              item.id !== id ||
              (Boolean(item.dueDate) &&
                !item.archived &&
                !item.completedAt),
          );
        }
        client.setQueryData(key, { ...value, data: next });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSuccess: (updated, { patch }) => {
      if (updated.archived || updated.completedAt) {
        cancelBrowserNotificationForSticky(updated.id);
      }
      const dueDate =
        patch.dueDate !== undefined ? patch.dueDate : updated.dueDate;
      if (dueDate) {
        void maybeEnableNotificationsForFirstReminder({
          dueDate,
          me: client.getQueryData<Me>(["me"]),
          patchMe: (prefs) =>
            api<Me>("/v1/me", {
              method: "PATCH",
              body: JSON.stringify(prefs),
            }),
          queryClient: client,
        });
      }
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      cancelBrowserNotificationForSticky(id);
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      patchLists(client, (items) => items.filter((item) => item.id !== id));
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });

  const togglePin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api<StickyNote>(`/v1/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned }),
      }),
    onMutate: async ({ id, pinned }) => {
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      patchLists(client, (items) =>
        items.map((item) => (item.id === id ? { ...item, pinned } : item)),
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });

  const toggleArchive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api<StickyNote>(`/v1/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }),
    onMutate: async ({ id, archived }) => {
      if (archived) cancelBrowserNotificationForSticky(id);
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      const entries = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      for (const [key, value] of entries) {
        if (!value?.data) continue;
        const keyObj = key as unknown[];
        const query = keyObj[2] as ItemsQuery | undefined;
        const view = query?.view ?? "board";
        let next = value.data.map((item) => {
          if (item.id !== id) return item;
          const updated: StickyNote = {
            ...item,
            archived,
            pinned: archived ? false : item.pinned,
          };
          return markCalendarSyncing(updated, { archived });
        });

        if ((view === "board" || view === "agenda") && archived) {
          next = next.filter((item) => item.id !== id);
        }
        if (view === "archive" && !archived) {
          next = next.filter((item) => item.id !== id);
        }
        client.setQueryData(key, { ...value, data: next });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });

  const toggleComplete = useMutation({
    mutationFn: async ({
      id,
      completed,
    }: {
      id: string;
      completed: boolean;
    }) => {
      if (completed) {
        return api<StickyNote>(`/v1/items/${id}/complete`, {
          method: "POST",
          body: JSON.stringify({ autoArchive: null }),
        });
      }
      return api<StickyNote>(`/v1/items/${id}/reopen`, { method: "POST" });
    },
    onMutate: async ({ id, completed }) => {
      if (completed) cancelBrowserNotificationForSticky(id);
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      patchLists(client, (items) =>
        items.map((item) => {
          if (item.id !== id) return item;
          const updated: StickyNote = {
            ...item,
            completedAt: completed ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          };
          return markCalendarSyncing(updated);
        }),
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api<{ data: StickyNote[] }>("/v1/items/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      }),
    onMutate: async (orderedIds) => {
      await client.cancelQueries({ queryKey: itemsKeys.all });
      const snapshots = client.getQueriesData<ItemsListResponse>({
        queryKey: itemsKeys.all,
      });
      patchLists(client, (items) => {
        const byId = new Map(items.map((item) => [item.id, item]));
        const reordered = orderedIds
          .map((id, index) => {
            const item = byId.get(id);
            return item ? { ...item, rank: index } : null;
          })
          .filter(Boolean) as StickyNote[];
        const rest = items.filter((item) => !orderedIds.includes(item.id));
        return [...reordered, ...rest];
      });
      return { snapshots };
    },
    onError: (_err, _ids, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });

  return {
    create,
    update,
    remove,
    togglePin,
    toggleArchive,
    toggleComplete,
    reorder,
  };
}

/** Convenience facade matching the previous useStickies shape. */
export function useStickiesWorkspace(opts?: {
  view?: "board" | "archive";
  q?: string;
  tag?: string;
  priority?: Priority | "";
  sort?: ItemSort;
}) {
  const board = useItems({
    view: opts?.view === "archive" ? "archive" : "board",
    q: opts?.q,
    tag: opts?.tag,
    priority: opts?.priority,
    sort: opts?.sort ?? "pinned",
  });
  const allBoard = useItems({ view: "board", sort: "pinned" });
  const archive = useItems({ view: "archive", sort: "newest" });
  const mutations = useStickyMutations();
  const tags = useTags();

  const active = allBoard.data?.data ?? [];
  const archived = archive.data?.data ?? [];
  const listed = board.data?.data ?? [];

  return {
    ready: !board.isLoading && !allBoard.isLoading,
    isLoading: board.isLoading || allBoard.isLoading,
    isError: board.isError || allBoard.isError,
    error: board.error ?? allBoard.error,
    refetch: () => {
      void board.refetch();
      void allBoard.refetch();
      void archive.refetch();
    },
    notes: listed,
    active,
    archived,
    pinned: active.filter((n) => n.pinned && !n.completedAt),
    tags: tags.data ?? [],
    create: (input: StickyNoteInput = {}) => mutations.create.mutateAsync(input),
    update: (id: string, patch: StickyNoteInput) =>
      mutations.update.mutateAsync({ id, patch }),
    remove: (id: string) => mutations.remove.mutateAsync(id),
    togglePin: (id: string) => {
      const note = [...active, ...archived, ...listed].find((n) => n.id === id);
      if (!note) return Promise.resolve();
      return mutations.togglePin.mutateAsync({ id, pinned: !note.pinned });
    },
    toggleArchive: (id: string) => {
      const note = [...active, ...archived, ...listed].find((n) => n.id === id);
      if (!note) return Promise.resolve();
      return mutations.toggleArchive.mutateAsync({
        id,
        archived: !note.archived,
      });
    },
    toggleComplete: (id: string) => {
      const note = [...active, ...archived, ...listed].find((n) => n.id === id);
      if (!note) return Promise.resolve();
      return mutations.toggleComplete.mutateAsync({
        id,
        completed: !note.completedAt,
      });
    },
    reorder: (orderedIds: string[]) => mutations.reorder.mutateAsync(orderedIds),
    isMutating:
      mutations.create.isPending ||
      mutations.update.isPending ||
      mutations.remove.isPending,
  };
}
