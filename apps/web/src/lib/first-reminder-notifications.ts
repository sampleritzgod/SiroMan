"use client";

import {
  ensureNotificationServiceWorker,
  maybePromptOnFirstReminder,
} from "@/lib/browser-notifications";
import type { Me } from "@/lib/types";
import type { QueryClient } from "@tanstack/react-query";

/**
 * After the user creates/updates a dated sticky, optionally request browser
 * notification permission (never on page load — only on this intentional action).
 */
export async function maybeEnableNotificationsForFirstReminder(opts: {
  dueDate: string | null | undefined;
  me: Me | undefined;
  patchMe: (patch: { browserNotificationsEnabled: boolean }) => Promise<Me>;
  queryClient?: QueryClient;
}): Promise<void> {
  if (!opts.dueDate) return;
  if (opts.me?.browserNotificationsEnabled) return;

  const result = await maybePromptOnFirstReminder({
    hasDueDate: true,
    alreadyEnabled: false,
  });

  if (result !== "granted") return;

  void ensureNotificationServiceWorker();

  try {
    const updated = await opts.patchMe({ browserNotificationsEnabled: true });
    opts.queryClient?.setQueryData(["me"], updated);
  } catch {
    // Preference save failed — browser permission may still be granted.
  }
}
