const CACHE = 'strikecalc-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/calc.js',
  './js/log.js',
  './js/main.js',
  './js/mdr.js',
  './js/sag.js',
  './js/species.js',
  './js/state.js',
  './js/tabs.js',
  './js/viz.js',
  './js/wires.js',
  './favicon.ico',
  // Google Fonts — cache on first fetch
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap'
];

// Install: pre-cache all app assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache valid responses from same origin + fonts
        if (
          response.ok &&
          (e.request.url.startsWith(self.location.origin) ||
           e.request.url.startsWith('https://fonts.googleapis.com') ||
           e.request.url.startsWith('https://fonts.gstatic.com'))
        ) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback — return cached index.html for navigation requests
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
