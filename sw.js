const CACHE_NAME = 'notabook-x-v23';

const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './biblia.html',
  './book.html',
  './office.html',
  './xray.html',
  './flecha.html',
  './manifest.json',
  './manifest-book.json',
  './manifest-biblia.json',
  './manifest-office.json',
  './manifest-xray.json',
  './styles/global.css',
  './styles/typography.css',
  './styles/mobile.css',
  './components/editor/modulos/mobile-bible-bar.css',
  './components/editor/modulos/mobile-bible-bar.js',
  './components/updates/checker.js',
  './styles/nexo.css',
  './styles/loading-sentinela.css',
  './firebase-config.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
