// Offline fallback so "My cards" and a card still open on a weak connection.
// Network first for everything (so updates you push reach customers immediately); cache only as a fallback.
const CACHE = 'nuqta-v6';
const SHELL = ['rewards.html', 'assets/css/app.css', 'assets/vendor/qrcode.js', 'assets/vendor/jsbarcode.min.js', 'assets/img/icon.svg', 'assets/img/icon-192.png', 'manifest.json'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then((r) => r || (e.request.mode === 'navigate' ? caches.match(/\/(app|login)\.html$/.test(url.pathname) ? 'app.html' : 'rewards.html') : undefined))));
});
