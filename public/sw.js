const CACHE_NAME = "komola-pos-shell-v3";
const APP_SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
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
  // Never cache API responses, authentication flows, account routes, or
  // personalized POS HTML. A shared device must not replay one seller's page
  // to another seller after logout or account switching.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/pos") ||
    url.pathname.startsWith("/products") ||
    url.pathname.startsWith("/stock") ||
    url.pathname.startsWith("/settings") ||
    url.pathname.startsWith("/register-sessions") ||
    url.pathname.startsWith("/buyer") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/seller")
  ) {
    if (request.mode !== "navigate") return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/offline")),
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
