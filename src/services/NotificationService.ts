import { useFirebaseMessaging } from '@/hooks/useFirebaseMessaging';
import { supabase } from '@/lib/supabase';

class NotificationService {
  private static instance: NotificationService;
  private messaging: ReturnType<typeof useFirebaseMessaging>;

  private constructor() {
    this.messaging = useFirebaseMessaging();
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
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
      await this.messaging.sendNotification(
        'Nova Demanda Adicionada',
        `Uma nova demanda foi adicionada: ${demandaDescricao}`,
        responsavelId
      );
    }
  }

  public async notificarDemandaParaPedido(obraId: number, demandaDescricao: string) {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
      await this.messaging.sendNotification(
        'Demanda Movida para Pedido',
        `A demanda "${demandaDescricao}" foi movida para pedido`,
        responsavelId
      );
    }
  }

  public async notificarDemandaParaEntregue(obraId: number, demandaDescricao: string) {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
      await this.messaging.sendNotification(
        'Demanda Entregue',
        `A demanda "${demandaDescricao}" foi marcada como entregue`,
        responsavelId
      );
    }
  }

  public async notificarPendenciaConcluida(obraId: number, pendenciaDescricao: string) {
    const responsavelId = await this.getResponsavelObra(obraId);
    if (responsavelId) {
      await this.messaging.sendNotification(
        'Pendência Concluída',
        `A pendência "${pendenciaDescricao}" foi marcada como concluída`,
        responsavelId
      );
    }
  }
}

export default NotificationService; 