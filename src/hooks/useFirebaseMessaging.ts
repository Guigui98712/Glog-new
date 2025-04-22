import { useEffect, useState } from 'react';
import { getToken } from "firebase/messaging";
import { messaging } from "../firebase-config";
import { supabase } from '../services/supabase';

export function useFirebaseMessaging() {
  const [token, setToken] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const setupMessaging = async () => {
      try {
        const currentToken = await getToken(messaging, {
          vapidKey: "BIG74S-HGJRrLCe1YzLpUlAH42YXtkcSUuCNz0dwO87yflGjbhVof0u3SY0n6pr2v3leb5mU6jwqqa_z106-X54"
        });

        if (currentToken) {
          console.log('Token do dispositivo:', currentToken);
          setToken(currentToken);
          setIsEnabled(true);

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
          console.log('Nenhum token disponível. Solicite permissão para gerar um.');
          setIsEnabled(false);
        }
      } catch (error) {
        console.error('Erro ao configurar mensagens:', error);
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
    sendNotification
  };
} 