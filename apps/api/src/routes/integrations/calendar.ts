import { Router, type Request } from "express";
import {
  calendarProviderIdSchema,
  disconnectCalendarSchema,
  updateCalendarConnectionSchema,
} from "@stickyflow/shared";
import type { AuthedRequest } from "../../middleware/auth.js";
import { ApiError } from "../../middleware/error.js";
import type { Env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { decryptSecret, encryptSecret } from "../../calendar-sync/tokenCrypto.js";
import { getCalendarProvider } from "../../calendar-sync/registry.js";
import {
  GoogleCalendarProvider,
  GOOGLE_CALENDAR_SCOPES,
} from "../../calendar-sync/providers/google/googleProvider.js";
import { formatGoogleApiError } from "../../calendar-sync/providers/google/googleApiLog.js";
import {
  beginOAuth,
  completeOAuthCallback,
  disconnectProvider,
  forceSyncUser,
  getConnectionStatus,
  retryItemSync,
  unlinkItemFromCalendar,
  updateConnection,
} from "../../calendar-sync/index.js";

function auth(req: Request) {
  return (req as unknown as AuthedRequest).auth;
}

function parseProvider(raw: string) {
  const parsed = calendarProviderIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "UNKNOWN_PROVIDER", "Unknown calendar provider");
  }
  return parsed.data;
}

