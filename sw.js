const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `vibecines-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vibecines-runtime-${CACHE_VERSION}`;
const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/logo.png",
  "/icons/pwa-192x192.png",
  "/icons/pwa-512x512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ).then(() => self.clients.claim()),
    ),
  );
});

function isSameOrigin(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin;
  } catch {
    return false;
  }
}

async function putInRuntimeCache(request, response) {
  if (!response || !response.ok) return response;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => putInRuntimeCache(request, response))
    .catch(() => undefined);
  return cached || network || Response.error();
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putInRuntimeCache(request, response);
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(fallbackUrl)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!isSameOrigin(request)) return;
  if (request.headers.has("range") || request.destination === "video") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  const cacheableDestinations = new Set(["script", "style", "image", "font", "document"]);
  if (cacheableDestinations.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
