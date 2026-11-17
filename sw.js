const CACHE_PREFIX = "tripboost-";
const CACHE_NAME = `${CACHE_PREFIX}static-v2`;
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./config.js"];
const APP_SCOPE = new URL(self.registration.scope);
const APP_PATHS = new Set(APP_FILES.map((file) => new URL(file, APP_SCOPE).pathname));
const INDEX_URL = new URL("./index.html", APP_SCOPE).href;

function isWithinAppScope(url) {
  return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_SCOPE.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isWithinAppScope(url)) return;

  // Navigation is network-first so users receive the newest app shell whenever online.
  // Only navigation requests may fall back to index.html while offline.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(INDEX_URL);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  // Cache only the app shell and its explicitly listed static files. Do not
  // intercept API responses or unrelated same-origin applications.
  if (!APP_PATHS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
