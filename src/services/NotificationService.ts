import { supabase } from '@/lib/supabase';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase-config";
import { initializeApp } from 'firebase/app';
import NotificationDBService from './NotificationDBService';

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
      .select('responsavel_id, nome')
      .eq('id', obraId)
      .single();
    
    return data;
  }

  // Método para obter os IDs de todos os membros de uma obra
  private async getMembrosObra(obraId: number) {
    try {
      // Buscar o responsável da obra
      const responsavelData = await this.getResponsavelObra(obraId);
      const responsavelId = responsavelData?.responsavel_id;
      
      // Buscar os membros da equipe da obra
      const { data: membrosEquipe, error } = await supabase
        .from('obra_membros')
        .select('user_id')
        .eq('obra_id', obraId);
        
      if (error) throw error;
      
      // Criar um conjunto único de IDs de usuário (sem duplicatas)
      const membrosIds = new Set<string>();
      
      // Adicionar o responsável se existir
      if (responsavelId) membrosIds.add(responsavelId);
      
      // Adicionar os membros da equipe
      if (membrosEquipe) {
        membrosEquipe.forEach(membro => membrosIds.add(membro.user_id));
      }
      
      return Array.from(membrosIds);
    } catch (error) {
      console.error('Erro ao obter membros da obra:', error);
      return [];
    }
  }

  public async notificarNovaDemanda(obraId: number, demandaDescricao: string) {
    try {
      const obraInfo = await this.getResponsavelObra(obraId);
      const membrosIds = await this.getMembrosObra(obraId);
      
      // Criar notificações no banco de dados
      const notificationDBService = NotificationDBService.getInstance();
      await notificationDBService.createMultipleNotifications(
        membrosIds,
        {
          title: 'Nova Demanda Adicionada',
          message: `Obra: ${obraInfo?.nome} - Uma nova demanda foi adicionada: ${demandaDescricao}`,
          obra_id: obraId,
          type: 'info',
          source: 'demanda'
        }
      );
      
      // Enviar notificação push para todos os membros da obra
      for (const userId of membrosIds) {
        await this.sendNotification(
          'Nova Demanda Adicionada',
          `Obra: ${obraInfo?.nome} - Uma nova demanda foi adicionada: ${demandaDescricao}`,
          userId
        );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de nova demanda:', error);
    }
  }

  public async notificarDemandaParaPedido(obraId: number, demandaDescricao: string) {
    try {
      const obraInfo = await this.getResponsavelObra(obraId);
      const membrosIds = await this.getMembrosObra(obraId);
      
      // Criar notificações no banco de dados
      const notificationDBService = NotificationDBService.getInstance();
      await notificationDBService.createMultipleNotifications(
        membrosIds,
        {
          title: 'Demanda Movida para Pedido',
          message: `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi movida para pedido`,
          obra_id: obraId,
          type: 'info',
          source: 'demanda'
        }
      );
      
      // Enviar notificação push para todos os membros da obra
      for (const userId of membrosIds) {
        await this.sendNotification(
          'Demanda Movida para Pedido',
          `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi movida para pedido`,
          userId
        );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de demanda para pedido:', error);
    }
  }

  public async notificarDemandaParaEntregue(obraId: number, demandaDescricao: string) {
    try {
      const obraInfo = await this.getResponsavelObra(obraId);
      const membrosIds = await this.getMembrosObra(obraId);
      
      // Criar notificações no banco de dados
      const notificationDBService = NotificationDBService.getInstance();
      await notificationDBService.createMultipleNotifications(
        membrosIds,
        {
          title: 'Demanda Entregue',
          message: `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi marcada como entregue`,
          obra_id: obraId,
          type: 'success',
          source: 'demanda'
        }
      );
      
      // Enviar notificação push para todos os membros da obra
      for (const userId of membrosIds) {
        await this.sendNotification(
          'Demanda Entregue',
          `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi marcada como entregue`,
          userId
        );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de demanda entregue:', error);
    }
  }

  public async notificarPendenciaConcluida(obraId: number, pendenciaDescricao: string) {
    try {
      const obraInfo = await this.getResponsavelObra(obraId);
      const membrosIds = await this.getMembrosObra(obraId);
      
      // Criar notificações no banco de dados
      const notificationDBService = NotificationDBService.getInstance();
      await notificationDBService.createMultipleNotifications(
        membrosIds,
        {
          title: 'Pendência Concluída',
          message: `Obra: ${obraInfo?.nome} - Seção: Concluído - A pendência "${pendenciaDescricao}" foi marcada como concluída`,
          obra_id: obraId,
          type: 'success',
          source: 'pendencia'
        }
      );
      
      // Enviar notificação push para todos os membros da obra
      for (const userId of membrosIds) {
        await this.sendNotification(
          'Pendência Concluída',
          `Obra: ${obraInfo?.nome} - Seção: Concluído - A pendência "${pendenciaDescricao}" foi marcada como concluída`,
          userId
        );
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de pendência concluída:', error);
    }
  }

  public async notificarDemandaParaPago(obraId: number, demandaDescricao: string) {
    try {
      const obraInfo = await this.getResponsavelObra(obraId);
      const membrosIds = await this.getMembrosObra(obraId);
      
      // Criar notificações no banco de dados
      const notificationDBService = NotificationDBService.getInstance();
      await notificationDBService.createMultipleNotifications(
        membrosIds,
        {
          title: 'Demanda Paga',
          message: `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi marcada como paga`,
          obra_id: obraId,
          type: 'success',
          source: 'demanda'
        }
      );
      
      // Enviar notificação push para todos os membros da obra
      for (const userId of membrosIds) {
        await this.sendNotification(
          'Demanda Paga',
          `Obra: ${obraInfo?.nome} - A demanda "${demandaDescricao}" foi marcada como paga`,
          userId
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

      // URL do servidor de notificações - ajuste para seu servidor real
      // Use um IP ou domínio acessível em sua rede, não localhost
      const serverUrl = 'https://glog-server-feaw.onrender.com/api/notifications/send-multiple';
      // ⬆️ IMPORTANTE: SUBSTITUA ESTA LINHA pelo URL real do seu serviço no Render ⬆️
      // Exemplo: 'https://glog-notifications.onrender.com/api/notifications/send-multiple'
      
      // Extrair todos os tokens
      const fcmTokens = tokens.map(tokenObj => tokenObj.fcm_token);
      
      try {
        // Enviar notificação para todos os tokens de uma vez
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tokens: fcmTokens,
            title,
            body
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Erro ao enviar notificações em massa:`, errorData);
        } else {
          const result = await response.json();
          console.log(`Notificações enviadas em massa: ${result.results.successful.length} com sucesso, ${result.results.failed.length} falhas`);
        }
      } catch (error) {
        console.error(`Falha ao enviar notificações em massa:`, error);
      }
      
      console.log('Processo de envio de notificações concluído');
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
      
      // Solicitar permissão para notificações locais se ainda não concedida
      this.requestNotificationPermission();
      
      // Configurar assinatura de realtime para notificações
      this.setupRealtimeSubscription();
      
      this.initialized = true;
      console.log('Serviço de notificações inicializado');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço de notificações:', error);
      return false;
    }
  }

  // Solicitar permissão para notificações locais
  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        const permission = await Notification.requestPermission();
        console.log('Permissão de notificação:', permission);
      } catch (error) {
        console.error('Erro ao solicitar permissão para notificações:', error);
      }
    }
  }

  // Configurar assinatura para notificações em tempo real via Supabase
  private async setupRealtimeSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Usuário não autenticado, assinatura de realtime não configurada');
        return;
      }

      // Assinatura para novas notificações via Supabase Realtime
      const userId = user.id;
      const channel = supabase
        .channel('notification-service-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            // Mostrar notificação nativa quando receber uma nova notificação
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = payload.new;
              this.showLocalNotification(notification.title, notification.message);
            }
          }
        )
        .subscribe();

      console.log('Assinatura de notificações realtime configurada');
    } catch (error) {
      console.error('Erro ao configurar assinatura realtime:', error);
    }
  }

  // Mostrar notificação local
  private showLocalNotification(title: string, body: string) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/logo.png',
          badge: '/badge.png',
        });
      } else if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/badge.png',
          });
        });
      }
    } catch (error) {
      console.error('Erro ao mostrar notificação local:', error);
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
        .from('user_tokens')
        .select('*')
        .eq('fcm_token', token)
        .eq('user_id', user.id)
        .single();
        
      if (existingToken) {
        console.log('Token já registrado para este usuário');
        return;
      }
      
      // Salvar novo token
      const { error } = await supabase
        .from('user_tokens')
        .insert({
          user_id: user.id,
          fcm_token: token,
          device_info: navigator.userAgent,
          updated_at: new Date().toISOString()
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