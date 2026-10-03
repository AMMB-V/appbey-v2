const CACHE_VERSION = "3.8.1";
const CACHE_NAME = `appbey-shell-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  `/?v=${CACHE_VERSION}`,
  `/manifest.json?v=${CACHE_VERSION}`,
  `/css/styles.css?v=${CACHE_VERSION}`,
  `/config.js?v=${CACHE_VERSION}`,
  `/js/components.js?v=${CACHE_VERSION}`,
  `/js/app.js?v=${CACHE_VERSION}`,
  `/js/api.js?v=${CACHE_VERSION}`,
  `/js/ws.js?v=${CACHE_VERSION}`,
  `/js/views/home.js?v=${CACHE_VERSION}`,
  `/js/views/tournaments.js?v=${CACHE_VERSION}`,
  `/js/views/tournament_detail.js?v=${CACHE_VERSION}`,
  `/js/views/referee_pad.js?v=${CACHE_VERSION}`,
  `/js/views/stadium_display.js?v=${CACHE_VERSION}`,
  `/js/views/deck_builder.js?v=${CACHE_VERSION}`,
  `/js/views/tier_list.js?v=${CACHE_VERSION}`,
  `/js/views/rankings.js?v=${CACHE_VERSION}`,
  `/js/views/hall_of_fame.js?v=${CACHE_VERSION}`,
  `/js/views/social.js?v=${CACHE_VERSION}`,
  `/js/views/profile.js?v=${CACHE_VERSION}`,
  `/js/views/admin_users.js?v=${CACHE_VERSION}`,
  `/js/views/auth.js?v=${CACHE_VERSION}`
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
          return caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, response.clone())
              .catch((error) => console.warn("AppBey asset could not be cached:", url.pathname, error))
          ).then(() => response);
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
