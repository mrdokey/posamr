/**
 * DUMMY SERVICE WORKER - DEVELOPMENT MODE
 * (Syarat PWA agar tombol install aktif, tetapi tidak mengunci cache file)
 */

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Langsung aktifkan versi baru
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim()); // Klaim semua tab aktif
});

self.addEventListener('fetch', (e) => {
    // PASS-THROUGH: Tidak menyimpan cache apa pun. 
    // Browser akan selalu mendownload file asli/terbaru dari server.
});