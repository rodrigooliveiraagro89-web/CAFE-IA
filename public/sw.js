/* global self, caches, fetch, Response, clients */
const CACHE = "agryn-shell-v5";
const BASE = "/CAFE-IA/";
const SHELL = [BASE, `${BASE}landing.html`, `${BASE}manifest.webmanifest`, `${BASE}brand/agryn-mark.svg`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match(BASE) : Response.error())),
  );
});

// --- Web Push: alertas do cafezal chegam mesmo com o app fechado ----------
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "AGRYN", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "AGRYN";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "agryn-alerta",
    icon: `${BASE}brand/agryn-mark.svg`,
    badge: `${BASE}brand/agryn-mark.svg`,
    data: { url: payload.url || BASE },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    }),
  );
});
