/* Minimal notification service worker — delivery + click only. No scheduling. */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const stickyId =
    event.notification.data && typeof event.notification.data.stickyId === "string"
      ? event.notification.data.stickyId
      : null;

  const targetUrl = stickyId
    ? `/app?sticky=${encodeURIComponent(stickyId)}`
    : "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of all) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith("/app") && "focus" in client) {
            if (stickyId) {
              client.postMessage({ type: "OPEN_STICKY", stickyId });
            }
            return client.focus();
          }
        } catch {
          // ignore bad client urls
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
