# Guia para Geração do APK do G-Log

Este guia fornece instruções passo a passo para gerar o arquivo APK do aplicativo G-Log para Android.

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

1. **Node.js** (versão 16 ou superior)
2. **npm** (normalmente vem com o Node.js)
3. **Android Studio** com:
   - Android SDK Platform 33 (Android 13) ou superior
   - Android SDK Build-Tools 33.0.0 ou superior
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools

## Configuração do Ambiente

1. **Variáveis de Ambiente**:
   - Adicione `ANDROID_HOME` às suas variáveis de ambiente, apontando para o diretório do Android SDK
   - Adicione `%ANDROID_HOME%\platform-tools` ao seu PATH

## Passos para Gerar o APK

### 1. Preparação do Projeto

```bash
# Instale as dependências do projeto
npm install

# Verifique e instale os plugins necessários do Capacitor
npm run cap:check-plugins
```

### 2. Construção do Aplicativo Web

```bash
# Construa o aplicativo web otimizado para produção
npm run build
```

### 3. Sincronização com o Capacitor

```bash
# Sincronize o código web com o projeto Android
npm run cap:sync
```

### 4. Geração do APK de Debug

```bash
# Gere um APK de debug (para testes)
npm run cap:build:android
```

O APK de debug será gerado em:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Geração do APK de Release (para publicação)

Para gerar um APK de release, você precisa configurar a assinatura do aplicativo:

1. **Configure a keystore**:
   - Edite o arquivo `android/app/build.gradle` e configure a seção `signingConfigs`
   - Ou edite o arquivo `capacitor.config.ts` e configure as opções de `buildOptions`

2. **Gere o APK assinado**:
```bash
npm run cap:build:android:release
```

O APK de release será gerado em:
`android/app/build/outputs/apk/release/app-release.apk`

## Solução de Problemas

### Erro de Porta em Uso

Se você encontrar um erro indicando que a porta 8083 está em uso:

```bash
# Encerre todos os processos Node.js
taskkill /F /IM node.exe
```

### Erro de Compilação do Android

Se encontrar erros durante a compilação do Android:

1. Abra o projeto no Android Studio:
```bash
npm run cap:open:android
```

2. Verifique os erros no Android Studio e corrija conforme necessário

## Testando o APK

1. **Instale o APK em um dispositivo Android**:
   - Conecte seu dispositivo Android via USB
   - Habilite a depuração USB nas opções de desenvolvedor
   - Execute: `npm run cap:run:android`

2. **Ou use um emulador**:
   - Crie um dispositivo virtual no Android Studio
   - Execute: `npm run cap:run:android`

## Publicação na Google Play Store

Para publicar o aplicativo na Google Play Store:

1. Crie uma conta de desenvolvedor na Google Play Console
2. Crie um novo aplicativo e configure os detalhes
3. Faça upload do APK de release assinado
4. Preencha todos os detalhes necessários (descrição, capturas de tela, etc.)
5. Publique o aplicativo

## Comandos Úteis

- `npm run cap:open:android` - Abre o projeto no Android Studio
- `npm run cap:run:android` - Executa o aplicativo em um dispositivo conectado ou emulador
- `npm run cap:sync` - Sincroniza as alterações do código web com o projeto Android
- `npm run cap:build` - Constrói o aplicativo web e sincroniza com o Capacitor 