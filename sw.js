// Service worker : permet l'installation et un affichage rapide.
// Les fichiers de l'application sont servis depuis le réseau en priorité (mises à jour
// immédiates), avec une copie de secours hors connexion. Les données Firebase ne sont pas mises en cache ici.
const CACHE = 'retraites-v7';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'logo.png', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())) });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r }).catch(() => caches.match(e.request)));
});
