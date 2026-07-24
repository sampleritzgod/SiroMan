"use client";

import { useAuth } from "@clerk/nextjs";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Duck-type check — survives Turbopack HMR where `instanceof` can break. */
export function isApiClientError(error: unknown): error is ApiClientError {
  if (error instanceof ApiClientError) return true;
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  return (
    e.name === "ApiClientError" &&
    typeof e.status === "number" &&
    typeof e.code === "string" &&
    typeof e.message === "string"
  );
}

export function formatApiError(
  error: unknown,
  fallback = "Request failed",
): string {
  if (isApiClientError(error)) {
    return `${error.code} (${error.status}): ${error.message}`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useApiClient() {
  const { getToken, userId } = useAuth();

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    if (!token) {
      throw new ApiClientError(401, "UNAUTHORIZED", "Not signed in");
    }

    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) {
      throw new ApiClientError(500, "CONFIG", "NEXT_PUBLIC_API_URL is not set");
    }

    const url = `${base}${path}`;
    let query: Record<string, string> = {};
    try {
      const parsed = new URL(url);
      query = Object.fromEntries(parsed.searchParams.entries());
    } catch {
      query = {};
    }

    console.info("[api:request]", {
      method: (init?.method ?? "GET").toUpperCase(),
      url,
      query,
      userId: userId ?? null,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? `Network error calling ${url}: ${err.message}`
          : `Network error calling ${url}`;
      console.error("[api:response]", {
        url,
        query,
        userId: userId ?? null,
        status: 0,
        body: { error: { code: "NETWORK_ERROR", message } },
      });
      throw new ApiClientError(0, "NETWORK_ERROR", message);
    }

    if (res.status === 204) {
      console.info("[api:response]", {
        url,
        query,
        userId: userId ?? null,
        status: 204,
        body: null,
      });
      return undefined as T;
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const code = body?.error?.code ?? "REQUEST_FAILED";
      const message = body?.error?.message ?? `Request failed (${res.status})`;
      console.error("[api:response]", {
        url,
        query,
        userId: userId ?? null,
        status: res.status,
        body,
      });
      throw new ApiClientError(res.status, code, message);
    }

    console.info("[api:response]", {
      url,
      query,
      userId: userId ?? null,
      status: res.status,
      body:
        body && typeof body === "object" && "data" in body && Array.isArray(body.data)
          ? { count: body.data.length, nextCursor: body.nextCursor ?? null }
          : body && typeof body === "object" && "id" in body
            ? { id: body.id }
            : { ok: true },
    });

    return body as T;
  }

  return { api };
}
