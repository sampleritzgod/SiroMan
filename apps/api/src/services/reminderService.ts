import type { Item, Priority, User } from "@prisma/client";
import {
  buildReminderCopy,
  buildReminderPlan,
  deriveItemStatus,
  formatCivilDate,
  remainingDays,
  resolveSnoozeUntil,
  type ReminderFrequency,
  type ReminderUserPrefs,
  type SnoozeReminderInput,
} from "@stickyflow/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";

const DEDUPE_MS = 6 * 60 * 60 * 1000;

function prefsFromUser(user: User): ReminderUserPrefs {
  return {
    timezone: user.timezone,
    remindersEnabled: user.remindersEnabled,
    reminderFrequency: user.reminderFrequency as ReminderFrequency,
    reminderMorningMinute: user.reminderMorningMinute,
    reminderEveningMinute: user.reminderEveningMinute,
    quietHoursStartMinute: user.quietHoursStartMinute,
    quietHoursEndMinute: user.quietHoursEndMinute,
  };
}

function dueCivil(dueDate: Date | null): string | null {
  if (!dueDate) return null;
  return formatCivilDate(dueDate);
}

export async function cancelScheduledReminders(itemId: string) {
  await prisma.reminderOccurrence.updateMany({
    where: {
      itemId,
      status: { in: ["scheduled", "claimed", "snoozed"] },
    },
    data: { status: "cancelled" },
  });
}

export async function rebuildRemindersForItem(userId: string, itemId: string) {
  const [user, item] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.item.findFirst({ where: { id: itemId, userId } }),
  ]);

  if (!item) return;

  await cancelScheduledReminders(itemId);

  const due = dueCivil(item.dueDate);
  if (!user.remindersEnabled || !due || item.archived || item.completedAt) {
    return;
  }

  const plan = buildReminderPlan({
    dueDate: due,
    priority: item.priority,
    createdAt: item.createdAt,
    prefs: prefsFromUser(user),
  });

  if (!plan.length) return;

  await prisma.reminderOccurrence.createMany({
    data: plan.map((entry) => ({
      itemId,
      userId,
      policyKey: entry.policyKey,
      fireAt: entry.fireAt,
      status: "scheduled" as const,
      channel: "inbox" as const,
    })),
    skipDuplicates: true,
  });
}

export async function rebuildRemindersForUser(userId: string) {
  const items = await prisma.item.findMany({
    where: {
      userId,
      archived: false,
      completedAt: null,
      dueDate: { not: null },
    },
    select: { id: true },
  });

  for (const item of items) {
    await rebuildRemindersForItem(userId, item.id);
  }
}

async function recentlyNotified(itemId: string, now: Date) {
  const since = new Date(now.getTime() - DEDUPE_MS);
  const recent = await prisma.reminderOccurrence.findFirst({
    where: {
      itemId,
      status: "sent",
      sentAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

async function deliverOccurrence(
  occurrenceId: string,
  item: Item,
  userId: string,
) {
  const copy = buildReminderCopy({
    title: item.title,
    dueDate: dueCivil(item.dueDate),
  });

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.reminderOccurrence.updateMany({
      where: { id: occurrenceId, status: { in: ["scheduled", "snoozed"] } },
      data: { status: "claimed", claimedAt: new Date() },
    });
    if (!claimed.count) return;

    await tx.reminderInboxEntry.create({
      data: {
        userId,
        itemId: item.id,
        occurrenceId,
        title: copy.title,
        body: copy.body,
      },
    });

    await tx.reminderOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "sent", sentAt: new Date(), channel: "inbox" },
    });
  });

  const due = dueCivil(item.dueDate);
  if (
    !item.completedAt &&
    !item.archived &&
    due &&
    due < formatCivilDate(new Date())
  ) {
    await rebuildRemindersForItem(userId, item.id);
  }
}

/** Claim due reminders and write inbox entries. Returns newly delivered count. */
export async function processDueReminders(limit = 50): Promise<number> {
  const now = new Date();
  const due = await prisma.reminderOccurrence.findMany({
    where: {
      status: { in: ["scheduled", "snoozed"] },
      fireAt: { lte: now },
      user: { remindersEnabled: true },
      item: {
        archived: false,
        completedAt: null,
        dueDate: { not: null },
      },
    },
    include: { item: true },
    orderBy: { fireAt: "asc" },
    take: limit,
  });

  let delivered = 0;
  for (const row of due) {
    if (await recentlyNotified(row.itemId, now)) {
      await prisma.reminderOccurrence.update({
        where: { id: row.id },
        data: { status: "cancelled" },
      });
      continue;
    }

    try {
      await deliverOccurrence(row.id, row.item, row.userId);
      delivered += 1;
    } catch (error) {
      await prisma.reminderOccurrence.update({
        where: { id: row.id },
        data: {
          status: "failed",
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "deliver failed",
          retryCount: { increment: 1 },
        },
      });
    }
  }

  return delivered;
}

export type SerializedInboxEntry = {
  id: string;
  itemId: string;
  occurrenceId: string;
  title: string;
  body: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  item: {
    id: string;
    title: string | null;
    color: string;
    priority: Priority;
    dueDate: string | null;
    dueTime: string | null;
    status: string;
    remainingDays: number | null;
    completedAt: string | null;
    archived: boolean;
  } | null;
};

