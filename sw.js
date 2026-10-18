/* Service worker Kalkulator Optik
   Strategi: simpan semua file saat pertama dibuka, lalu selalu tampilkan versi
   tersimpan (cepat & offline) sambil diam-diam mengecek versi baru di latar belakang.
   Kalau Anda mengubah isi aplikasi, naikkan angka VERSION di bawah. */
const VERSION = 'v1.1';
const CACHE = 'kalkulator-optik-' + VERSION;
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('kalkulator-optik-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Respons hasil redirect tidak boleh dipakai untuk navigasi, jadi dibersihkan dulu.
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate';
  const key = isNav ? './index.html' : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const refresh = fetch(isNav ? './index.html' : req)
      .then(async (res) => {
        if (res && res.ok) await cache.put(key, (await clean(res)).clone());
        return res;
      })
      .catch(() => null);

    if (cached) { e.waitUntil(refresh); return cached; }
    const res = await refresh;
    if (res) return isNav ? clean(res) : res;
    return isNav ? (await cache.match('./index.html')) || Response.error() : Response.error();
  })());
});
