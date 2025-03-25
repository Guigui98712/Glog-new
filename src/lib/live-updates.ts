import { AppUpdate } from '@capawesome/capacitor-app-update';
import { Capacitor } from '@capacitor/core';

export const initializeLiveUpdates = async () => {
  try {
    // Verifica se está rodando em um dispositivo nativo (Android/iOS)
    // e não em um navegador web
    if (!Capacitor.isNativePlatform()) {
      console.log('Atualizações automáticas não são suportadas na plataforma web');
      return;
    }
    
    // Verifica se há atualizações disponíveis
    const result = await AppUpdate.getAppUpdateInfo();
    
    if (result.updateAvailable) {
      // Se houver atualização, pergunta ao usuário se deseja atualizar
      const shouldUpdate = window.confirm('Uma nova versão está disponível. Deseja atualizar agora?');
      
      if (shouldUpdate) {
        // Inicia o processo de atualização
        await AppUpdate.performImmediateUpdate();
      }
    }
  } catch (error) {
    console.error('Erro ao verificar atualizações:', error);
  }
};

// Função para verificar atualizações manualmente
export const checkForUpdates = async () => {
  try {
    // Verifica se está rodando em um dispositivo nativo
    if (!Capacitor.isNativePlatform()) {
      console.log('Verificação de atualizações não é suportada na plataforma web');
      return false;
    }
    
    const result = await AppUpdate.getAppUpdateInfo();
    return result.updateAvailable;
  } catch (error) {
    console.error('Erro ao verificar atualizações:', error);
    return false;
  }
}; 