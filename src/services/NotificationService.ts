import { supabase } from '@/lib/supabase';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase-config";
import { initializeApp } from 'firebase/app';

class NotificationService {
  private static instance: NotificationService;
  private messaging: any;
  private firebaseApp: any;
  private initialized = false;

  private constructor() {
    this.messaging = messaging;
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async getResponsavelObra(obraId: number) {
    const { data } = await supabase
      .from('obras')
      .select('responsavel_id')
      .eq('id', obraId)
      .single();
    
    return data?.responsavel_id;
  }

  public async notificarNovaDemanda(obraId: number, demandaDescricao: string) {
    try {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
        await this.sendNotification(
        'Nova Demanda Adicionada',
        `Uma nova demanda foi adicionada: ${demandaDescricao}`,
        responsavelId
      );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de nova demanda:', error);
    }
  }

  public async notificarDemandaParaPedido(obraId: number, demandaDescricao: string) {
    try {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
        await this.sendNotification(
        'Demanda Movida para Pedido',
        `A demanda "${demandaDescricao}" foi movida para pedido`,
        responsavelId
      );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de demanda para pedido:', error);
    }
  }

  public async notificarDemandaParaEntregue(obraId: number, demandaDescricao: string) {
    try {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
        await this.sendNotification(
        'Demanda Entregue',
        `A demanda "${demandaDescricao}" foi marcada como entregue`,
        responsavelId
      );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de demanda entregue:', error);
    }
  }

  public async notificarPendenciaConcluida(obraId: number, pendenciaDescricao: string) {
    try {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
        await this.sendNotification(
        'Pendência Concluída',
        `A pendência "${pendenciaDescricao}" foi marcada como concluída`,
        responsavelId
      );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de pendência concluída:', error);
    }
  }

  public async notificarDemandaParaPago(obraId: number, demandaDescricao: string) {
    try {
      const responsavelId = await this.getResponsavelObra(obraId);
      if (responsavelId) {
        await this.sendNotification(
          'Demanda Paga',
          `A demanda "${demandaDescricao}" foi marcada como paga`,
          responsavelId
        );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de demanda paga:', error);
    }
  }

  private async sendNotification(title: string, body: string, targetUserId: string) {
    try {
      // Buscar tokens do usuário alvo
      const { data: tokens } = await supabase
        .from('user_tokens')
        .select('fcm_token')
        .eq('user_id', targetUserId);

      if (!tokens || tokens.length === 0) {
        console.warn('Nenhum token encontrado para o usuário:', targetUserId);
        return;
      }

      // Enviar notificação para cada token através do seu backend
      for (const tokenObj of tokens) {
        const response = await fetch('http://localhost:3001/api/notifications/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: tokenObj.fcm_token,
            title,
            body
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Erro ao enviar notificação: ${errorData.error || response.statusText}`);
        }
      }
      
      console.log('Notificações enviadas com sucesso');
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      throw error;
    }
  }

  // Inicializar o Firebase com as configurações
  async initialize() {
    try {
      // Verificar se o Firebase já foi inicializado
      if (this.initialized) return true;
      
      // Verificar se estamos em um navegador e se o serviço de notificações é suportado
      if (!('serviceWorker' in navigator)) {
        console.warn('Navegador não suporta service workers');
        return false;
      }

      if (!('Notification' in window)) {
        console.warn('Navegador não suporta notificações');
        return false;
      }
      
      // Configurações do Firebase - em produção, serão carregadas do .env
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
      
      // Verificar se as credenciais estão definidas
      const missingConfigs = Object.entries(firebaseConfig).filter(([_, value]) => !value);
      if (missingConfigs.length > 0) {
        console.warn('Configurações do Firebase incompletas:', missingConfigs.map(([key]) => key).join(', '));
        return false;
      }

      // Inicializar Firebase
      this.firebaseApp = initializeApp(firebaseConfig);
      this.messaging = getMessaging(this.firebaseApp);
      
      // Configurar listener para mensagens
      onMessage(this.messaging, (payload) => {
        console.log('Mensagem recebida:', payload);
        this.showNotification(payload);
      });
      
      this.initialized = true;
      console.log('Serviço de notificações inicializado');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço de notificações:', error);
      return false;
    }
  }

  // Solicitar permissão e registrar o dispositivo
  async requestPermission() {
    try {
      if (!this.initialized && !(await this.initialize())) {
        return null;
      }
      
      // Verificar e solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permissão para notificações negada');
        return null;
      }
      
      // Obter token do device
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(this.messaging, { vapidKey });
      
      if (!token) {
        console.warn('Não foi possível obter o token do dispositivo');
        return null;
      }
      
      console.log('Token do dispositivo:', token);
      
      // Salvar token no Supabase para o usuário atual
      await this.saveDeviceToken(token);
      
      return token;
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return null;
    }
  }
  
  // Salvar token do dispositivo no Supabase
  private async saveDeviceToken(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Usuário não autenticado, não foi possível salvar token');
        return;
      }
      
      // Verificar se o token já existe
      const { data: existingToken } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('token', token)
        .eq('user_id', user.id)
        .single();
        
      if (existingToken) {
        console.log('Token já registrado para este usuário');
        return;
      }
      
      // Salvar novo token
      const { error } = await supabase
        .from('device_tokens')
        .insert({
          user_id: user.id,
          token,
          device_info: navigator.userAgent,
          created_at: new Date().toISOString()
        });
        
      if (error) {
        throw error;
      }
      
      console.log('Token do dispositivo salvo com sucesso');
    } catch (error) {
      console.error('Erro ao salvar token do dispositivo:', error);
    }
  }
  
  // Mostrar notificação localmente
  private showNotification(payload: any) {
    try {
      const { notification } = payload;
      
      if (!notification) return;
      
      const { title, body, icon } = notification;
      
      // Verificar se a API de notificações está disponível
      if ('Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: icon || '/logo.png',
            badge: '/badge.png',
          });
        });
      }
    } catch (error) {
      console.error('Erro ao mostrar notificação:', error);
    }
  }
  
  // Método de teste para enviar notificação
  async sendTestNotification(title: string, body: string) {
    try {
      if (!this.initialized && !(await this.initialize())) {
        throw new Error('Serviço de notificações não inicializado');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Enviar notificação via API interna (este endpoint precisará ser implementado no back-end)
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          title,
          body,
          user_id: user.id
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao enviar notificação: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Notificação de teste enviada:', result);
      return result;
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      throw error;
    }
  }
  
  // Enquanto a API não estiver disponível, podemos simular uma notificação local
  async simulateNotification(title: string, body: string) {
    try {
      // Verificar se o navegador suporta notificações
      if (!('Notification' in window)) {
        console.warn('Este navegador não suporta notificações');
        return false;
      }
      
      // Solicitar permissão se ainda não foi concedida
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Permissão para notificações negada');
          return false;
        }
      }
      
      // Mostrar notificação
      if (Notification.permission === 'granted') {
        // Tentar inicializar o serviço se necessário
        if (!this.initialized) {
          await this.initialize();
        }
        
        // Mostrar notificação usando a API do navegador
        new Notification(title, {
          body,
          icon: '/logo.png',
          badge: '/badge.png'
        });
        
        console.log('Notificação simulada mostrada com sucesso');
        return true;
      } else {
        console.warn('Permissão para notificações negada');
        return false;
      }
    } catch (error) {
      console.error('Erro ao simular notificação:', error);
      return false;
    }
  }
}

export default NotificationService; 