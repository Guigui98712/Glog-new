import { supabase } from '@/lib/supabase';

export interface DBNotification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  obra_id?: number;
  type: 'info' | 'success' | 'warning' | 'error';
  source?: string;
  source_id?: number;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  obra_id?: number;
  type?: 'info' | 'success' | 'warning' | 'error';
  source?: string;
  source_id?: number;
}

class NotificationDBService {
  private static instance: NotificationDBService;

  private constructor() {}

  public static getInstance(): NotificationDBService {
    if (!NotificationDBService.instance) {
      NotificationDBService.instance = new NotificationDBService();
    }
    return NotificationDBService.instance;
  }

  /**
   * Cria uma nova notificação no banco de dados
   */
  public async createNotification(params: CreateNotificationParams): Promise<DBNotification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.user_id,
          title: params.title,
          message: params.message,
          obra_id: params.obra_id,
          type: params.type || 'info',
          source: params.source,
          source_id: params.source_id,
          read: false
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar notificação:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return null;
    }
  }

  /**
   * Cria múltiplas notificações de uma vez
   */
  public async createMultipleNotifications(
    userIds: string[],
    params: Omit<CreateNotificationParams, 'user_id'>
  ): Promise<number> {
    try {
      // Criar um array de objetos de notificação para inserir
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title: params.title,
        message: params.message,
        obra_id: params.obra_id,
        type: params.type || 'info',
        source: params.source,
        source_id: params.source_id,
        read: false
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select('id');

      if (error) {
        console.error('Erro ao criar múltiplas notificações:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao criar múltiplas notificações:', error);
      return 0;
    }
  }

  /**
   * Busca as notificações de um usuário
   */
  public async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      onlyUnread?: boolean;
      obraId?: number;
    } = {}
  ): Promise<{ notifications: DBNotification[]; count: number }> {
    try {
      // Configurar a query
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Aplicar filtros adicionais
      if (options.onlyUnread) {
        query = query.eq('read', false);
      }

      if (options.obraId) {
        query = query.eq('obra_id', options.obraId);
      }

      // Aplicar paginação
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Erro ao buscar notificações:', error);
        return { notifications: [], count: 0 };
      }

      return {
        notifications: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return { notifications: [], count: 0 };
    }
  }

  /**
   * Marca uma notificação como lida
   */
  public async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return false;
    }
  }

  /**
   * Marca todas as notificações do usuário como lidas
   */
  public async markAllAsRead(userId: string, obraId?: number): Promise<boolean> {
    try {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (obraId) {
        query = query.eq('obra_id', obraId);
      }

      const { error } = await query;

      if (error) {
        console.error('Erro ao marcar todas notificações como lidas:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      return false;
    }
  }

  /**
   * Conta notificações não lidas para um usuário
   */
  public async countUnreadNotifications(userId: string, obraId?: number): Promise<number> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (obraId) {
        query = query.eq('obra_id', obraId);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Erro ao contar notificações não lidas:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Erro ao contar notificações não lidas:', error);
      return 0;
    }
  }
}

export default NotificationDBService; 