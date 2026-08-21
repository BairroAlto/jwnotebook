importScripts('./components/notifications/push-service-worker.js');

// Incrementar esta versão força a criação de uma cache limpa em todos os clientes.
const CACHE_NAME = 'notabook-v88-habito';

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
  './components/app-bootstrap.js?v=20260820-note-options-2',
  './components/editor/editor.html?v=20260820-note-options-2',
  './components/editor/modulos/rich-text-editor.css',
  './components/editor/modulos/rich-text-editor.js',
  './components/editor/modulos/mobile-bible-bar.css',
  './components/editor/modulos/mobile-bible-bar.js',
  './components/editor/modulos/tags/tags-nota.css?v=20260820-note-options-2',
  './components/editor/modulos/agenda/agenda.css?v=20260820-note-options-2',
  './components/editor/modulos/agenda/agenda-client.js',
  './components/editor/modulos/agenda/agenda-controller.js?v=20260820-note-options-2',
  './components/editor/ferramentas/habito.css?v=20260821-habito-10',
  './components/editor/ferramentas/habito.js?v=20260821-habito-10',
  './components/editor/ferramentas/habito-model.js',
  './components/editor/ferramentas/habito-view.js',
  './components/editor/ferramentas/habito-categorias.js',
  './components/editor/ferramentas/habito-popup.js',
  './components/popup/popup-tags-nota.html?v=20260820-note-options-2',
  './components/notifications/push-client.js',
  './components/notifications/push-service-worker.js',
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
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) return;

  // Dados estáticos: abrir imediatamente a cópia local e actualizar a cache
  // em segundo plano, sem prender a interface à resposta do GitHub.
  if (new URL(event.request.url).pathname.includes('/data/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const atualizacao = fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => null);

        return cachedResponse || atualizacao.then((response) => response || Response.error());
      })
    );
    return;
  }

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
