import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DBNotification } from '@/services/NotificationDBService';
import NotificationDBService from '@/services/NotificationDBService';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '@/contexts/NotificationContext';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const { unreadCount, loading: contextLoading, markAsRead, markAllAsRead } = useNotifications();
  
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState('all');
  const [totalCount, setTotalCount] = useState(0);
  
  // Obter o usuário atual quando o componente montar
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
  }, []);

  // Carregar notificações quando o usuário for identificado e o diálogo aberto
  useEffect(() => {
    if (userId && open) {
      loadNotifications();
    }
  }, [userId, open, tabValue]);

  // Configurar assinatura em tempo real para atualizações de notificações
  useEffect(() => {
    if (!userId || !open) return;

    // Canal para escutar mudanças na tabela de notificações
    const notificationsChannel = supabase
      .channel('notifications-dialog-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Nova notificação adicionada:', payload);
          const newNotification = payload.new as DBNotification;
          
          // Se estamos na aba de não lidas e a notificação é lida, ignorar
          if (tabValue === 'unread' && newNotification.read) return;
          
          // Adicionar a nova notificação à lista
          setNotifications(prev => [newNotification, ...prev]);
          
          // Atualizar contadores
          setTotalCount(prev => prev + 1);
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
        (payload) => {
          console.log('Notificação atualizada:', payload);
          const updatedNotification = payload.new as DBNotification;
          
          // Atualizar o item na lista
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === updatedNotification.id 
                ? updatedNotification 
                : notification
            )
          );
          
          // Se estamos na aba de não lidas e foi marcada como lida, remover da lista
          if (tabValue === 'unread' && updatedNotification.read) {
            setNotifications(prev => 
              prev.filter(notification => notification.id !== updatedNotification.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup da inscrição quando o componente desmontar ou o usuário mudar
    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [userId, open, tabValue]);

  const loadNotifications = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const notificationService = NotificationDBService.getInstance();
      
      const result = await notificationService.getUserNotifications(userId, {
        limit: 50,
        onlyUnread: tabValue === 'unread'
      });
      
      setNotifications(result.notifications);
      setTotalCount(result.count);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsRead(notificationId);
      
      // Atualizar a lista local
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      ));
      
      if (tabValue === 'unread') {
        // Remover da lista se estiver na aba de não lidas
        setNotifications(prev => 
          prev.filter(notification => notification.id !== notificationId)
        );
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      
      // Atualizar a lista local
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
      
      if (tabValue === 'unread') {
        // Limpar a lista se estiver na aba de não lidas
        setNotifications([]);
      }
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true,
        locale: ptBR
      });
    } catch (error) {
      return timestamp;
    }
  };

  // Renderizar item de notificação
  const renderNotificationItem = (notification: DBNotification) => {
    // Selecionar cor com base no tipo
    const getBadgeVariant = () => {
      switch (notification.type) {
        case 'success': return 'bg-green-100 text-green-800';
        case 'warning': return 'bg-yellow-100 text-yellow-800';
        case 'error': return 'bg-red-100 text-red-800';
        default: return 'bg-blue-100 text-blue-800';
      }
    };

    return (
      <div 
        key={notification.id} 
        className={`p-4 border-b ${!notification.read ? 'bg-blue-50' : ''}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              <span className="font-semibold">{notification.title}</span>
              {!notification.read && (
                <Badge 
                  variant="outline" 
                  className="ml-2 text-xs py-0 h-5"
                >
                  Nova
                </Badge>
              )}
            </div>
            <p className="text-gray-700 text-sm">{notification.message}</p>
            <div className="flex items-center mt-1 text-gray-500 text-xs">
              <span>{formatTimestamp(notification.created_at)}</span>
              {notification.source && (
                <Badge 
                  className={`ml-2 text-xs py-0 h-5 ${getBadgeVariant()}`}
                >
                  {notification.source}
                </Badge>
              )}
            </div>
          </div>
          {!notification.read && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-700"
              onClick={() => handleMarkAsRead(notification.id)}
              title="Marcar como lida"
            >
              <CheckIcon className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const isLoading = loading || contextLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificações</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="all" value={tabValue} onValueChange={setTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">
              Todas 
              {totalCount > 0 && <Badge className="ml-2">{totalCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="unread">
              Não lidas
              {unreadCount > 0 && <Badge className="ml-2">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-2">
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                notifications.map(renderNotificationItem)
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                  <BellIcon className="h-12 w-12 mb-2" />
                  <p>Nenhuma notificação encontrada</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="unread" className="mt-2">
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                notifications.map(renderNotificationItem)
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                  <CheckIcon className="h-12 w-12 mb-2" />
                  <p>Nenhuma notificação não lida</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={() => loadNotifications()} 
            disabled={isLoading}
          >
            Atualizar
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleMarkAllAsRead} 
            disabled={isLoading || unreadCount === 0}
          >
            Marcar todas como lidas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 