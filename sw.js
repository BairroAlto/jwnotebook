const CACHE_NAME = 'notabook-x-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles/global.css',
  '/styles/typography.css',
  '/styles/mobile.css',
  '/styles/loading-sentinela.css',
  '/firebase-config.js'
];

// Instalação: Cacheia o esqueleto do site
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Interpela as chamadas de rede
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
