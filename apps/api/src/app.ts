import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Env } from "./config/env.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { prisma } from "./lib/prisma.js";
import { meRouter } from "./routes/me.js";
import { itemsRouter } from "./routes/items.js";
import { tagsRouter } from "./routes/tags.js";
import { inboxRouter, remindersRouter } from "./routes/inbox.js";
import {
  createCalendarIntegrationsRouter,
  createGoogleIntegrationsRouter,
  createGoogleOAuthCallbackRouter,
} from "./routes/integrations/calendar.js";
import {
  configureCalendarSync,
  initCalendarProviders,
} from "./calendar-sync/index.js";

export function createApp(env: Env) {
  initCalendarProviders(env);
  configureCalendarSync(env);

  const app = express();
  const requireAuth = createAuthMiddleware(env);

  // API is consumed cross-origin from the Next.js app — allow CORP reads.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: true, version: "0.1.0" });
    } catch {
      res.status(503).json({ ok: false, db: false, version: "0.1.0" });
    }
  });

  app.use("/v1/me", requireAuth, meRouter);
  app.use("/v1/items", requireAuth, itemsRouter);
  app.use("/v1/tags", requireAuth, tagsRouter);
  app.use("/v1/inbox", requireAuth, inboxRouter);
  app.use("/v1/reminders", requireAuth, remindersRouter);

  // Calendar sync (provider-agnostic + Google-specific docs paths)
  app.use(
    "/v1/integrations/calendar",
    requireAuth,
    createCalendarIntegrationsRouter(env),
  );
  // OAuth callback must be public (Google redirects the browser) — mount before auth.
  app.use("/v1/integrations/google", createGoogleOAuthCallbackRouter(env));
  app.use(
    "/v1/integrations/google",
    requireAuth,
    createGoogleIntegrationsRouter(env),
  );

  app.use(errorHandler);
  return app;
}
