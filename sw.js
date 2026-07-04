// --- REVISI sw.js (Strategi Stale-While-Revalidate untuk PWA Offline) ---
const CACHE_NAME = 'amr-cache-v2.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './pos.html',
  './order.html',
  './admin.html',
  './absen.js',
  './config.js',
  './pos-core.js',
  './pos-checkout.js',
  './pos-printer.js',
  './waiter.js',
  './manifest.json',
  './manifest-pos.json',
  './manifest-admin.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});