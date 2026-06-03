const CACHE_NAME = 'pos-labarak-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap',
  'https://i.ibb.co.com/JW1FFbCz/1780229137561.png',
  'https://i.ibb.co.com/R4ZYj74K/1780229303550.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') return; // Jangan cache API call
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith('http')) cache.put(event.request.url, fetchRes.clone());
          return fetchRes;
        });
      });
    })
  );
});