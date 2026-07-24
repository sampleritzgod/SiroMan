/**
 * Google Calendar API request/response logging + error formatting.
 * Never suppresses Google errors — always surfaces the full API payload.
 */

export type GoogleApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{
      domain?: string;
      reason?: string;
      message?: string;
      location?: string;
      locationType?: string;
    }>;
  };
};

export function formatGoogleApiError(error: unknown): string {
  const gaxios = error as {
    code?: number | string;
    message?: string;
    response?: {
      status?: number;
      statusText?: string;
      data?: GoogleApiErrorBody | unknown;
      config?: {
        method?: string;
        url?: string;
        params?: Record<string, unknown>;
      };
    };
    errors?: Array<{ message?: string; reason?: string }>;
    config?: {
      method?: string;
      url?: string;
      params?: Record<string, unknown>;
    };
  };

  const status =
    gaxios.response?.status ??
    (typeof gaxios.code === "number" ? gaxios.code : undefined);
  const data = gaxios.response?.data;
  const googleError =
    data && typeof data === "object" && "error" in data
      ? (data as GoogleApiErrorBody).error
      : undefined;

  const parts: string[] = [];
  if (status != null) parts.push(`HTTP ${status}`);
  if (googleError?.message) parts.push(googleError.message);
  else if (gaxios.message) parts.push(gaxios.message);

  if (googleError?.errors?.length) {
    for (const entry of googleError.errors) {
      const bit = [entry.reason, entry.message, entry.location]
        .filter(Boolean)
        .join(": ");
      if (bit) parts.push(bit);
    }
  }

  const method =
    gaxios.response?.config?.method ?? gaxios.config?.method ?? "";
  const url = gaxios.response?.config?.url ?? gaxios.config?.url ?? "";
  if (method || url) {
    parts.push(`${String(method).toUpperCase()} ${url}`.trim());
  }

  // Always include raw Google body for debugging (never suppress).
  if (data !== undefined) {
    try {
      parts.push(`body=${JSON.stringify(data)}`);
    } catch {
      parts.push("body=[unserializable]");
    }
  }

  return parts.join(" | ").slice(0, 4000);
}

type LoggableRequest = {
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, unknown>;
};

type LoggableResponse = {
  status?: number;
  statusText?: string;
  data?: unknown;
  config?: LoggableRequest;
};

function redactAuthHeaders(headers: Record<string, unknown> | undefined) {
  if (!headers) return undefined;
  const next: Record<string, unknown> = { ...headers };
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === "authorization") {
      const value = String(next[key] ?? "");
      next[key] = value.startsWith("Bearer ")
        ? `Bearer ${value.slice(7, 15)}…(redacted)`
        : "[redacted]";
    }
  }
  return next;
}

export function logGoogleApiRequest(label: string, req: LoggableRequest) {
  console.info("[google-calendar:request]", {
    label,
    method: (req.method ?? "GET").toUpperCase(),
    url: req.url,
    query: req.params ?? {},
    body: req.data ?? null,
    headers: redactAuthHeaders(req.headers as Record<string, unknown>),
  });
}

export function logGoogleApiResponse(label: string, res: LoggableResponse) {
  console.info("[google-calendar:response]", {
    label,
    method: (res.config?.method ?? "GET").toUpperCase(),
    url: res.config?.url,
    query: res.config?.params ?? {},
    status: res.status,
    statusText: res.statusText,
    body: res.data,
  });
}

export function logGoogleApiError(label: string, error: unknown) {
  const formatted = formatGoogleApiError(error);
  console.error("[google-calendar:error]", {
    label,
    formatted,
    raw: error,
  });
  return formatted;
}

/**
 * Attach gaxios request/response interceptors to an OAuth2 client
 * so every Calendar API call is logged with method/url/query/status/body.
 */
export function attachGoogleApiLogging(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authClient: { request: (...args: any[]) => any },
  labelPrefix = "calendar",
) {
  const original = authClient.request.bind(authClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authClient.request = async (opts: any, ...rest: any[]) => {
    const label = `${labelPrefix}:${opts?.url ?? opts?.path ?? "request"}`;
    logGoogleApiRequest(label, {
      method: opts?.method,
      url: opts?.url,
      params: opts?.params,
      data: opts?.data ?? opts?.body,
      headers: opts?.headers,
    });
    try {
      const res = await original(opts, ...rest);
      logGoogleApiResponse(label, {
        status: res?.status,
        statusText: res?.statusText,
        data: res?.data,
        config: {
          method: opts?.method,
          url: opts?.url ?? res?.config?.url,
          params: opts?.params ?? res?.config?.params,
        },
      });
      return res;
    } catch (error) {
      logGoogleApiError(label, error);
      throw error;
    }
  };
}
