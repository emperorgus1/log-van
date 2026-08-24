const CACHE_NAME = 'carnet-van-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/attachments.js',
  './js/db.js',
  './js/firebase.js',
  './js/geo.js',
  './js/migrate.js',
  './js/utils.js',
  './js/views/dashboard.js',
  './js/views/expenses.js',
  './js/views/fuel.js',
  './js/views/places.js',
  './js/views/reports.js',
  './js/views/vehicle.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Réseau en premier : chaque mise à jour de l'appli est servie dès le
// prochain chargement, sans jamais rester coincé sur une vieille version en
// cache. Le cache ne sert que de filet de secours hors ligne.
// `cache: 'no-store'` court-circuite aussi le cache HTTP normal du navigateur
// (GitHub Pages sert nos fichiers avec max-age=600) — sans ça, le fetch
// "réseau" pouvait quand même être satisfait par ce cache-là pendant 10 min.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request.url, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
