importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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
  console.log('[firebase-messaging-sw.js] Recebida mensagem em background:', payload);

  // Customizar a notificação
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    tag: 'glog-notification',
    data: payload.data
  };

  // Tocar um som quando a notificação chegar
  const audio = new Audio('/beep.wav');
  audio.play().catch(error => console.log('Erro ao tocar som:', error));

  // Mostrar a notificação
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lidar com cliques na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Clique na notificação', event);
  
  event.notification.close();
  
  // Navegar para uma URL específica ao clicar na notificação
  const urlToOpen = new URL('/obras', self.location.origin).href;
  
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    // Verificar se já existe uma janela aberta e focar nela
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    
    // Se não houver janela aberta, abrir uma nova
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });
  
  event.waitUntil(promiseChain);
}); 