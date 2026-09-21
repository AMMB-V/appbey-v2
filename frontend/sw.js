const CACHE_NAME = "appbey-static-v4";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/css/styles.css",
  "/js/components.js",
  "/js/app.js",
  "/js/api.js",
  "/js/ws.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((error) => console.warn("AppBey cache warmup skipped:", error))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) {
    return;
  }

  // HTML and JavaScript must always be refreshed first. This prevents an old
  // service worker from keeping a broken SPA shell after a Render deployment.
  const isApplicationCode = url.pathname === "/" ||
    url.pathname.endsWith(".html") || url.pathname.endsWith(".js");

  if (isApplicationCode) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
