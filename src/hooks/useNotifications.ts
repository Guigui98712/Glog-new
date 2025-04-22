import { useEffect, useState } from 'react';
import PushNotificationService from '../services/PushNotificationService';

export function useNotifications() {
  const [isEnabled, setIsEnabled] = useState(false);
  const notificationService = PushNotificationService.getInstance();

  useEffect(() => {
    const setupNotifications = async () => {
      const enabled = await notificationService.setupNotifications();
      setIsEnabled(enabled);
    };

    setupNotifications();
  }, []);

  const sendNotification = async (title: string, body: string, targetUserId: string) => {
    if (!isEnabled) {
      console.warn('Notificações não estão habilitadas');
      return;
    }
    await notificationService.sendNotification(title, body, targetUserId);
  };

  const setCurrentUserId = (userId: string) => {
    notificationService.setCurrentUserId(userId);
  };

  return {
    isEnabled,
    sendNotification,
    setCurrentUserId
  };
} 