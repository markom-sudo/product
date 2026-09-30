/* Service worker Marketing Elitech (satu file, dipakai di SETIAP repo)
 *
 * Salin file ini ke folder yang sama dengan index.html masing-masing aplikasi:
 *   markom-sudo.github.io/MarketingApp/sw.js      (shell)
 *   markom-sudo.github.io/product/sw.js           (Katalog)
 *   markom-sudo.github.io/Populasi/sw.js
 *   markom-sudo.github.io/PetaDistributor/sw.js
 * Setiap aplikasi mendaftarkan sw.js miliknya sendiri; cakupan (scope) otomatis
 * mengikuti lokasinya, dan nama cache dipisah per scope supaya tidak bentrok.
 * Naikkan VERSION untuk memaksa semua perangkat mengambil ulang file. */
const VERSION = 'v1';
const SCOPE = self.registration.scope;                       // mis. https://.../product/
const NS = 'elitech' + new URL(SCOPE).pathname.replace(/[^a-z0-9]+/gi, '_');
const APP_CACHE = NS + '-app-' + VERSION;
const IMG_CACHE = NS + '-img-' + VERSION;
const IMG_MAX = 250;                                          // batas jumlah gambar tersimpan

// Disimpan saat pertama kali online. Sisanya (ikon, manifest, script, dll)
// tersimpan otomatis begitu pertama dipakai.
const CORE_URLS = [SCOPE, SCOPE + 'index.html'];

const RUNTIME_HOSTS = [
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'code.jquery.com',
];
const IMG_HOST = /^lh\d+\.googleusercontent\.com$/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => Promise.all(CORE_URLS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith(NS + '-') && k !== APP_CACHE && k !== IMG_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Data Apps Script tidak disentuh (aplikasi sudah punya cache data sendiri).
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;

  if (IMG_HOST.test(url.hostname)) {
    e.respondWith(cacheFirstImage(req));
    return;
  }
  if (url.origin === self.location.origin || RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(e, req));
  }
});

// Tampilkan salinan tersimpan SEKETIKA, lalu perbarui di belakang layar.
// Versi baru muncul pada pembukaan berikutnya.
async function staleWhileRevalidate(e, req) {
  const isDoc = req.mode === 'navigate' || req.destination === 'iframe' || req.destination === 'document';
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(req, { ignoreSearch: isDoc });

  const update = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (cached) {
    e.waitUntil(update);
    return cached;
  }
  return (await update) || Response.error();
}

// Gambar: ambil dari cache dulu; kalau belum ada, unduh lalu simpan.
async function cacheFirstImage(req) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
      trimCache(cache, IMG_MAX);
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}
