importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBtWY3vKr-6APG5aIiHs1CH2sOcx958Zv4",
  authDomain: "glog-a2338.firebaseapp.com",
  projectId: "glog-a2338",
  storageBucket: "glog-a2338.firebasestorage.app",
  messagingSenderId: "19946419586",
  appId: "1:19946419586:android:02c53f53d523dbcb0acb9b"
});

const messaging = firebase.messaging();

// Lidar com mensagens em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('Recebida mensagem em background:', payload);

  // Customizar a notificação
  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma nova notificação',
    icon: '/construction-logo.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'notification-' + Date.now(),
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  // Tocar um som quando a notificação chegar
  const audio = new Audio('/beep.wav');
  audio.play().catch(error => console.log('Erro ao tocar som:', error));

  // Mostrar a notificação
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lidar com cliques na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    // Abrir a aplicação quando clicar na notificação
    const urlToOpen = new URL('/', self.location.origin).href;

    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Verificar se já há uma janela aberta e focá-la
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Se não houver janela aberta, abrir uma nova
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
}); 