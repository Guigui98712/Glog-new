import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null, success: boolean }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any | null, user: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any | null, success: boolean }>;
  persistLogin: boolean;
  setPersistentLogin: (persist: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Chave para armazenar a sessão no localStorage
const SESSION_STORAGE_KEY = 'obra_tracker_session';
// Chave para armazenar a flag de persistência de login
const PERSIST_LOGIN_KEY = 'obra_tracker_persist_login';

// Função auxiliar para verificar se a URL indica recuperação de senha
const isPasswordRecoveryAttempt = () => {
  const hash = window.location.hash;
  const search = window.location.search;
  const pathname = window.location.pathname;
  
  const hashParams = new URLSearchParams(hash.replace('#', ''));
  const searchParams = new URLSearchParams(search);
  
  const type = searchParams.get('type') || hashParams.get('type');
  
  const isRecovery = 
    (hash && hash.includes('type=recovery')) || 
    type === 'recovery' ||
    pathname.includes('reset-password');
    
  console.log('[AUTH Helper] Verificando recuperação de senha na URL:', { isRecovery, hash, search, pathname });
  return isRecovery;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [persistentLogin, setPersistentLoginState] = useState<boolean>(
    localStorage.getItem(PERSIST_LOGIN_KEY) !== 'false'
  );

  // Função para salvar a sessão no localStorage
  const saveSessionToStorage = (session: Session | null) => {
    if (session && persistentLogin) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      console.log('[AUTH] Sessão salva no localStorage');
    } else if (!persistentLogin) {
      // Se não deve persistir o login, armazenar na sessionStorage (dura apenas durante a sessão do navegador)
      if (session) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        console.log('[AUTH] Sessão salva na sessionStorage (não persistente)');
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      console.log('[AUTH] Sessão removida do armazenamento');
    }
  };

  // Função para recuperar a sessão do armazenamento
  const getSessionFromStorage = (): Session | null => {
    // Primeiro tenta recuperar do localStorage (persistente)
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession) as Session;
        console.log('[AUTH] Sessão recuperada do localStorage');
        return parsedSession;
      } catch (error) {
        console.error('[AUTH] Erro ao analisar sessão do localStorage:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    
    // Se não encontrou no localStorage, tenta na sessionStorage
    const sessionStorageSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionStorageSession) {
      try {
        const parsedSession = JSON.parse(sessionStorageSession) as Session;
        console.log('[AUTH] Sessão recuperada da sessionStorage');
        return parsedSession;
      } catch (error) {
        console.error('[AUTH] Erro ao analisar sessão da sessionStorage:', error);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    
    return null;
  };

  // Função para configurar o login persistente
  const handleSetPersistentLogin = (enabled: boolean) => {
    console.log('[AUTH] Configurando login persistente:', enabled);
    setPersistentLoginState(enabled);
    localStorage.setItem(PERSIST_LOGIN_KEY, enabled.toString());
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true); // Garantir que o loading comece como true
    
    // Verificar se é uma tentativa de recuperação antes de carregar a sessão
    const isRecovery = isPasswordRecoveryAttempt();
    
    if (isRecovery) {
      console.log('[AUTH Init] Tentativa de recuperação de senha detectada. Adiando carregamento de sessão existente.');
      // Não carregar sessão existente, esperar pelo evento PASSWORD_RECOVERY
      setLoading(false); // Permite que ResetPassword monte e escute o evento
    } else {
      console.log('[AUTH Init] Não é recuperação de senha. Carregando sessão...');
      // Tentar carregar a sessão normalmente
      const storedSession = getSessionFromStorage();
      if (storedSession) {
        console.log('[AUTH Init] Usando sessão do armazenamento');
        if (isMounted) {
          setSession(storedSession);
          setUser(storedSession.user);
        }
        // Verificar validade no Supabase em segundo plano
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          if (!currentSession && isMounted) {
            console.log('[AUTH Init] Sessão do armazenamento expirada, limpando.');
            setSession(null);
            setUser(null);
            localStorage.removeItem(SESSION_STORAGE_KEY);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } else if (currentSession && isMounted && currentSession.access_token !== storedSession.access_token) {
            console.log('[AUTH Init] Sessão do Supabase atualizada.');
            setSession(currentSession);
            setUser(currentSession.user);
            saveSessionToStorage(currentSession);
          }
          if (isMounted) setLoading(false);
        });
      } else {
        // Se não houver sessão no armazenamento, verificar no Supabase
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          console.log('[AUTH Init] Sessão inicial do Supabase:', !!currentSession);
          if (isMounted) {
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (currentSession) {
              saveSessionToStorage(currentSession);
            }
            setLoading(false);
          }
        });
      }
    }

    // Configurar o listener de autenticação para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return; // Ignorar se o componente foi desmontado
        console.log('[AUTH Listener] Event:', event, 'Session:', !!newSession);
        
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[AUTH Listener] Evento PASSWORD_RECOVERY recebido. A página ResetPassword deve tratar.');
          // Não faz nada aqui, ResetPassword vai lidar com isso
          // Poderíamos até forçar loading = false aqui se necessário
          setLoading(false);
          return;
        }
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Apenas atualiza se NÃO for uma recuperação de senha (já tratado acima)
          if (!isPasswordRecoveryAttempt()) {
             console.log('[AUTH Listener] Evento SIGNED_IN/TOKEN_REFRESHED, atualizando sessão.');
             setSession(newSession);
             setUser(newSession?.user || null);
             saveSessionToStorage(newSession);
          } else {
             console.log('[AUTH Listener] Ignorando SIGNED_IN/TOKEN_REFRESHED durante recuperação de senha.');
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AUTH Listener] Evento SIGNED_OUT, limpando sessão.');
          setSession(null);
          setUser(null);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    );

    // Limpar o listener quando o componente for desmontado
    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
        console.log('[AUTH Cleanup] Listener de autenticação desinscrito.');
      }
    };
  }, []);

  // Função para login
  const signIn = async (email: string, password: string) => {
    try {
      console.log('[AUTH] Attempting login with:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('[AUTH] Login result:', { data, error });
      
      if (error) {
        return { error, success: false };
      }
      
      // Salvar a sessão no armazenamento após login bem-sucedido
      if (data.session) {
        saveSessionToStorage(data.session);
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      return { error, success: false };
    }
  };

  // Função para cadastro
  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('[AUTH] Attempting signup with:', email, name);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });
      
      console.log('[AUTH] Signup result:', { data, error });
      
      return { error, user: data?.user || null };
    } catch (error) {
      console.error('[AUTH] Signup error:', error);
      return { error, user: null };
    }
  };

  // Função para recuperação de senha
  const resetPassword = async (email: string) => {
    try {
      console.log('[AUTH] Tentando recuperação de senha para:', email);
      
      // Sempre usar o domínio do Netlify para recuperação
      const redirectUrl = 'https://glogg.netlify.app/reset-password';
      console.log('[AUTH] URL de redirecionamento:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
        captchaToken: undefined,
      });
      
      console.log('[AUTH] Resultado da recuperação de senha:', { error });
      
      if (error) {
        console.error('[AUTH] Erro na recuperação de senha:', error);
        return { error, success: false };
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('[AUTH] Erro na recuperação de senha:', error);
      return { error, success: false };
    }
  };

  // Função para logout
  const signOut = async () => {
    console.log('[AUTH] Signing out');
    // Remover a sessão do armazenamento
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    persistLogin: persistentLogin,
    setPersistentLogin: handleSetPersistentLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 