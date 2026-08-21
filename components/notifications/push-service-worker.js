(function iniciarPushNotaBook() {
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAZmDPPbqyfnP3rfrT2-xsWg92qbbL2a-0',
    authDomain: 'jwnotebook.firebaseapp.com',
    projectId: 'jwnotebook',
    storageBucket: 'jwnotebook.firebasestorage.app',
    messagingSenderId: '299467134440',
    appId: '1:299467134440:web:7b25d02c77fd09711f405d',
    databaseURL: 'https://jwnotebook-default-rtdb.europe-west1.firebasedatabase.app'
  };

  function urlSeguraDaNota(valor) {
    const fallback = new URL('/index.html', self.location.origin);
    try {
      const alvo = new URL(valor || fallback.href, self.location.origin);
      if (alvo.origin !== self.location.origin || alvo.pathname !== '/index.html') {
        return fallback.href;
      }
      const notaId = alvo.searchParams.get('nota');
      if (notaId && !/^[A-Za-z0-9_-]{1,128}$/.test(notaId)) return fallback.href;
      return alvo.href;
    } catch (_) {
      return fallback.href;
    }
  }

  self.addEventListener('notificationclick', (event) => {
    const dados = event.notification?.data || {};
    if (dados.type !== 'note-reminder') return;
    event.notification.close();
    const destino = urlSeguraDaNota(dados.url);

    event.waitUntil((async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const correspondente = janelas.find((janela) => janela.url === destino);
      if (correspondente && 'focus' in correspondente) return correspondente.focus();
      if (self.clients.openWindow) return self.clients.openWindow(destino);
      return undefined;
    })());
  });

  try {
    importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');
    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const dados = payload?.data || {};
      if (dados.type !== 'note-reminder') return;
      const destino = urlSeguraDaNota(dados.url);
      return self.registration.showNotification(dados.title || 'Relembrar nota', {
        body: dados.body || 'Está na hora de voltares à tua nota.',
        icon: '/icons/index/web-app-manifest-192x192.png',
        badge: '/icons/index/favicon-96x96.png',
        tag: `note-reminder-${dados.reminderId || dados.noteId || 'agenda'}`,
        renotify: false,
        timestamp: Date.now(),
        data: {
          type: 'note-reminder',
          noteId: dados.noteId || '',
          url: destino
        }
      });
    });
  } catch (erro) {
    console.warn('[PUSH] Firebase Messaging não ficou disponível neste arranque do service worker.', erro);
  }
})();
