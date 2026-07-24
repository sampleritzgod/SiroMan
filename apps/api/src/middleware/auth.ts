import { createClerkClient, verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "./error.js";

export type AuthedRequest = Request & {
  auth: {
    clerkId: string;
    userId: string;
  };
};

export function createAuthMiddleware(env: Env) {
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token");
      }

      const token = header.slice("Bearer ".length).trim();
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      const clerkId = payload.sub;
      if (!clerkId) {
        throw new ApiError(401, "UNAUTHORIZED", "Invalid token subject");
      }

      let user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        const clerkUser = await clerk.users.getUser(clerkId);
        const email =
          clerkUser.emailAddresses.find(
            (e) => e.id === clerkUser.primaryEmailAddressId,
          )?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          null;
        const displayName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          clerkUser.username ||
          null;

        user = await prisma.user.create({
          data: {
            clerkId,
            email,
            displayName,
          },
        });
      }

      (req as AuthedRequest).auth = { clerkId, userId: user.id };
      next();
    } catch (err) {
      if (err instanceof ApiError) return next(err);
      return next(new ApiError(401, "UNAUTHORIZED", "Invalid or expired token"));
    }
  };
}
