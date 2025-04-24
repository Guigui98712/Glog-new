import { useEffect, useState } from 'react';
import { getToken } from "firebase/messaging";
import { messaging } from "../firebase-config";
import { supabase } from '../lib/supabase';

export function useFirebaseMessaging() {
  const [token, setToken] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupMessaging = async () => {
      try {
        // Verificar se o dispositivo suporta notificações
        if (!('Notification' in window)) {
          setError('Este dispositivo não suporta notificações');
          setIsEnabled(false);
          return;
        }

        // Verificar se o Firebase Messaging está disponível
        if (!messaging) {
          setError('Firebase Messaging não está disponível');
          setIsEnabled(false);
          return;
        }

        // Solicitar permissão para notificações
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Permissão para notificações não foi concedida');
          setIsEnabled(false);
          return;
        }

        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });

        if (currentToken) {
          console.log('Token do dispositivo:', currentToken);
          setToken(currentToken);
          setIsEnabled(true);
          setError(null);

          // Obter o usuário atual
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Salvar o token no Supabase
            await supabase.from('user_tokens')
              .upsert({
                user_id: user.id,
                fcm_token: currentToken,
                updated_at: new Date().toISOString()
              });
          }
        } else {
          setError('Nenhum token disponível');
          setIsEnabled(false);
        }
      } catch (error) {
        console.error('Erro ao configurar mensagens:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
        setIsEnabled(false);
      }
    };

    setupMessaging();
  }, []);

  const sendNotification = async (title: string, body: string, targetUserId: string) => {
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
  };

  return {
    isEnabled,
    token,
    error,
    sendNotification
  };
} 