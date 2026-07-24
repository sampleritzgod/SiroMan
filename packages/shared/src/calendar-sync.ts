import { z } from "zod";

export const calendarProviderIdSchema = z.enum(["google"]);
export type CalendarProviderId = z.infer<typeof calendarProviderIdSchema>;

export const calendarDisconnectModeSchema = z.enum(["leave", "delete"]);
export type CalendarDisconnectMode = z.infer<typeof calendarDisconnectModeSchema>;

export const calendarRemovePolicySchema = z.enum(["cancel", "delete"]);
export type CalendarRemovePolicy = z.infer<typeof calendarRemovePolicySchema>;

export const disconnectCalendarSchema = z.object({
  mode: calendarDisconnectModeSchema.default("leave"),
});

export const updateCalendarConnectionSchema = z.object({
  syncEnabled: z.boolean().optional(),
  calendarId: z.string().min(1).max(256).optional(),
  onRemovePolicy: calendarRemovePolicySchema.optional(),
});

export type DisconnectCalendarInput = z.infer<typeof disconnectCalendarSchema>;
export type UpdateCalendarConnectionInput = z.infer<
  typeof updateCalendarConnectionSchema
>;
