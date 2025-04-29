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

module.exports = { sendNotification }; 