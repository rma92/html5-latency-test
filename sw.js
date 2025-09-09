// sw.js (place it next to your index.html, use ./ paths if in a subfolder)
const CACHE_NAME = 'latency-tester-v3';
const APP_SHELL = [
  './',                          // the subdirectory itself
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches + claim clients + disable nav preload (avoids parallel network nav)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.disable();
    }
    await self.clients.claim();
  })());
});

// Fetch: offline-first for navigations and same-origin assets,
// never touches cross-origin (your test targets) — those bypass SW
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // 1) Navigations: always serve cached index.html (offline-first)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { ignoreSearch: true })
        .then(cached => cached || fetch(req)) // fallback to network if first-ever load
    );
    return;
  }

  // 2) Same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;                 // <-- no network hit if cached
      try {
        const res = await fetch(req);            // first time only
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      } catch {
        // Optional: serve index or a small fallback if an uncached asset is requested offline
        return caches.match('./index.html', { ignoreSearch: true });
      }
    })());
    return;
  }

  // 3) Cross-origin (e.g., the ping targets): don't intercept — let network behave normally
});

