import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationDBService, { DBNotification } from '@/services/NotificationDBService';
import NotificationService from '@/services/NotificationService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationContextType {
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  loading: false,
  refreshNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isNative, setIsNative] = useState(false);

  // Verificar se estamos em ambiente nativo (Android/iOS)
  useEffect(() => {
    const checkPlatform = async () => {
      const isNativePlatform = Capacitor.isNativePlatform();
      setIsNative(isNativePlatform);
      
      if (isNativePlatform) {
        try {
          // Solicitar permissão para notificações locais no app
          const permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display !== 'granted') {
            await LocalNotifications.requestPermissions();
            console.log('[NotificationContext] Permissão para notificações solicitada');
          }
        } catch (e) {
          console.error('[NotificationContext] Erro ao verificar permissões:', e);
        }
      }
    };
    
    checkPlatform();
  }, []);

  // Obter o usuário atual
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Erro ao obter usuário:', error);
      }
    };

    fetchUser();

    // Observar mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUserId(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUserId(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Inicializar serviço de notificações
  useEffect(() => {
    const initializeNotifications = async () => {
      if (userId) {
        const notificationService = NotificationService.getInstance();
        await notificationService.initialize();
        await refreshNotifications();
      }
    };

    initializeNotifications();
  }, [userId]);

  // Mostrar notificação local no dispositivo
  const showLocalNotification = async (notification: any) => {
    if (!isNative) return;
    
    try {
      console.log('[NotificationContext] Mostrando notificação local:', notification);
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title,
            body: notification.message,
            id: notification.id || Math.floor(Math.random() * 10000),
            schedule: { at: new Date(Date.now() + 300) },
            smallIcon: 'ic_notification',
            channelId: 'default',
          }
        ]
      });
    } catch (e) {
      console.error('[NotificationContext] Erro ao mostrar notificação local:', e);
    }
  };

  // Configurar Realtime para notificações
  useEffect(() => {
    if (!userId) return;

    // Canal para escutar inserções na tabela de notificações
    const notificationsChannel = supabase
      .channel('context-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId} AND read=eq.false`,
        },
        (payload) => {
          console.log('[NotificationContext] Nova notificação recebida:', payload.new);
          // Mostrar notificação local no dispositivo móvel
          if (isNative) {
            showLocalNotification(payload.new);
          }
          refreshNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshNotifications();
        }
      )
      .subscribe();

    console.log('[NotificationContext] Inscrição Realtime configurada para usuário:', userId);

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [userId, isNative]);

  const refreshNotifications = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const notificationService = NotificationDBService.getInstance();
      const count = await notificationService.countUnreadNotifications(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Erro ao atualizar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const notificationService = NotificationDBService.getInstance();
      const success = await notificationService.markAsRead(notificationId);
      
      if (success) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    try {
      const notificationService = NotificationDBService.getInstance();
      const success = await notificationService.markAllAsRead(userId);
      
      if (success) {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  const value = {
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
} 