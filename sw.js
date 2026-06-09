/**
 * DUMMY SERVICE WORKER - DEVELOPMENT MODE
 * (Bypass Cache, Aman dari Crash Skema Non-HTTP)
 */

self.addEventListener('install', (e) => {
    self.skipWaiting(); 
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim()); 
});

self.addEventListener('fetch', (e) => {
    // FILTER UTAMA: Lewati request non-HTTP/HTTPS (seperti chrome-extension, data:, blob:)
    if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
        return; // Biarkan browser menangani langsung tanpa intervensi SW
    }

    e.respondWith(
        fetch(e.request).catch((err) => {
            // Fallback aman jika koneksi terputus total
            return new Response("Sedang offline...", {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        })
    );
});