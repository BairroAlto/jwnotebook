const CACHE_NAME = 'notabook-x-v12';

// Ficheiros essenciais para o "esqueleto" do app
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './styles/global.css',
  './styles/typography.css',
  './styles/mobile.css',
  './firebase-config.js'
];

// Instalação: Guarda o básico no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Interceção de pedidos (O "Cérebro" do App)
self.addEventListener('fetch', (event) => {
  // Ignorar pedidos para o Firebase Auth e Firestore (Deixa a rede tratar disso)
  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    // Tenta primeiro a Rede
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, guarda uma cópia no cache (dinâmico)
        if (response.ok && event.request.method === 'GET') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar a rede (offline), tenta o Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se for uma navegação e não tiver nada, volta para o index
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
