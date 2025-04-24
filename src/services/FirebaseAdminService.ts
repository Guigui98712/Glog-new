import { supabase } from './supabase';

const FIREBASE_FUNCTION_URL = 'https://us-central1-glog-a2338.cloudfunctions.net/sendNotification';

export async function sendPushNotification(title: string, body: string, targetUserId: string) {
  try {
    const { data: tokens } = await supabase
      .from('user_tokens')
      .select('fcm_token')
      .eq('user_id', targetUserId);

    if (!tokens || tokens.length === 0) {
      console.warn('Nenhum token encontrado para o usuário:', targetUserId);
      return;
    }

    const response = await fetch(FIREBASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens: tokens.map(t => t.fcm_token),
        notification: {
          title,
          body
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar notificação: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Notificação enviada com sucesso:', result);
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    throw error;
  }
} 