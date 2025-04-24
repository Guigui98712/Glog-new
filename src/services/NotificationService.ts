import { supabase } from '@/lib/supabase';
import { getMessaging, getToken } from "firebase/messaging";
import { messaging } from "../firebase-config";

class NotificationService {
  private static instance: NotificationService;
  private messaging: any;

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

      // Enviar notificação usando a API do Firebase Cloud Messaging
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${import.meta.env.VITE_FIREBASE_SERVER_KEY}`
        },
        body: JSON.stringify({
          registration_ids: tokens.map(t => t.fcm_token),
          notification: {
            title,
            body
          }
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar notificação');
      }

      const result = await response.json();
      console.log('Notificação enviada com sucesso:', result);
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      throw error;
    }
  }
}

export default NotificationService; 