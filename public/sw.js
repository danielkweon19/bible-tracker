const UPDATE_PATHS = new Set([
  "/index.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/version.json"
]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    (event.request.mode === "navigate" || UPDATE_PATHS.has(url.pathname))
  ) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  }
});
