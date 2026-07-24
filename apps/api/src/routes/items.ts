import { Router, type Request } from "express";
import {
  completeItemSchema,
  createItemSchema,
  listItemsQuerySchema,
  reorderItemsSchema,
  updateItemSchema,
  normalizeTags,
} from "@stickyflow/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import * as itemService from "../services/itemService.js";

export const itemsRouter = Router();

function auth(req: Request) {
  return (req as unknown as AuthedRequest).auth;
}

/** Express query values can be string | string[] — flatten for Zod. */
function flattenQuery(query: Request["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null) continue;
    out[key] = String(raw);
  }
  return out;
}

function categorizeListError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "UNAUTHORIZED") return "authentication";
    if (err.code === "VALIDATION_ERROR") return "validation/zod";
    return `api:${err.code}`;
  }
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name ?? "");
    if (name.startsWith("Prisma")) return "prisma/database";
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("prisma") || msg.includes("database")) {
      return "prisma/database";
    }
    if (msg.includes("google") || msg.includes("calendar")) {
      return "google-integration";
    }
  }
  return "unknown";
}

itemsRouter.get("/", async (req, res, next) => {
  const { userId, clerkId } = auth(req);
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const query = flattenQuery(req.query);

  console.info("[items:list:request]", {
    method: "GET",
    url,
    query,
    userId,
    clerkId,
  });

  try {
    const parsed = listItemsQuerySchema.safeParse(query);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
        .join("; ");
      const message = `Invalid list query — ${details}`;
      console.error("[items:list:response]", {
        url,
        query,
        userId,
        status: 400,
        category: "validation/zod",
        body: { error: { code: "VALIDATION_ERROR", message } },
        zodIssues: parsed.error.issues,
      });
      throw new ApiError(400, "VALIDATION_ERROR", message);
    }

    const result = await itemService.listItems(userId, {
      view: parsed.data.view,
      q: parsed.data.q,
      tag: parsed.data.tag,
      priority: parsed.data.priority,
      sort: parsed.data.sort,
      hideCompleted: parsed.data.hideCompleted,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });

    console.info("[items:list:response]", {
      url,
      query: parsed.data,
      userId,
      status: 200,
      category: "ok",
      body: {
        count: result.data.length,
        nextCursor: result.nextCursor,
        sampleIds: result.data.slice(0, 3).map((item) => item.id),
      },
    });

    res.json(result);
  } catch (err) {
    const category = categorizeListError(err);
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[items:list:response]", {
      url,
      query,
      userId,
      status,
      category,
      body: {
        error: {
          code: err instanceof ApiError ? err.code : "INTERNAL_ERROR",
          message,
        },
      },
    });
    next(err);
  }
});

itemsRouter.post("/reorder", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = reorderItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid reorder payload");
    }

    const data = await itemService.reorderItems(userId, parsed.data.orderedIds);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid sticky note",
      );
    }

    const item = await itemService.createItem(userId, parsed.data);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get("/:id", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const item = await itemService.getItem(userId, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid sticky update");
    }

    const body = { ...parsed.data };
    if (body.content !== undefined && body.description === undefined) {
      body.description = body.content;
    }
    if (body.tags !== undefined) {
      body.tags = normalizeTags(body.tags);
    }

    const item = await itemService.updateItem(userId, req.params.id, body);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    await itemService.deleteItem(userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/:id/complete", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const parsed = completeItemSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid complete payload");
    }

    const item = await itemService.completeItem(
      userId,
      req.params.id,
      parsed.data.autoArchive,
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/:id/reopen", async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const item = await itemService.reopenItem(userId, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});
