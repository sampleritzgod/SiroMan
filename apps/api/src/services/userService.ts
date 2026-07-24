import type { User } from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    weekStartsOn: user.weekStartsOn,
    autoArchiveOnComplete: user.autoArchiveOnComplete,
    onboardingCompleted: user.onboardingCompleted,
    remindersEnabled: user.remindersEnabled,
    quietHoursStartMinute: user.quietHoursStartMinute,
    quietHoursEndMinute: user.quietHoursEndMinute,
    reminderFrequency: user.reminderFrequency,
    reminderMorningMinute: user.reminderMorningMinute,
    reminderEveningMinute: user.reminderEveningMinute,
    browserNotificationsEnabled: user.browserNotificationsEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}
