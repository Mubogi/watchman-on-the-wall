/**
 * Service worker: makes the game installable and fully playable offline.
 *
 * Strategy: precache the app shell on install, then serve cache-first with a
 * background refresh for same-origin GETs. The game has no API calls, so a
 * simple cache-first policy is both fastest and safest here.
 */

const VERSION = "watchman-v1.1.0";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/main.js",
  "./js/game.js",
  "./js/config.js",
  "./js/utils.js",
  "./js/audio.js",
  "./js/world.js",
  "./js/members.js",
  "./js/threats.js",
  "./js/renderer.js",
  "./js/ui.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Individual adds so one missing file cannot fail the whole install.
      await Promise.all(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so updates land, cache as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match(request)) || (await cache.match("./index.html"));
        }
      })()
    );
    return;
  }

  // Assets: cache first, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(request);
      if (hit) {
        fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
          })
          .catch(() => null);
        return hit;
      }
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});
