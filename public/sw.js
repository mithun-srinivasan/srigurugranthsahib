/**
 * public/sw.js
 * ---------------------------------------------------------------------------
 * Service worker providing offline support (feature 1).
 *
 * Strategy:
 *   - App shell (navigation + entry documents) → **precached on install** so
 *     the home page, Nitnem list and key routes open offline immediately.
 *   - Navigation requests → **network-first with runtime cache fallback** so
 *     fresh HTML is served when online while every visited route keeps
 *     working offline; unvisited routes offline fall back to the home page.
 *   - Static Next.js build assets & hashed chunks → **cache-first forever**
 *     (immutable, content-hashed).
 *   - Font & image files → **stale-while-revalidate** for freshness.
 *   - Same-origin JSON data (e.g. `/data/sgpc-<year>.json` year calendars) →
 *     **stale-while-revalidate** so the SGPC auto-update works offline after
 *     the first visit.
 *   - All other / cross-origin requests (e.g. BaniDB API from the client) are
 *     left untouched so nothing is cached accidentally.
 *   - `notificationclick` focuses the app when a Hukamnama reminder is tapped.
 *
 * The version string in `CACHE` busts the cache whenever the build changes.
 */

const CACHE = "sggs-reader-v6";
const SHELL_CACHE = `${CACHE}-shell`;

/** Entry documents precached on install for instant offline opens. */
const SHELL_URLS = ["/", "/search", "/bookmarks", "/ang/1", "/learn", "/nitnem", "/calendar"];

/** Maximum number of entries in the runtime HTML cache. Oldest entries are
 *  evicted first (LRU) when the cap is exceeded. */
const RUNTIME_MAX = 100;

/** Tracks insertion order for LRU eviction (URL → timestamp). Updated on
 *  every `cache.put` to this cache. Keys are evicted from `RUNTIME_MAX` down. */
const runtimeOrder = [];

/** Evicts the oldest cached entry when the runtime cache exceeds its cap.
 *  Keeps the cache bounded so long sessions don't grow unboundedly. */
function enforceRuntimeLimit(cache) {
  return cache.keys().then((keys) => {
    while (keys.length > RUNTIME_MAX) {
      const oldest = keys.shift();
      if (oldest) {
        cache.delete(oldest);
        const idx = runtimeOrder.indexOf(oldest);
        if (idx >= 0) runtimeOrder.splice(idx, 1);
      }
    }
  });
}

/** Records a cache insertion for LRU tracking. */
function trackCacheInsertion(url) {
  runtimeOrder.push(url);
  while (runtimeOrder.length > RUNTIME_MAX) {
    runtimeOrder.shift();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => {
        // Add each shell URL individually so one failed URL doesn't abort
        // precaching of all the others.
        return Promise.allSettled(
          SHELL_URLS.map((url) => cache.add(url).catch(() => {})),
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sggs-reader-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Returns the cached response for a request, or fetches it over the network
 * and stores it in the runtime cache when the request is GET-only.
 * Offline with no cached copy → falls back to the cached home page so the
 * app still opens instead of showing a browser error.
 */
function cachePutWithLimit(cache, request, response) {
  const copy = response.clone();
  return cache.put(request, copy).then(() => {
    trackCacheInsertion(request.url);
    return enforceRuntimeLimit(cache);
  });
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cachePutWithLimit(cache, request, response);
    return response;
  } catch {
    return (
      (await cache.match(request)) || (await cache.match("/")) || Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  // Navigation requests: network-first, cache-fallback so fresh HTML is served
  // when online while still allowing offline navigation to visited routes.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Immutable hashed build assets: cache-first.
  if (/\/_next\/static\/.*\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cachePutWithLimit(cache, request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Public images & fonts: stale-while-revalidate.
  if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cachePutWithLimit(cache, request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Same-origin JSON data files (SGPC year calendars): stale-while-revalidate
  // so month navigation and Gurpurabs keep working offline after one visit.
  if (url.pathname.startsWith("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cachePutWithLimit(cache, request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else follows the network untouched.
});

// -- Hukamnama reminder taps -------------------------------------------------
// Focusing beats navigating: the reminder's `data.url` is the Home page,
// which already hosts the Hukamnama card.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const win of windows) {
          if ("focus" in win) return win.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});