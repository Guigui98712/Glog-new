// Arquivo para substituir as chamadas às APIs do Google
// Retorna dados simulados para evitar erros de API key

// Função simulada para Google Drive
export const simulateGoogleDrive = {
  files: {
    list: async () => {
      console.log('Simulando chamada ao Google Drive API');
      return {
        data: {
          files: [
            { id: 'fake-id-1', name: 'Documento 1.pdf' },
            { id: 'fake-id-2', name: 'Documento 2.pdf' }
          ]
        }
      };
    },
    create: async () => {
      console.log('Simulando upload para o Google Drive');
      return {
        data: {
          id: 'fake-upload-id',
          name: 'Arquivo simulado.pdf'
        }
      };
    }
  }
};

// Função simulada para Google Maps
export const simulateGoogleMaps = {
  geocode: async () => {
    console.log('Simulando chamada ao Google Maps API');
    return {
      data: {
        results: [
          {
            formatted_address: 'Endereço simulado, São Paulo - SP, Brasil',
            geometry: {
              location: {
                lat: -23.550520,
                lng: -46.633308
              }
            }
          }
        ]
      }
    };
  }
};

// Função simulada para Google Auth
export const simulateGoogleAuth = {
  signIn: async () => {
    console.log('Simulando autenticação com Google');
    return {
      user: {
        email: 'usuario.simulado@gmail.com',
        name: 'Usuário Simulado',
        picture: 'https://via.placeholder.com/150'
      },
      token: 'fake-token-123456'
    };
  }
};

// Exporta um objeto que intercepta e simula todas as chamadas às APIs do Google
export const googleapisSimulator = {
  drive: simulateGoogleDrive,
  maps: simulateGoogleMaps,
  auth: simulateGoogleAuth
}; 