const CACHE_VERSION = "3.5.0";
const CACHE_NAME = `appbey-shell-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  `/?v=${CACHE_VERSION}`,
  `/manifest.json?v=${CACHE_VERSION}`,
  `/css/styles.css?v=${CACHE_VERSION}`,
  `/js/components.js?v=${CACHE_VERSION}`,
  `/js/app.js?v=${CACHE_VERSION}`,
  `/js/api.js?v=${CACHE_VERSION}`,
  `/js/ws.js?v=${CACHE_VERSION}`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        STATIC_ASSETS.map((asset) => cache.add(asset).catch((error) => {
          console.warn("AppBey asset skipped during cache warmup:", asset, error);
        }))
      ))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("appbey-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) {
    return;
  }

  const isShell = event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  event.respondWith(
    fetch(event.request, { cache: isShell ? "no-store" : "default" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match(`/?v=${CACHE_VERSION}`);
        throw new Error("AppBey resource unavailable offline");
      }))
  );
});
