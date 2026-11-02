// Offline fallback so "My cards" and a card still open on a weak connection.
// Network first for everything (so updates you push reach customers immediately); cache only as a fallback.
const CACHE = 'nuqta-v9';
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

// "Your order is ready": a phone notification from the server (web push), even when the page is closed.
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'nuqatii', {
    body: d.body || '', tag: d.tag || 'nuqatii', renotify: true, requireInteraction: true,
    icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png', vibrate: [200, 100, 200], data: { url: d.url || 'rewards.html' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'rewards.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.split('#')[0] === url.split('#')[0] && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
