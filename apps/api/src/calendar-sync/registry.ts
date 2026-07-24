import type { CalendarProviderId } from "@stickyflow/shared";
import type { Env } from "../config/env.js";
import type { CalendarProvider } from "./types.js";
import { GoogleCalendarProvider } from "./providers/google/googleProvider.js";

const providers = new Map<CalendarProviderId, CalendarProvider>();

export function initCalendarProviders(env: Env) {
  providers.clear();

  const google =
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_REDIRECT_URI
      ? new GoogleCalendarProvider({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
        })
      : new GoogleCalendarProvider(null);

  providers.set("google", google);
}

export function getCalendarProvider(
  id: CalendarProviderId,
): CalendarProvider | null {
  return providers.get(id) ?? null;
}

export function listCalendarProviders(): CalendarProvider[] {
  return [...providers.values()];
}

/** Test helper — swap a provider implementation without redesigning the registry. */
export function registerCalendarProvider(provider: CalendarProvider) {
  providers.set(provider.id, provider);
}
