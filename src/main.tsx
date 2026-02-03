import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'

// Polyfill para Buffer (necessário para nspell)
import { Buffer } from 'buffer'
window.Buffer = Buffer;

// Criar instância do QueryClient com configurações
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      cacheTime: 1000 * 60 * 10, // 10 minutos
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// Verificar se está no modo almoxarifado only (sem Capacitor)
const isAlmoxOnly = import.meta.env.VITE_ALMOX_ONLY === 'true';

// Renderizar de forma assíncrona para carregar providers dinamicamente
async function renderApp() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  
  if (isAlmoxOnly) {
    const { default: AlmoxOnlyApp } = await import('./AlmoxOnlyApp');
    // Modo almoxarifado - sem Capacitor
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AlmoxOnlyApp />
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  } else {
    // Modo completo - carregar providers que usam Capacitor
    const { default: App } = await import('./App');
    const { AuthProvider } = await import('./contexts/AuthContext');
    const { NotificationProvider } = await import('./contexts/NotificationContext');
    
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <QueryClientProvider client={queryClient}>
                <App />
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  }
}

renderApp();
