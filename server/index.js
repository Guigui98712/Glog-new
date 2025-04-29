const express = require('express');
const cors = require('cors');
const { sendNotification } = require('./notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota para enviar notificações
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

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 