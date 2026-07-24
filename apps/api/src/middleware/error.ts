import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    console.error("[api-error]", {
      status: err.status,
      code: err.code,
      message: err.message,
    });
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  console.error("[api-error:unhandled]", err);
  const message =
    err instanceof Error ? err.message : "Something went wrong";
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message },
  });
}