export function createCalendarIntegrationsRouter(env: Env) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      res.json(await getConnectionStatus(userId));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:provider/start", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      res.json(beginOAuth(userId, provider, env));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:provider", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      const status = await getConnectionStatus(userId);
      const row = status.providers.find((p) => p.id === provider);
      if (!row) {
        throw new ApiError(404, "UNKNOWN_PROVIDER", "Unknown calendar provider");
      }
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:provider", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      const parsed = updateCalendarConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid connection update");
      }
      const updated = await updateConnection(userId, provider, parsed.data);
      res.json({
        id: updated.id,
        provider: updated.provider,
        syncEnabled: updated.syncEnabled,
        status: updated.status,
        calendarId: updated.calendarId,
        onRemovePolicy: updated.onRemovePolicy,
        lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
        lastError: updated.lastError,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:provider", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      const parsed = disconnectCalendarSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid disconnect payload");
      }
      await disconnectProvider(userId, provider, parsed.data.mode, env);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post("/:provider/sync", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      const report = await forceSyncUser(userId, provider, env);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:provider/retry/:itemId", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      parseProvider(req.params.provider);
      const results = await retryItemSync(userId, req.params.itemId, env);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:provider/unlink/:itemId", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const provider = parseProvider(req.params.provider);
      const results = await unlinkItemFromCalendar(
        userId,
        req.params.itemId,
        provider,
        env,
      );
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** Docs-compatible Google routes + public OAuth callback. */
export function createGoogleIntegrationsRouter(env: Env) {
  const router = Router();

  router.get("/start", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      res.json(beginOAuth(userId, "google", env));
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const status = await getConnectionStatus(userId);
      res.json(status.providers.find((p) => p.id === "google") ?? null);
    } catch (err) {
      next(err);
    }
  });

  router.get("/calendars", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const key = env.TOKEN_ENCRYPTION_KEY;
      if (!key) {
        throw new ApiError(
          503,
          "CALENDAR_SYNC_MISCONFIGURED",
          "TOKEN_ENCRYPTION_KEY missing",
        );
      }

      const provider = getCalendarProvider("google");
      if (!(provider instanceof GoogleCalendarProvider) || !provider.isConfigured()) {
        throw new ApiError(
          503,
          "PROVIDER_NOT_CONFIGURED",
          "Google provider unavailable",
        );
      }

      const conn = await prisma.calendarConnection.findUnique({
        where: { userId_provider: { userId, provider: "google" } },
      });
      if (!conn) {
        throw new ApiError(
          404,
          "NOT_CONNECTED",
          "Google Calendar is not connected",
        );
      }

      let accessToken: string;
      const stillValid =
        conn.accessTokenEnc &&
        conn.expiresAt &&
        conn.expiresAt.getTime() > Date.now() + 60_000;

      if (stillValid && conn.accessTokenEnc) {
        accessToken = decryptSecret(conn.accessTokenEnc, key);
      } else {
        const refreshToken = decryptSecret(conn.refreshTokenEnc, key);
        const refreshed = await provider.refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        await prisma.calendarConnection.update({
          where: { id: conn.id },
          data: {
            accessTokenEnc: encryptSecret(refreshed.accessToken, key),
            expiresAt: refreshed.expiresAt ?? null,
            refreshTokenEnc: refreshed.refreshToken
              ? encryptSecret(refreshed.refreshToken, key)
              : conn.refreshTokenEnc,
            status: "connected",
            lastError: null,
          },
        });
      }

      // Validate token + scopes (throws with full Google body on failure).
      const tokenInfo = await provider.introspectAccessToken(accessToken);
      provider.assertCalendarScopes(tokenInfo.scopes);

      const primary = await provider.verifyPrimaryCalendar(accessToken);
      const calendars = await provider.listCalendars(accessToken);

      res.json({
        calendarId: conn.calendarId || "primary",
        primary,
        calendars,
        token: {
          active: tokenInfo.active,
          expiresAt: tokenInfo.expiresAt?.toISOString() ?? null,
          email: tokenInfo.email,
          scopes: tokenInfo.scopes,
        },
        expectedScopes: [...GOOGLE_CALENDAR_SCOPES],
      });
    } catch (err) {
      if (err instanceof ApiError) {
        next(err);
        return;
      }
      const message =
        err instanceof Error ? err.message : formatGoogleApiError(err);
      console.error("[google-calendar:/calendars]", message);
      next(new ApiError(502, "GOOGLE_API_ERROR", message));
    }
  });


  router.patch("/", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const parsed = updateCalendarConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid connection update");
      }
      const updated = await updateConnection(userId, "google", parsed.data);
      res.json({
        id: updated.id,
        provider: updated.provider,
        syncEnabled: updated.syncEnabled,
        status: updated.status,
        calendarId: updated.calendarId,
        onRemovePolicy: updated.onRemovePolicy,
        lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
        lastError: updated.lastError,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      const parsed = disconnectCalendarSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid disconnect payload");
      }
      await disconnectProvider(userId, "google", parsed.data.mode, env);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post("/sync", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      res.json(await forceSyncUser(userId, "google", env));
    } catch (err) {
      next(err);
    }
  });

  router.post("/retry/:itemId", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      res.json({
        results: await retryItemSync(userId, req.params.itemId, env),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/unlink/:itemId", async (req, res, next) => {
    try {
      const { userId } = auth(req);
      res.json({
        results: await unlinkItemFromCalendar(
          userId,
          req.params.itemId,
          "google",
          env,
        ),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** Public OAuth callback (no Clerk) — verifies signed state. */
export function createGoogleOAuthCallbackRouter(env: Env) {
  const router = Router();

  router.get("/callback", async (req, res) => {
    const redirectBase = env.CORS_ORIGIN.replace(/\/$/, "");

    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const oauthError =
        typeof req.query.error === "string" ? req.query.error : "";
      const oauthErrorDesc =
        typeof req.query.error_description === "string"
          ? req.query.error_description
          : "";

      if (oauthError) {
        const reason = oauthErrorDesc
          ? `${oauthError}: ${oauthErrorDesc}`
          : oauthError;
        console.error("[google-calendar:oauth-callback] provider error", {
          oauthError,
          oauthErrorDesc,
        });
        res.redirect(
          `${redirectBase}/app?calendar_sync=error&reason=${encodeURIComponent(reason)}`,
        );
        return;
      }

      if (!code || !state) {
        res.redirect(
          `${redirectBase}/app?calendar_sync=error&reason=missing_code`,
        );
        return;
      }

      const { userId, provider } = await completeOAuthCallback({
        code,
        state,
        env,
      });

      void forceSyncUser(userId, provider, env)
        .then((report) => {
          console.info("[google-calendar:oauth-callback] initial sync", report);
          if (report.failed > 0) {
            console.error(
              "[google-calendar:oauth-callback] initial sync failures",
              report.errors,
            );
          }
        })
        .catch((error) => {
          console.error(
            "[calendar-sync] initial sync after OAuth failed",
            error instanceof Error ? error.message : error,
          );
        });

      res.redirect(`${redirectBase}/app?calendar_sync=connected`);
    } catch (err) {
      const reason =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "oauth_failed";
      console.error("[google-calendar:oauth-callback] failed", reason);
      res.redirect(
        `${redirectBase}/app?calendar_sync=error&reason=${encodeURIComponent(reason.slice(0, 500))}`,
      );
    }
  });

  return router;
}
