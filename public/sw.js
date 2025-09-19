const VERSION = 'v1';
const APP_ASSETS = [
  '/secure-notes/', '/secure-notes/index.html', '/secure-notes/app.css', '/secure-notes/app.js',
  '/secure-notes/sanitize.js', '/secure-notes/crypto.js', '/secure-notes/idb.js', '/secure-notes/utils.js',
  '/secure-notes/manifest.webmanifest', '/secure-notes/icons/icon-192.png', '/secure-notes/icons/icon-512.png'
];

const APP_HASHES = { '/index.html': 'sha256-PLACEHOLDER' }; // will be injected by script

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(`app-${VERSION}`);
    await cache.addAll(APP_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

async function sha256(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return 'sha256-' + btoa(String.fromCharCode(...new Uint8Array(hash)));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (APP_ASSETS.includes(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(`app-${VERSION}`);
      const cached = await cache.match(e.request);
      if (cached) return cached;
      const resp = await fetch(e.request);
      const buf = await resp.clone().arrayBuffer();
      const hash = await sha256(buf);
      const expected = APP_HASHES[url.pathname] || APP_HASHES[url.pathname.replace('/secure-notes', '')];
      if (expected && expected !== hash) return new Response('Integrity error', { status: 409 });
      await cache.put(e.request, resp.clone());
      return resp;
    })());
    return;
  }

  e.respondWith((async () => {
    try { return await fetch(e.request); }
    catch {
      const cache = await caches.open(`app-${VERSION}`);
      const cached = await cache.match(e.request);
      return cached || new Response('Offline', { status: 503 });
    }
  })());
});
