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
    // Verificar a configuração de persistência de login
    const persistLoginSetting = localStorage.getItem(PERSIST_LOGIN_KEY);
    if (persistLoginSetting !== null) {
      setPersistentLoginState(persistLoginSetting === 'true');
    }
    
    // Tentar recuperar a sessão do armazenamento
    const storedSession = getSessionFromStorage();
    if (storedSession) {
      console.log('[AUTH] Usando sessão do armazenamento');
      setSession(storedSession);
      setUser(storedSession.user);
      
      // Verificar se a sessão ainda é válida no Supabase
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession) {
          console.log('[AUTH] Sessão do Supabase válida');
          setSession(currentSession);
          setUser(currentSession.user);
          saveSessionToStorage(currentSession);
        } else {
          console.log('[AUTH] Sessão do armazenamento expirada, removendo');
          setSession(null);
          setUser(null);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
        setLoading(false);
      });
    } else {
      // Se não houver sessão no armazenamento, verificar no Supabase
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        console.log('[AUTH] Sessão inicial do Supabase:', currentSession);
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession) {
          saveSessionToStorage(currentSession);
        }
        
        setLoading(false);
      });
    }

    // Configurar o listener de autenticação para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[AUTH] Event:', event, 'Session:', newSession);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user || null);
          saveSessionToStorage(newSession);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    );

    // Limpar o listener quando o componente for desmontado
    return () => {
      subscription.unsubscribe();
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
      console.log('[AUTH] Attempting password reset for:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      console.log('[AUTH] Password reset result:', { error });
      
      if (error) {
        return { error, success: false };
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('[AUTH] Password reset error:', error);
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