"use client";

import { useEffect, useRef } from "react";
import { useAppShell } from "@/components/app-shell-context";
import { useInbox } from "@/hooks/use-reminders";
import { useMe } from "@/hooks/use-me";
import {
  formatNotificationDueBody,
  getNotificationPermission,
  showBrowserNotification,
} from "@/lib/browser-notifications";

/**
 * App-wide bridge from Reminder Engine inbox → browser Notification API.
 * Mount once in the authenticated app shell. Does not schedule; only delivers
 * when unread inbox entries appear (engine already decided WHEN).
 */
export function BrowserNotificationListener() {
  const { data: me } = useMe();
  const inbox = useInbox(true);
  const { requestOpenSticky } = useAppShell();
  const openRef = useRef(requestOpenSticky);
  openRef.current = requestOpenSticky;

  useEffect(() => {
    if (!me?.remindersEnabled || !me.browserNotificationsEnabled) return;
    if (getNotificationPermission() !== "granted") return;

    const entries = inbox.data?.data ?? [];

    for (const entry of entries) {
      if (entry.readAt || entry.dismissedAt) continue;

      const item = entry.item;
      // Never notify completed, archived, or missing stickies.
      if (!item || item.completedAt || item.archived) continue;

      const title = (item.title?.trim() || entry.title || "Untitled sticky").trim();
      const body = formatNotificationDueBody(item.dueDate, item.dueTime);

      showBrowserNotification({
        reminderId: entry.id,
        stickyId: entry.itemId,
        title,
        body,
        onClick: () => {
          openRef.current(entry.itemId);
        },
      });
    }
  }, [
    me?.remindersEnabled,
    me?.browserNotificationsEnabled,
    inbox.data?.data,
  ]);

  return null;
}
