import { Router } from "express";
import { userPreferencesSchema } from "@stickyflow/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { prisma } from "../lib/prisma.js";
import { serializeUser } from "../services/userService.js";
import { rebuildRemindersForUser } from "../services/reminderService.js";

export const meRouter = Router();

meRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = (req as AuthedRequest).auth;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

meRouter.patch("/", async (req, res, next) => {
  try {
    const { userId } = (req as AuthedRequest).auth;
    const parsed = userPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid preferences");
    }

    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const user = await prisma.user.update({
      where: { id: userId },
      data: parsed.data,
    });

    const shouldRebuild =
      parsed.data.timezone !== undefined ||
      parsed.data.remindersEnabled !== undefined ||
      parsed.data.reminderFrequency !== undefined ||
      parsed.data.reminderMorningMinute !== undefined ||
      parsed.data.reminderEveningMinute !== undefined ||
      parsed.data.quietHoursStartMinute !== undefined ||
      parsed.data.quietHoursEndMinute !== undefined;

    if (
      shouldRebuild &&
      (before.timezone !== user.timezone ||
        before.remindersEnabled !== user.remindersEnabled ||
        before.reminderFrequency !== user.reminderFrequency ||
        before.reminderMorningMinute !== user.reminderMorningMinute ||
        before.reminderEveningMinute !== user.reminderEveningMinute ||
        before.quietHoursStartMinute !== user.quietHoursStartMinute ||
        before.quietHoursEndMinute !== user.quietHoursEndMinute)
    ) {
      void rebuildRemindersForUser(userId).catch((error) => {
        console.error("[reminders] rebuild after prefs change failed", error);
      });
    }

    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});
