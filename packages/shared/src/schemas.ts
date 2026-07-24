import { z } from "zod";

export const weekStartSchema = z.enum(["sunday", "monday"]);
export const prioritySchema = z.enum(["none", "low", "medium", "high"]);
export const stickyColorSchema = z.enum([
  "butter",
  "mist",
  "sage",
  "blush",
  "slate",
  "lavender",
  "peach",
  "ink",
]);

export const itemViewSchema = z.enum(["board", "agenda", "archive"]);
export const itemSortSchema = z.enum([
  "newest",
  "oldest",
  "pinned",
  "dueDate",
  "rank",
]);

/** Normalize tag names: trim, strip leading #, lowercase, collapse whitespace. */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const name = normalizeTagName(tag);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 20) break;
  }
  return out;
}

const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
  .nullable();

const dueTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "dueTime must be HH:mm")
  .nullable();

const tagsInputSchema = z
  .array(z.string().max(40))
  .max(20)
  .optional()
  .transform((tags) => normalizeTags(tags));

export const createItemSchema = z
  .object({
    title: z.string().max(120).nullable().optional(),
    /** Body text — stored as Item.description; `content` accepted as alias. */
    description: z.string().max(10_000).optional(),
    content: z.string().max(10_000).optional(),
    color: stickyColorSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: civilDateSchema.optional(),
    dueTime: dueTimeSchema.optional(),
    tags: tagsInputSchema,
    pinned: z.boolean().optional(),
    positionX: z.number().finite().optional(),
    positionY: z.number().finite().optional(),
    rank: z.number().int().optional(),
  })
  .transform((data) => {
    const description = (data.description ?? data.content ?? "").trimEnd();
    const dueDate = data.dueDate === undefined ? undefined : data.dueDate;
    let dueTime = data.dueTime === undefined ? undefined : data.dueTime;
    // Time without a date is meaningless — drop it.
    if (dueDate === null) dueTime = null;
    if (dueDate === undefined && dueTime !== undefined && dueTime !== null) {
      dueTime = undefined;
    }
    return {
      title: data.title === undefined ? undefined : data.title?.trim() || null,
      description,
      color: data.color ?? ("butter" as const),
      priority: data.priority ?? ("none" as const),
      dueDate,
      dueTime,
      tags: data.tags ?? [],
      pinned: data.pinned ?? false,
      positionX: data.positionX ?? 0,
      positionY: data.positionY ?? 0,
      rank: data.rank,
    };
  })
  .superRefine((data, ctx) => {
    if (!data.description.trim() && !(data.title && data.title.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a title or note content",
        path: ["description"],
      });
    }
  });

export const updateItemSchema = z
  .object({
    title: z.string().max(120).nullable().optional(),
    description: z.string().max(10_000).optional(),
    content: z.string().max(10_000).optional(),
    color: stickyColorSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: civilDateSchema.optional(),
    dueTime: dueTimeSchema.optional(),
    tags: tagsInputSchema,
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    positionX: z.number().finite().optional(),
    positionY: z.number().finite().optional(),
    rank: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dueDate === null && data.dueTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Clear dueTime when clearing dueDate",
        path: ["dueTime"],
      });
    }
  });

export const listItemsQuerySchema = z.object({
  view: itemViewSchema.default("board"),
  q: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  tag: z
    .string()
    .max(40)
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined)),
  priority: z
    .union([prioritySchema, z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  sort: itemSortSchema.default("pinned"),
  hideCompleted: z
    .union([z.enum(["true", "false"]), z.literal("")])
    .optional()
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(250).default(50),
});

export const reorderItemsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export const completeItemSchema = z.object({
  autoArchive: z.boolean().nullable().optional(),
});

export const userPreferencesSchema = z.object({
  timezone: z
    .string()
    .min(1)
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
          return true;
        } catch {
          return false;
        }
      },
      { message: "timezone must be a valid IANA time zone" },
    )
    .optional(),
  weekStartsOn: weekStartSchema.optional(),
  autoArchiveOnComplete: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
  quietHoursStartMinute: z.number().int().min(0).max(1439).optional(),
  quietHoursEndMinute: z.number().int().min(0).max(1439).optional(),
  reminderFrequency: z.enum(["gentle", "standard", "intensive"]).optional(),
  reminderMorningMinute: z.number().int().min(0).max(1439).optional(),
  reminderEveningMinute: z.number().int().min(0).max(1439).optional(),
  browserNotificationsEnabled: z.boolean().optional(),
  displayName: z.string().max(120).nullable().optional(),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type StickyColor = z.infer<typeof stickyColorSchema>;
export type WeekStart = z.infer<typeof weekStartSchema>;
export type ItemView = z.infer<typeof itemViewSchema>;
export type ItemSort = z.infer<typeof itemSortSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export type ItemStatus =
  | "note"
  | "upcoming"
  | "tomorrow"
  | "today"
  | "overdue"
  | "done";
