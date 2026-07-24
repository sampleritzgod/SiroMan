import type {
  CalendarEventMap,
  Item,
  Priority,
  StickyColor,
  Tag,
} from "@prisma/client";
import {
  deriveItemStatus,
  formatCivilDate,
  remainingDays,
  type CreateItemInput,
  type ItemSort,
  type ItemView,
  type UpdateItemInput,
  normalizeTagName,
  normalizeTags,
} from "@stickyflow/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";
import {
  cancelScheduledReminders,
  rebuildRemindersForItem,
} from "./reminderService.js";
import {
  scheduleExternalCalendarCleanup,
  scheduleItemCalendarSync,
  snapshotCalendarEventsForRemoval,
} from "../calendar-sync/index.js";

type ItemWithRelations = Item & {
  tags: Array<{ tag: Tag }>;
  calendarEvents: CalendarEventMap[];
};

export type StickyCalendarSyncView = {
  status: "local_only" | "syncing" | "synced" | "failed";
  provider: "google" | null;
  externalEventId: string | null;
  htmlLink: string | null;
  lastError: string | null;
};

export type SerializedItem = {
  id: string;
  title: string | null;
  description: string;
  content: string;
  color: StickyColor;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  pinned: boolean;
  archived: boolean;
  completedAt: string | null;
  positionX: number | null;
  positionY: number | null;
  rank: number;
  tags: string[];
  remainingDays: number | null;
  status: ReturnType<typeof deriveItemStatus>;
  calendarSync: StickyCalendarSyncView;
  createdAt: string;
  updatedAt: string;
};

function dueDateToCivil(dueDate: Date | null): string | null {
  if (!dueDate) return null;
  return formatCivilDate(dueDate);
}

function parseCivilDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function deriveCalendarSync(
  item: ItemWithRelations,
  calendarConnected: boolean,
): StickyCalendarSyncView {
  const map =
    item.calendarEvents.find(
      (row) => row.provider === "google" && row.syncStatus !== "removed",
    ) ??
    item.calendarEvents.find((row) => row.provider === "google") ??
    null;

  const empty: StickyCalendarSyncView = {
    status: "local_only",
    provider: null,
    externalEventId: null,
    htmlLink: null,
    lastError: null,
  };

  if (!item.dueDate || item.archived) {
    return empty;
  }

  if (!calendarConnected) {
    return empty;
  }

  if (!map || map.syncStatus === "removed") {
    return {
      status: "syncing",
      provider: "google",
      externalEventId: null,
      htmlLink: null,
      lastError: null,
    };
  }

  const externalId =
    map.externalEventId.startsWith("pending:") ? null : map.externalEventId;
  const htmlLink = externalId ? map.externalHtmlLink : null;

  if (map.syncStatus === "pending") {
    return {
      status: "syncing",
      provider: "google",
      externalEventId: externalId,
      htmlLink,
      lastError: null,
    };
  }

  if (map.syncStatus === "error") {
    return {
      status: "failed",
      provider: "google",
      externalEventId: externalId,
      htmlLink,
      lastError: map.lastError,
    };
  }

  return {
    status: "synced",
    provider: "google",
    externalEventId: externalId,
    htmlLink,
    lastError: null,
  };
}

export function serializeItem(
  item: ItemWithRelations,
  calendarConnected = false,
): SerializedItem {
  const due = dueDateToCivil(item.dueDate);
  const tags = item.tags.map((row) => row.tag.name);
  const description = item.description;

  return {
    id: item.id,
    title: item.title,
    description,
    content: description,
    color: item.color,
    priority: item.priority,
    dueDate: due,
    dueTime: item.dueTime ?? null,
    pinned: item.pinned,
    archived: item.archived,
    completedAt: item.completedAt?.toISOString() ?? null,
    positionX: item.positionX,
    positionY: item.positionY,
    rank: item.rank,
    tags,
    remainingDays: remainingDays(due),
    status: deriveItemStatus({
      dueDate: due,
      completedAt: item.completedAt,
    }),
    calendarSync: deriveCalendarSync(item, calendarConnected),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

const itemInclude = {
  tags: { include: { tag: true } },
  calendarEvents: true,
} as const;

async function userHasCalendarConnection(userId: string): Promise<boolean> {
  const count = await prisma.calendarConnection.count({
    where: { userId, syncEnabled: true },
  });
  return count > 0;
}

async function syncItemTags(userId: string, itemId: string, tagNames: string[]) {
  const names = normalizeTags(tagNames);

  await prisma.itemTag.deleteMany({ where: { itemId } });

  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
    await prisma.itemTag.create({
      data: { itemId, tagId: tag.id },
    });
  }
}

async function getOwnedItem(userId: string, id: string): Promise<ItemWithRelations> {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    include: itemInclude,
  });
  if (!item) {
    throw new ApiError(404, "ITEM_NOT_FOUND", "Sticky note not found");
  }
  return item;
}

