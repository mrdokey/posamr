/**
 * DUMMY SERVICE WORKER - DEVELOPMENT MODE
 * (Syarat Mutlak PWA agar tombol install aktif, tanpa mengunci cache file)
 */

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Langsung aktifkan versi baru tanpa antre
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim()); // Klaim kendali seluruh halaman aktif
});

self.addEventListener('fetch', (e) => {
    // SINKRONISASI MURNI: Wajib berikan respon agar Chrome memverifikasi ini sebagai PWA sah,
    // tetapi tetap mengambil data asli 100% dari server tanpa cache.
    e.respondWith(
        fetch(e.request).catch(() => {
            // Fallback jika benar-benar offline (mencegah error merah di konsol)
            return new Response("Sedang offline...");
        })
    );
});