function serializeInbox(row: {
  id: string;
  itemId: string;
  occurrenceId: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  item: Item | null;
}): SerializedInboxEntry {
  const due = row.item ? dueCivil(row.item.dueDate) : null;
  return {
    id: row.id,
    itemId: row.itemId,
    occurrenceId: row.occurrenceId,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    item: row.item
      ? {
          id: row.item.id,
          title: row.item.title,
          color: row.item.color,
          priority: row.item.priority,
          dueDate: due,
          dueTime: row.item.dueTime ?? null,
          remainingDays: remainingDays(due),
          status: deriveItemStatus({
            dueDate: due,
            completedAt: row.item.completedAt,
          }),
          completedAt: row.item.completedAt?.toISOString() ?? null,
          archived: row.item.archived,
        }
      : null,
  };
}

export async function listInbox(
  userId: string,
  opts: { unreadOnly?: boolean; limit: number; cursor?: string },
) {
  await processDueReminders(25);

  const rows = await prisma.reminderInboxEntry.findMany({
    where: {
      userId,
      dismissedAt: null,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    },
    include: { item: true },
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    data: page.map((row) => serializeInbox(row)),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function inboxSummary(userId: string) {
  await processDueReminders(15);
  const unreadCount = await prisma.reminderInboxEntry.count({
    where: { userId, readAt: null, dismissedAt: null },
  });
  return { unreadCount };
}

export async function markInboxRead(userId: string, inboxId: string) {
  const entry = await prisma.reminderInboxEntry.findFirst({
    where: { id: inboxId, userId },
  });
  if (!entry) throw new ApiError(404, "INBOX_NOT_FOUND", "Notification not found");
  if (!entry.readAt) {
    await prisma.reminderInboxEntry.update({
      where: { id: inboxId },
      data: { readAt: new Date() },
    });
  }
}

export async function markAllInboxRead(userId: string) {
  await prisma.reminderInboxEntry.updateMany({
    where: { userId, readAt: null, dismissedAt: null },
    data: { readAt: new Date() },
  });
}

export async function dismissReminder(userId: string, occurrenceId: string) {
  const occurrence = await prisma.reminderOccurrence.findFirst({
    where: { id: occurrenceId, userId },
    include: { inbox: true },
  });
  if (!occurrence) {
    throw new ApiError(404, "REMINDER_NOT_FOUND", "Reminder not found");
  }

  await prisma.reminderOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "cancelled" },
  });

  if (occurrence.inbox) {
    await prisma.reminderInboxEntry.update({
      where: { id: occurrence.inbox.id },
      data: {
        dismissedAt: new Date(),
        readAt: occurrence.inbox.readAt ?? new Date(),
      },
    });
  }
}

export async function snoozeReminder(
  userId: string,
  occurrenceId: string,
  input: SnoozeReminderInput,
) {
  const [user, occurrence] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.reminderOccurrence.findFirst({
      where: { id: occurrenceId, userId },
      include: { item: true, inbox: true },
    }),
  ]);

  if (!occurrence) {
    throw new ApiError(404, "REMINDER_NOT_FOUND", "Reminder not found");
  }

  const until = resolveSnoozeUntil(input, prefsFromUser(user));

  await prisma.reminderOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "snoozed" },
  });

  if (occurrence.inbox && !occurrence.inbox.readAt) {
    await prisma.reminderInboxEntry.update({
      where: { id: occurrence.inbox.id },
      data: { readAt: new Date() },
    });
  }

  const created = await prisma.reminderOccurrence.create({
    data: {
      itemId: occurrence.itemId,
      userId,
      policyKey: "snooze",
      fireAt: until,
      status: "scheduled",
      channel: "inbox",
    },
  });

  return {
    occurrenceId: created.id,
    fireAt: created.fireAt.toISOString(),
  };
}

/** Live reminder board derived from sticky notes (single source of truth). */
export async function reminderBoard(userId: string) {
  await processDueReminders(15);

  const [open, completed] = await Promise.all([
    prisma.item.findMany({
      where: {
        userId,
        archived: false,
        completedAt: null,
        dueDate: { not: null },
      },
      orderBy: [{ dueDate: "asc" }, { rank: "asc" }],
      take: 100,
    }),
    prisma.item.findMany({
      where: {
        userId,
        completedAt: { not: null },
        dueDate: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
  ]);

  // Backfill schedules for dated stickies that have none yet.
  for (const item of open) {
    const scheduled = await prisma.reminderOccurrence.count({
      where: {
        itemId: item.id,
        status: { in: ["scheduled", "snoozed"] },
      },
    });
    if (scheduled === 0) {
      await rebuildRemindersForItem(userId, item.id);
    }
  }

  const mapItem = (item: Item) => {
    const due = dueCivil(item.dueDate);
    return {
      id: item.id,
      title: item.title,
      color: item.color,
      priority: item.priority,
      dueDate: due,
      remainingDays: remainingDays(due),
      status: deriveItemStatus({
        dueDate: due,
        completedAt: item.completedAt,
      }),
      completedAt: item.completedAt?.toISOString() ?? null,
    };
  };

  const upcoming = open
    .map(mapItem)
    .filter((i) => i.status === "upcoming" || i.status === "tomorrow");
  const today = open.map(mapItem).filter((i) => i.status === "today");
  const overdue = open.map(mapItem).filter((i) => i.status === "overdue");
  const recentlyCompleted = completed.map(mapItem);

  return { upcoming, today, overdue, recentlyCompleted };
}