export async function listItems(
  userId: string,
  opts: {
    view: ItemView;
    q?: string;
    tag?: string;
    priority?: Priority;
    sort: ItemSort;
    hideCompleted?: boolean;
    limit: number;
    cursor?: string;
  },
): Promise<{ data: SerializedItem[]; nextCursor: string | null }> {
  const where: Record<string, unknown> = { userId };

  if (opts.view === "archive") {
    where.archived = true;
  } else if (opts.view === "agenda") {
    where.archived = false;
    where.dueDate = { not: null };
    where.completedAt = null;
  } else {
    where.archived = false;
    if (opts.hideCompleted) {
      where.completedAt = null;
    }
  }

  if (opts.priority) {
    where.priority = opts.priority;
  }

  if (opts.tag) {
    const tagName = normalizeTagName(opts.tag);
    where.tags = { some: { tag: { name: tagName, userId } } };
  }

  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
    ];
  }

  const orderBy = orderByForSort(opts.sort, opts.view);

  const rows = await prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy,
    take: opts.limit + 1,
    ...(opts.cursor
      ? {
          cursor: { id: opts.cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
  const calendarConnected = await userHasCalendarConnection(userId);

  return {
    data: page.map((row) => serializeItem(row, calendarConnected)),
    nextCursor,
  };
}

function orderByForSort(sort: ItemSort, view: ItemView) {
  if (view === "agenda") {
    return [{ dueDate: "asc" as const }, { rank: "asc" as const }];
  }

  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" as const }];
    case "newest":
      return [{ createdAt: "desc" as const }];
    case "dueDate":
      return [
        { dueDate: { sort: "asc" as const, nulls: "last" as const } },
        { createdAt: "desc" as const },
      ];
    case "rank":
      return [{ rank: "asc" as const }, { updatedAt: "desc" as const }];
    case "pinned":
    default:
      return [
        { pinned: "desc" as const },
        { rank: "asc" as const },
        { updatedAt: "desc" as const },
      ];
  }
}

export async function getItem(userId: string, id: string) {
  const calendarConnected = await userHasCalendarConnection(userId);
  return serializeItem(await getOwnedItem(userId, id), calendarConnected);
}

export async function createItem(userId: string, input: CreateItemInput) {
  const description =
    input.description.trim() ||
    (input.title?.trim() ? input.title.trim() : "Untitled note");

  const maxRank = await prisma.item.aggregate({
    where: { userId, archived: false },
    _max: { rank: true },
  });
  const rank = input.rank ?? (maxRank._max.rank ?? 0) + 1;
  const dueDate = parseCivilDueDate(input.dueDate ?? null) ?? null;
  const dueTime =
    dueDate && input.dueTime !== undefined ? input.dueTime : dueDate ? (input.dueTime ?? null) : null;

  const dbSaveStarted = performance.now();
  const item = await prisma.item.create({
    data: {
      userId,
      title: input.title ?? null,
      description,
      color: input.color,
      priority: input.priority,
      dueDate,
      dueTime: dueTime ?? null,
      pinned: input.pinned,
      positionX: input.positionX,
      positionY: input.positionY,
      rank,
    },
    include: itemInclude,
  });
  const dbSaveMs = performance.now() - dbSaveStarted;

  if (input.tags.length) {
    await syncItemTags(userId, item.id, input.tags);
  }

  const calendarConnected = await userHasCalendarConnection(userId);
  const serialized = serializeItem(
    await getOwnedItem(userId, item.id),
    calendarConnected,
  );
  if (serialized.dueDate) {
    console.info("[calendar-sync:timing] sticky.saved", {
      itemId: item.id,
      op: "create",
      dbSaveMs: Math.round(dbSaveMs * 10) / 10,
    });
    void rebuildRemindersForItem(userId, item.id).catch((error) => {
      console.error("[reminders] rebuild after create failed", error);
    });
    scheduleItemCalendarSync(userId, item.id);
  }
  return serialized;
}

export async function updateItem(
  userId: string,
  id: string,
  patch: UpdateItemInput,
) {
  await getOwnedItem(userId, id);

  const data: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    data.title = patch.title?.trim() || null;
  }

  const nextDescription = patch.description ?? patch.content;
  if (nextDescription !== undefined) {
    data.description = nextDescription;
  }

  if (patch.color !== undefined) data.color = patch.color;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.dueDate !== undefined) {
    data.dueDate = parseCivilDueDate(patch.dueDate);
    if (patch.dueDate === null) {
      data.dueTime = null;
    }
  }
  if (patch.dueTime !== undefined) {
    data.dueTime = patch.dueTime;
  }
  if (patch.pinned !== undefined) data.pinned = patch.pinned;
  if (patch.positionX !== undefined) data.positionX = patch.positionX;
  if (patch.positionY !== undefined) data.positionY = patch.positionY;
  if (patch.rank !== undefined) data.rank = patch.rank;

  if (patch.archived !== undefined) {
    data.archived = patch.archived;
    if (patch.archived) {
      data.pinned = false;
    }
  }

  const dbSaveStarted = performance.now();
  await prisma.item.update({
    where: { id },
    data,
  });
  const dbSaveMs = performance.now() - dbSaveStarted;

  if (patch.tags !== undefined) {
    await syncItemTags(userId, id, patch.tags);
  }

  const calendarConnected = await userHasCalendarConnection(userId);
  const serialized = serializeItem(
    await getOwnedItem(userId, id),
    calendarConnected,
  );

  const reminderTouching =
    patch.dueDate !== undefined ||
    patch.priority !== undefined ||
    patch.archived !== undefined;

  if (reminderTouching) {
    void rebuildRemindersForItem(userId, id).catch((error) => {
      console.error("[reminders] rebuild after update failed", error);
    });
  }

  const calendarTouching =
    patch.dueDate !== undefined ||
    patch.dueTime !== undefined ||
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.content !== undefined ||
    patch.archived !== undefined;

  if (calendarTouching) {
    console.info("[calendar-sync:timing] sticky.saved", {
      itemId: id,
      op: "update",
      dbSaveMs: Math.round(dbSaveMs * 10) / 10,
    });
    scheduleItemCalendarSync(userId, id);
  }

  return serialized;
}

