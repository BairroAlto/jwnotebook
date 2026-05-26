const CACHE_NAME = 'notabook-v1';
const ASSETS = [
  '/',
  'index.html',
  'styles/global.css',
  'styles/typography.css',
  'styles/mobile.css',
  'styles/nexo.css',
  'styles/loading-sentinela.css',
  'firebase-config.js'
];

// Instalação
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação e Limpeza
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Busca de ficheiros (Estratégia: Tenta Rede, se falhar tenta Cache)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for boa, guarda no cache
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Se estiver offline, tenta o cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          // Se for uma PÁGINA (navegação) e não estiver no cache, mostra o index
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }
          event.respondWith(fetch(event.request));
        });
      })
  );
});
