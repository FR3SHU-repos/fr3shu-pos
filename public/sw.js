const CACHE_NAME = "komola-pos-shell-v2";
const APP_SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/komola-logo.png",
  "/favicon.ico?v=komola-20260909",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/login") || url.pathname.startsWith("/register")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/pos") || caches.match("/offline"))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest" || url.pathname.endsWith(".png") || url.pathname.endsWith(".ico")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })),
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        data.urls.map((url) =>
          fetch(url, { credentials: "include" }).then((response) => {
            if (response.ok) return cache.put(url, response);
            return undefined;
          }),
        ),
      ),
    ),
  );
});
