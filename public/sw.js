// DELT service worker: phone notifications for urgent mail and close deadlines (#6),
// and keeping the app itself on the phone so it opens without a connection (#14).
// Mail data is never cached here: /api is always left to the network.
const CACHE = "delt-app-v2"; // bump to drop old copies (v2: wordmark icon)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

const keep = (key, res) => {
  if (res.ok && !res.redirected) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(key, copy));
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages: always try the network first; the last copy is only for when it fails.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => keep(url.pathname, res))
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }
  // Built files never change under the same name, so the saved copy is always right.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
  }
});

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
      icon: "/icons/192?v=2",
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
