const express = require('express');
const cors = require('cors');
const { sendNotification, sendNotificationToMultipleDevices } = require('./notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota para enviar notificações para um único dispositivo
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { token, title, body, data } = req.body;
    
    if (!token || !title || !body) {
      return res.status(400).json({ error: 'Parâmetros incompletos' });
    }
    
    const result = await sendNotification(token, title, body, data || {});
    res.status(200).json({ success: true, message: 'Notificação enviada com sucesso', data: result });
  } catch (error) {
    console.error('Erro no endpoint de notificações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota para enviar notificações para múltiplos dispositivos
app.post('/api/notifications/send-multiple', async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;
    
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0 || !title || !body) {
      return res.status(400).json({ error: 'Parâmetros incompletos ou inválidos' });
    }
    
    const result = await sendNotificationToMultipleDevices(tokens, title, body, data || {});
    res.status(200).json({ 
      success: true, 
      message: `Notificações enviadas para ${tokens.length} dispositivos`,
      results: result 
    });
  } catch (error) {
    console.error('Erro no endpoint de notificações múltiplas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 