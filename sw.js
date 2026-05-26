const CACHE_NAME = 'notabook-x-v2';
const ASSETS = [
  './',
  './index.html',
  './styles/global.css',
  './styles/typography.css',
  './styles/mobile.css',
  './firebase-config.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((response) => {
        // Se for um componente HTML ou JS novo, guarda em cache dinamicamente
        return caches.open(CACHE_NAME).then((cache) => {
          if (e.request.url.startsWith(location.origin)) {
             cache.put(e.request, response.clone());
          }
          return response;
        });
      });
    }).catch(() => caches.match('./index.html'))
  );
});
