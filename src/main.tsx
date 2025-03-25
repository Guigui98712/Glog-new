import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { initializeLiveUpdates } from './lib/live-updates';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const queryClient = new QueryClient();

// Habilitar as APIs do Google para permitir o acesso ao banco de dados
window.DISABLE_GOOGLE_APIS = false;

// Interceptar e substituir chamadas às APIs do Google
if (typeof window !== 'undefined') {
  // Substituir o objeto 'google' global
  window.google = window.google || {};
  
  // Substituir a API do Maps
  window.google.maps = {
    Geocoder: function() {
      return {
        geocode: function(request: any, callback: any) {
          console.log('Interceptando chamada ao Google Maps API');
          callback([{
            formatted_address: 'Endereço simulado, São Paulo - SP, Brasil',
            geometry: {
              location: {
                lat: () => -23.550520,
                lng: () => -46.633308
              }
            }
          }], 'OK');
        }
      };
    },
    // Outros objetos e métodos do Maps que possam ser usados
    Map: function() { return {}; },
    Marker: function() { return {}; },
    LatLng: function(lat: number, lng: number) { 
      return { 
        lat: () => lat, 
        lng: () => lng 
      }; 
    }
  };
  
  // Substituir a API do Google Drive
  window.gapi = window.gapi || {
    client: {
      init: () => Promise.resolve(),
      drive: {
        files: {
          list: () => Promise.resolve({
            result: {
              files: [
                { id: 'fake-id-1', name: 'Documento 1.pdf' },
                { id: 'fake-id-2', name: 'Documento 2.pdf' }
              ]
            }
          }),
          create: () => Promise.resolve({
            result: {
              id: 'fake-upload-id',
              name: 'Arquivo simulado.pdf'
            }
          })
        }
      }
    },
    load: (api: string, callback: () => void) => {
      console.log(`Interceptando carregamento da API ${api}`);
      callback();
    },
    auth2: {
      getAuthInstance: () => ({
        signIn: () => Promise.resolve({
          getBasicProfile: () => ({
            getEmail: () => 'usuario.simulado@gmail.com',
            getName: () => 'Usuário Simulado',
            getImageUrl: () => 'https://via.placeholder.com/150'
          })
        }),
        signOut: () => Promise.resolve()
      })
    }
  };
}

// Inicializa o Live Updates
initializeLiveUpdates();

// Componente para gerenciar atualizações do service worker
const ServiceWorkerWrapper = ({ children }: { children: React.ReactNode }) => {
  const [showReload, setShowReload] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Registrar o service worker
    serviceWorkerRegistration.register({
      onUpdate: (registration) => {
        setShowReload(true);
        setWaitingWorker(registration);
      },
    });

    return () => {
      // Limpar o service worker quando o componente for desmontado
      serviceWorkerRegistration.unregister();
    };
  }, []);

  const handleReload = () => {
    if (waitingWorker) {
      // Enviar mensagem para o service worker pular a espera
      waitingWorker.waiting?.postMessage({ type: 'SKIP_WAITING' });
      setShowReload(false);
      // Recarregar a página para obter a nova versão
      window.location.reload();
    }
  };

  return (
    <>
      {children}
      {showReload && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-white p-3 flex justify-between items-center z-50 shadow-lg safe-bottom">
          <div>Nova versão disponível!</div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowReload(false)}
              className="px-3 py-1 border border-white rounded text-white bg-transparent hover:bg-white/10 active:bg-white/20"
            >
              Mais tarde
            </button>
            <button 
              onClick={handleReload}
              className="px-3 py-1 bg-white text-primary rounded hover:bg-white/90 active:bg-white/80"
            >
              Atualizar agora
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento root não encontrado');
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ServiceWorkerWrapper>
          <App />
        </ServiceWorkerWrapper>
      </QueryClientProvider>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Erro ao renderizar a aplicação:', error);
  rootElement.innerHTML = '<div style="color: red; padding: 20px;">Erro ao carregar a aplicação. Por favor, verifique o console.</div>';
}

// Se você quiser que seu aplicativo funcione offline e carregue mais rápido, você pode alterar
// unregister() para register() abaixo. Observe que isso vem com algumas armadilhas.
// Saiba mais sobre service workers: https://cra.link/PWA
// serviceWorkerRegistration.register();
