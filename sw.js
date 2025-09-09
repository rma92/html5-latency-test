// sw.js
const CACHE_NAME = 'latency-tester-v1';
const APP_SHELL = [
  './',                // serves index if your server rewrites "/" -> /index.html
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// On install, pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// Fetch: cache-first for same-origin GETs; always network for cross-origin targets
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only GET requests we control
  if (req.method !== 'GET') return;

  // Never intercept the remote ping hosts (cross-origin)
  if (url.origin !== self.location.origin) return;

  // Cache-first for our app shell/assets
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Optionally cache new same-origin GETs
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
      return res;
    } catch {
      // Optional: custom offline fallback page if you add one
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

