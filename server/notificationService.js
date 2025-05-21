const { google } = require('google-auth-library');
const axios = require('axios');
// Ajuste o caminho para o local onde você salvou o arquivo JSON
const serviceAccount = require('./glog-service-account.json'); 

async function sendNotification(token, title, body, data = {}) {
  const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const projectId = serviceAccount.project_id;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: data
    }
  };

  try {
    const response = await axios.post(url, message, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Notificação enviada com sucesso:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar notificação:', error.response?.data || error.message);
    throw error;
  }
}

// Função para enviar notificações para múltiplos dispositivos
async function sendNotificationToMultipleDevices(tokens, title, body, data = {}) {
  const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const projectId = serviceAccount.project_id;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  
  // Resultados de todas as notificações enviadas
  const results = {
    successful: [],
    failed: []
  };
  
  // Enviar notificações para cada token em paralelo
  const promises = tokens.map(async (token) => {
    const message = {
      message: {
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: data
      }
    };
    
    try {
      const response = await axios.post(url, message, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      console.log(`Notificação enviada com sucesso para token ${token}:`, response.data);
      results.successful.push({ token, response: response.data });
      return { success: true, token, data: response.data };
    } catch (error) {
      console.error(`Erro ao enviar notificação para token ${token}:`, 
                    error.response?.data || error.message);
      results.failed.push({ token, error: error.response?.data || error.message });
      return { success: false, token, error: error.response?.data || error.message };
    }
  });
  
  // Aguardar todas as notificações serem enviadas
  await Promise.allSettled(promises);
  
  console.log(`Envio de notificações concluído: ${results.successful.length} sucesso, ${results.failed.length} falhas`);
  return results;
}

module.exports = { sendNotification, sendNotificationToMultipleDevices }; 