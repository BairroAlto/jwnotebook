const CACHE_NAME = 'notabook-x-v21';

const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './biblia.html',
  './book.html',
  './office.html',
  './xray.html',
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
  // 1. REGRA DE OURO: Ignorar tudo o que não seja GET (Corrige o erro do POST)
  if (event.request.method !== 'GET') return;

  // 2. Ignorar chamadas do Firebase/Google (Auth, Firestore, etc)
  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, guarda no cache
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Se falhar a rede, tenta o cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Se for uma página e estiver offline, volta ao index
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