export async function deleteItem(userId: string, id: string) {
  await getOwnedItem(userId, id);
  await cancelScheduledReminders(id);
  // Snapshot Google event ids, delete sticky immediately, clean up Google async.
  const snapshots = await snapshotCalendarEventsForRemoval(userId, id);
  await prisma.item.delete({ where: { id } });
  scheduleExternalCalendarCleanup(snapshots);
}

export async function completeItem(
  userId: string,
  id: string,
  autoArchive: boolean | null | undefined,
) {
  const item = await getOwnedItem(userId, id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const shouldArchive =
    autoArchive === null || autoArchive === undefined
      ? user.autoArchiveOnComplete
      : autoArchive;

  await prisma.item.update({
    where: { id },
    data: {
      completedAt: new Date(),
      ...(shouldArchive ? { archived: true, pinned: false } : {}),
    },
  });

  void cancelScheduledReminders(id).catch((error) => {
    console.error("[reminders] cancel after complete failed", error);
  });
  // Keep calendar event in sync with completion (✓ title / still dated).
  scheduleItemCalendarSync(userId, id);

  const calendarConnected = await userHasCalendarConnection(userId);
  return serializeItem(await getOwnedItem(userId, item.id), calendarConnected);
}

export async function reopenItem(userId: string, id: string) {
  await getOwnedItem(userId, id);
  await prisma.item.update({
    where: { id },
    data: { completedAt: null },
  });
  const calendarConnected = await userHasCalendarConnection(userId);
  const serialized = serializeItem(
    await getOwnedItem(userId, id),
    calendarConnected,
  );
  void rebuildRemindersForItem(userId, id).catch((error) => {
    console.error("[reminders] rebuild after reopen failed", error);
  });
  scheduleItemCalendarSync(userId, id);
  return serialized;
}

export async function reorderItems(userId: string, orderedIds: string[]) {
  const owned = await prisma.item.findMany({
    where: { userId, id: { in: orderedIds } },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((row) => row.id));
  const ids = orderedIds.filter((id) => ownedSet.has(id));

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.item.update({
        where: { id },
        data: { rank: index },
      }),
    ),
  );

  const rows = await prisma.item.findMany({
    where: { userId, id: { in: ids } },
    include: itemInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const calendarConnected = await userHasCalendarConnection(userId);
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => serializeItem(row as ItemWithRelations, calendarConnected));
}

export async function listTags(userId: string) {
  const tags = await prisma.tag.findMany({
    where: { userId },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  return {
    data: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: tag._count.items,
    })),
  };
}
