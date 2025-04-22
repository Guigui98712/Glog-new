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
  console.log('Recebida mensagem em background:', payload);

  // Customizar a notificação
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Certifique-se de ter este ícone na pasta public
    badge: '/badge.png', // Opcional
    vibrate: [200, 100, 200], // Padrão de vibração
    tag: 'notification-' + Date.now(), // Tag única para cada notificação
    data: payload.data // Dados adicionais, se houver
  };

  // Mostrar a notificação
  return self.registration.showNotification(notificationTitle, notificationOptions);
}); 