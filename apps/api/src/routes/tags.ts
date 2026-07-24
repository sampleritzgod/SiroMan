import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { listTags } from "../services/itemService.js";

export const tagsRouter = Router();

tagsRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = (req as AuthedRequest).auth;
    const result = await listTags(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
