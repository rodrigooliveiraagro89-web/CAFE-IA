/* global self, caches, fetch, Response, clients, URL */
// Service worker do AGRYN: app abre e funciona offline no talhão. Estratégia:
// - HTML/navegação: network-first (pega deploy novo; cai pro shell salvo offline).
// - Assets hasheados (/assets/, /brand/): cache-first + atualização em segundo
//   plano (abre instantâneo e offline).
// - Chamadas de API (Supabase/Render/Open-Meteo) são cross-origin → não passam
//   por aqui (nunca cacheamos dados autenticados/dinâmicos).
const CACHE = "agryn-shell-v6";
const BASE = "/CAFE-IA/";
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}brand/agryn-mark.svg`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && response.ok) {
    caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  const url = new URL(request.url);

  // Navegação (HTML): network-first → mantém o app atualizado; offline usa o shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(BASE, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(BASE)) || Response.error()),
    );
    return;
  }

  // Assets imutáveis (hash no nome): cache-first + revalidação em segundo plano.
  if (url.pathname.includes("/assets/") || url.pathname.includes("/brand/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            putInCache(request, response);
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Demais GET do próprio domínio (manifest, páginas legadas): network-first.
  event.respondWith(
    fetch(request)
      .then((response) => {
        putInCache(request, response);
        return response;
      })
      .catch(() => caches.match(request)),
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
