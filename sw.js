/* Service worker Kalkulator Optik */
const VERSION = 'v3';
const CACHE = 'kalkulator-optik-' + VERSION;
const PAGE = './index.html';
const PRECACHE = [
  PAGE,
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];
const NET_TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache reload = abaikan cache bawaan browser, ambil langsung dari server
    await Promise.all(PRECACHE.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error('Gagal mengambil ' + url);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('kalkulator-optik-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// respons hasil redirect ga boleh dipake untuk navigasi, jadi diclear dulu
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function pageStrategy(e) {
  const cache = await caches.open(CACHE);
  const net = fetch(PAGE, { cache: 'no-cache' }).then(async (res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const r = await clean(res);
    await cache.put(PAGE, r.clone());
    return r;
  });
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT))]);
  } catch (err) {
    const cached = await cache.match(PAGE);
    if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
    return net;   // belum ada salinan = tunggu internet
  }
}

async function assetStrategy(e, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const refresh = fetch(req, { cache: 'no-cache' })
    .then(async (res) => { if (res && res.ok) await cache.put(req, res.clone()); return res; })
    .catch(() => null);
  if (cached) { e.waitUntil(refresh); return cached; }
  return (await refresh) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(req.mode === 'navigate' ? pageStrategy(e) : assetStrategy(e, req));
});
