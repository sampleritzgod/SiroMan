import type { ItemSort, ItemStatus, ItemView, Priority, StickyColor } from "@stickyflow/shared";

export type Me = {
  id: string;
  email: string | null;
  displayName: string | null;
  timezone: string;
  weekStartsOn: "sunday" | "monday";
  autoArchiveOnComplete: boolean;
  onboardingCompleted: boolean;
  remindersEnabled: boolean;
  quietHoursStartMinute: number;
  quietHoursEndMinute: number;
  reminderFrequency: "gentle" | "standard" | "intensive";
  reminderMorningMinute: number;
  reminderEveningMinute: number;
  browserNotificationsEnabled: boolean;
  createdAt: string;
};

/** Sticky note from GET/POST/PATCH /v1/items — `content` mirrors `description`. */
export type StickyNote = {
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
  tags: string[];
  rank: number;
  remainingDays: number | null;
  status: ItemStatus;
  calendarSync?: StickyCalendarSync;
  createdAt: string;
  updatedAt: string;
};

export type StickyCalendarSync = {
  status: "local_only" | "syncing" | "synced" | "failed";
  provider: "google" | null;
  externalEventId: string | null;
  htmlLink: string | null;
  lastError: string | null;
};

export type StickyNoteInput = {
  title?: string | null;
  description?: string;
  content?: string;
  color?: StickyColor;
  priority?: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  rank?: number;
};

export type StickyNoteView = StickyNote;

export type StickyTag = {
  id: string;
  name: string;
  count: number;
};

export type ItemsListResponse = {
  data: StickyNote[];
  nextCursor: string | null;
};

export type ItemsQuery = {
  view?: ItemView;
  q?: string;
  tag?: string;
  priority?: Priority | "";
  sort?: ItemSort;
  hideCompleted?: boolean;
  limit?: number;
};

export type AppView = "home" | "stickies" | "archive" | "calendar" | "reminders";

export type CalendarMode = "month" | "week" | "day";

export type CalendarRangeFilter = "all" | "today" | "week" | "month";

export type InboxEntry = {
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
    color: StickyColor;
    priority: Priority;
    dueDate: string | null;
    dueTime: string | null;
    status: ItemStatus;
    remainingDays: number | null;
    completedAt: string | null;
    archived: boolean;
  } | null;
};

export type InboxSummary = {
  unreadCount: number;
};

export type ReminderBoardItem = {
  id: string;
  title: string | null;
  color: StickyColor;
  priority: Priority;
  dueDate: string | null;
  remainingDays: number | null;
  status: ItemStatus;
  completedAt: string | null;
};

export type ReminderBoard = {
  upcoming: ReminderBoardItem[];
  today: ReminderBoardItem[];
  overdue: ReminderBoardItem[];
  recentlyCompleted: ReminderBoardItem[];
};
