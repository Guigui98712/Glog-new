# Guia para Gerar o APK Manualmente no Android Studio

Este guia fornece instruções passo a passo para gerar o APK manualmente no Android Studio, resolvendo o problema do erro "The request is missing a valid API key".

## Passos para Gerar o APK

### 1. Abra o projeto no Android Studio

```bash
npm run cap:open:android
```

### 2. Aguarde o Android Studio abrir e indexar o projeto

Isso pode levar alguns minutos, especialmente na primeira vez.

### 3. Gere o APK de Debug

1. No menu superior, clique em **Build**
2. Selecione **Build Bundle(s) / APK(s)**
3. Clique em **Build APK(s)**

### 4. Localize o APK gerado

Quando a compilação for concluída, você verá uma notificação no canto inferior direito. Clique em "locate" para abrir a pasta onde o APK foi gerado.

O APK geralmente está localizado em:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Instale o APK no seu dispositivo

Transfira o APK para seu dispositivo Android e instale-o.

## Solução de Problemas

### Erro "The request is missing a valid API key"

Este erro ocorre porque o aplicativo está tentando acessar um serviço do Google sem uma chave de API válida. Para resolver:

1. No Android Studio, abra o arquivo `android/app/src/main/assets/capacitor.config.json`
2. Verifique se as configurações de plugins do Google estão desabilitadas ou configuradas corretamente
3. Reconstrua o APK

### Erro de JAVA_HOME

Se você encontrar um erro relacionado ao JAVA_HOME:

1. Verifique se o JDK está instalado corretamente
2. Configure a variável de ambiente JAVA_HOME para apontar para o diretório correto do JDK
3. Reinicie o Android Studio

## Configurações Adicionais

### Habilitar Depuração

Para facilitar a depuração, você pode habilitar o modo de depuração no arquivo `capacitor.config.ts`:

```typescript
android: {
  // ...
  webContentsDebuggingEnabled: true, // Habilitar para depuração
  hideLogs: false, // Mostrar logs para depuração
  // ...
}
```

### Desabilitar Serviços do Google

Se você continuar enfrentando problemas com as APIs do Google, você pode desabilitá-las temporariamente:

1. No arquivo `src/main.tsx`, adicione:
```typescript
// Desabilitar temporariamente as APIs do Google
window.DISABLE_GOOGLE_APIS = true;
```

2. No arquivo `.env`, comente as chaves de API do Google:
```
# VITE_GOOGLE_API_KEY=
# VITE_GOOGLE_CLIENT_ID=
``` 