// DELT service worker: shows phone notifications for urgent mail and close deadlines.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "DELT", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "DELT", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/192",
      badge: "/icons/badge",
      data: { url: data.url || "/#/inbox" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/#/inbox", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin)) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
