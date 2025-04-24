import { useEffect } from 'react';
import { useFirebaseMessaging } from '../hooks/useFirebaseMessaging';
import { Button } from './ui/button';

export function NotificationExample() {
  const { isEnabled, token, sendNotification } = useFirebaseMessaging();

  const handleSendNotification = async () => {
    try {
      await sendNotification(
        'Nova Demanda',
        'Uma nova demanda foi criada para você',
        'targetUser456'
      );
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Status das Notificações</h2>
      <p className="mb-4">
        Notificações estão: {isEnabled ? 'Habilitadas' : 'Desabilitadas'}
      </p>
      {token && (
        <p className="mb-4 text-sm text-muted-foreground break-all">
          Token: {token}
        </p>
      )}
      <Button
        onClick={handleSendNotification}
        disabled={!isEnabled}
      >
        Enviar Notificação de Teste
      </Button>
    </div>
  );
} 