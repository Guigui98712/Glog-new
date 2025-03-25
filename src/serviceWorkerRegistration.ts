// Este código opcional é usado para registrar um service worker.
// register() não é chamado por padrão.

// Isso permite que o aplicativo carregue mais rápido em visitas subsequentes em produção e fornece
// recursos offline. No entanto, também significa que os desenvolvedores (e usuários)
// só verão atualizações implantadas em visitas subsequentes a uma página, depois que todas as
// guias existentes abertas na página forem fechadas, pois os recursos em cache anteriormente
// são atualizados em segundo plano.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] é o endereço IPv6 localhost.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 são considerados localhost para IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

export function register(config?: Config): void {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // O construtor URL está disponível em todos os navegadores que suportam SW.
    const publicUrl = new URL(process.env.PUBLIC_URL || '', window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Nosso service worker não funcionará se PUBLIC_URL estiver em uma origem diferente
      // da origem da nossa página. Isso pode acontecer se um CDN for usado para
      // servir ativos; veja https://github.com/facebook/create-react-app/issues/2374
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // Isso está sendo executado no localhost. Vamos verificar se um service worker ainda existe ou não.
        checkValidServiceWorker(swUrl, config);

        // Adicione algum registro adicional ao localhost, apontando os desenvolvedores para o
        // documentação do service worker/PWA.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'Este aplicativo web está sendo servido em cache primeiro por um service worker. ' +
              'Para saber mais, visite https://cra.link/PWA'
          );
        });
      } else {
        // Não é localhost. Apenas registre o service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl: string, config?: Config): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Neste ponto, o conteúdo pré-armazenado em cache atualizado foi buscado,
              // mas o service worker anterior ainda servirá o conteúdo mais antigo
              // até que todas as guias do cliente sejam fechadas.
              console.log(
                'Novo conteúdo está disponível e será usado quando todas as ' +
                  'guias para esta página forem fechadas. Veja https://cra.link/PWA.'
              );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // Neste ponto, tudo foi pré-armazenado em cache.
              // É o momento perfeito para exibir uma mensagem
              // "O conteúdo está armazenado em cache para uso offline."
              console.log('O conteúdo está armazenado em cache para uso offline.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Erro durante o registro do service worker:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config): void {
  // Verifique se o service worker pode ser encontrado. Se não puder recarregue a página.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Certifique-se de que o service worker existe e que realmente estamos obtendo um arquivo JS.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Nenhum service worker encontrado. Provavelmente um aplicativo diferente. Recarregue a página.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker encontrado. Proceda normalmente.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('Nenhuma conexão com a internet encontrada. O aplicativo está sendo executado no modo offline.');
    });
}

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

// Função para mostrar notificação de atualização disponível
export function showUpdateNotification(registration: ServiceWorkerRegistration): void {
  // Verificar se o navegador suporta notificações
  if (!('Notification' in window)) {
    console.log('Este navegador não suporta notificações de desktop');
    return;
  }

  // Verificar se já temos permissão
  if (Notification.permission === 'granted') {
    // Criar notificação
    const notification = new Notification('Atualização Disponível', {
      body: 'Uma nova versão do G-Log está disponível. Clique para atualizar.',
      icon: '/icon-192x192.png',
    });

    notification.onclick = () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      notification.close();
      window.location.reload();
    };
  } else if (Notification.permission !== 'denied') {
    // Pedir permissão
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        showUpdateNotification(registration);
      }
    });
  }
}

// Função para criar um componente de UI para notificar sobre atualizações
export function createUpdateUI(registration: ServiceWorkerRegistration): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.left = '0';
  container.style.right = '0';
  container.style.backgroundColor = '#1E3A8A';
  container.style.color = 'white';
  container.style.padding = '12px';
  container.style.display = 'flex';
  container.style.justifyContent = 'space-between';
  container.style.alignItems = 'center';
  container.style.zIndex = '9999';
  container.style.boxShadow = '0 -2px 10px rgba(0, 0, 0, 0.1)';
  
  const message = document.createElement('div');
  message.textContent = 'Nova versão disponível!';
  
  const buttonContainer = document.createElement('div');
  
  const updateButton = document.createElement('button');
  updateButton.textContent = 'Atualizar agora';
  updateButton.style.backgroundColor = 'white';
  updateButton.style.color = '#1E3A8A';
  updateButton.style.border = 'none';
  updateButton.style.padding = '8px 16px';
  updateButton.style.borderRadius = '4px';
  updateButton.style.marginLeft = '8px';
  updateButton.style.cursor = 'pointer';
  
  updateButton.onclick = () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };
  
  const laterButton = document.createElement('button');
  laterButton.textContent = 'Mais tarde';
  laterButton.style.backgroundColor = 'transparent';
  laterButton.style.color = 'white';
  laterButton.style.border = '1px solid white';
  laterButton.style.padding = '8px 16px';
  laterButton.style.borderRadius = '4px';
  laterButton.style.cursor = 'pointer';
  
  laterButton.onclick = () => {
    document.body.removeChild(container);
  };
  
  buttonContainer.appendChild(laterButton);
  buttonContainer.appendChild(updateButton);
  
  container.appendChild(message);
  container.appendChild(buttonContainer);
  
  return container;
} 