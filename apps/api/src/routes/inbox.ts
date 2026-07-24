import { Router, type Request } from "express";
import { z } from "zod";
import { snoozeReminderSchema } from "@stickyflow/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import {
  dismissReminder,
  inboxSummary,
  listInbox,
  markAllInboxRead,
  markInboxRead,
  reminderBoard,
  snoozeReminder,
} from "../services/reminderService.js";

export const inboxRouter = Router();
export const remindersRouter = Router();

function auth(req: Request) {
  return (req as unknown as AuthedRequest).auth;
}

const listQuerySchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

inboxRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid inbox query");
    }
    const result = await listInbox(userId, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

inboxRouter.get("/summary", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    res.json(await inboxSummary(userId));
  } catch (err) {
    next(err);
  }
});

inboxRouter.post("/read-all", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    await markAllInboxRead(userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

inboxRouter.post("/:id/read", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    await markInboxRead(userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

remindersRouter.get("/board", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    res.json(await reminderBoard(userId));
  } catch (err) {
    next(err);
  }
});

remindersRouter.post("/:occurrenceId/snooze", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = snoozeReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid snooze payload");
    }
    const result = await snoozeReminder(
      userId,
      req.params.occurrenceId,
      parsed.data,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

remindersRouter.post("/:occurrenceId/dismiss", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    await dismissReminder(userId, req.params.occurrenceId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
