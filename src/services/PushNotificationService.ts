import { PushNotifications } from '@capacitor/push-notifications';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyBtWY3vKr-6APG5aIiHs1CH2sOcx958Zv4",
  authDomain: "glog-a2338.firebaseapp.com",
  projectId: "glog-a2338",
  storageBucket: "glog-a2338.firebasestorage.app",
  messagingSenderId: "19946419586",
  appId: "1:19946419586:android:02c53f53d523dbcb0acb9b"
};

class PushNotificationService {
  private static instance: PushNotificationService;
  private currentUserId: string | null = null;
  private messaging: any;

  private constructor() {
    const app = initializeApp(firebaseConfig);
    this.messaging = getMessaging(app);
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  public async setupNotifications(): Promise<boolean> {
    try {
      // Solicitar permissão para notificações
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        // Registrar para receber notificações
        await PushNotifications.register();
        
        // Obter token FCM
        const token = await getToken(this.messaging, {
          vapidKey: 'YOUR_VAPID_KEY' // Substitua com sua chave VAPID
        });

        // Salvar token no Supabase
        if (this.currentUserId) {
          await supabase
            .from('user_tokens')
            .upsert({
              user_id: this.currentUserId,
              fcm_token: token,
              updated_at: new Date().toISOString()
            });
        }

        // Configurar listener para mensagens em primeiro plano
        onMessage(this.messaging, (payload) => {
          console.log('Mensagem recebida:', payload);
          // Aqui você pode implementar a lógica para mostrar a notificação
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao configurar notificações push:', error);
      return false;
    }
  }

  public setCurrentUserId(userId: string) {
    this.currentUserId = userId;
  }

  public async sendNotification(title: string, body: string, targetUserId: string) {
    try {
      // Buscar token FCM do usuário alvo
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('fcm_token')
        .eq('user_id', targetUserId);

      if (!tokens || tokens.length === 0) {
        console.warn('Nenhum token encontrado para o usuário:', targetUserId);
        return;
      }

      // Enviar notificação para todos os dispositivos do usuário
      const message = {
        notification: {
          title,
          body
        },
        tokens: tokens.map(t => t.fcm_token)
      };

      // Aqui você precisará implementar a lógica para enviar a mensagem
      // usando o Firebase Admin SDK no seu backend
      // Por exemplo, usando uma função Cloud ou um endpoint da sua API
      console.log('Enviando notificação:', message);
    } catch (error) {
      console.error('Erro ao enviar notificação push:', error);
    }
  }
}

export default PushNotificationService; 