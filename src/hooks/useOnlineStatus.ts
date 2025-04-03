import { useState, useEffect } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  // Monitora o status de conexão geral
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Função para verificar se o Supabase está acessível
  const checkSupabaseConnection = async (): Promise<boolean> => {
    if (!supabaseUrl) return false;
    
    try {
      setIsChecking(true);
      
      // Usa a API fetch para tentar acessar o domínio do Supabase
      // sem realmente fazer a autenticação
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout
      
      const response = await fetch(`${supabaseUrl}/healthz`, {
        method: 'HEAD',
        mode: 'no-cors', // Importante para evitar erros de CORS
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setIsSupabaseReachable(true);
      return true;
    } catch (error) {
      console.warn('Falha ao verificar conexão com Supabase:', error);
      setIsSupabaseReachable(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Verifica a conexão com o Supabase na montagem e quando o status de online muda
  useEffect(() => {
    if (isOnline) {
      checkSupabaseConnection();
    } else {
      setIsSupabaseReachable(false);
    }
  }, [isOnline]);

  return {
    isOnline,
    isSupabaseReachable,
    isChecking,
    checkSupabaseConnection
  };
} 