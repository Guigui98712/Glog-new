# Instruções para Build do APK - GLog

## Status do Projeto ✅

O projeto está **pronto para build** com todas as seguintes melhorias implementadas:

### Melhorias Recentes
- ✅ Correção do botão "Gerar Código" no Almoxarifado
- ✅ Lista de materiais organizada por categoria
- ✅ Responsividade mobile otimizada
- ✅ Build web concluído com sucesso
- ✅ Sincronização Capacitor concluída

### Versão Atual
- **Versão**: 1.0.19
- **Build**: f100251
- **Data**: 04/02/2026

## Passo a Passo para Gerar APK

### 1. Verificar Ambiente

```powershell
# Verificar versão do Node.js (deve ser 16+)
node --version

# Verificar Android SDK
$env:ANDROID_HOME
```

### 2. Build do Projeto (Já Concluído)

O projeto já foi buildado. Se precisar rebuildar:

```powershell
npm run build
npx cap sync
```

### 3. Gerar APK de Debug

```powershell
cd android
.\gradlew.bat assembleDebug
cd ..
```

**Local do APK**: `android\app\build\outputs\apk\debug\app-debug.apk`

### 4. Gerar APK de Release (Assinado)

**Importante**: Configure a senha do keystore no arquivo `android\app\build.gradle` linha 23:

```gradle
signingConfigs {
    release {
        storeFile file("../keystore/glog-release-key.keystore")
        storePassword "SUA_SENHA_AQUI"
        keyAlias "gogkey"
        keyPassword "juremashouse987"
    }
}
```

Depois execute:

```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
```

**Local do APK**: `android\app\build\outputs\apk\release\app-release.apk`

### 5. Instalar no Dispositivo

```powershell
# Via ADB (dispositivo conectado via USB)
adb install android\app\build\outputs\apk\debug\app-debug.apk

# Ou transfira o APK manualmente para o dispositivo
```

## Configuração do Keystore (Para Release)

Se ainda não tem o keystore configurado:

```powershell
# Criar novo keystore
keytool -genkey -v -keystore android\keystore\glog-release-key.keystore -alias gogkey -keyalg RSA -keysize 2048 -validity 10000
```

## Verificação de Plugins Capacitor

```powershell
npm run cap:check-plugins
```

**Plugins Instalados** (8):
- @capacitor/app@6.0.2
- @capacitor/browser@6.0.5
- @capacitor/camera@6.1.2
- @capacitor/device@6.0.2
- @capacitor/filesystem@6.0.3
- @capacitor/local-notifications@6.1.2
- @capacitor/push-notifications@6.0.4
- @capacitor/share@6.0.3

## Solução de Problemas

### Erro: "Port 8083 already in use"
```powershell
taskkill /F /IM node.exe
```

### Erro: Gradle build failed
```powershell
# Limpar cache do Gradle
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

### Erro: SDK não encontrado
Certifique-se que `ANDROID_HOME` está configurado:
```powershell
# Adicionar variável de ambiente
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk", "User")
```

## Tamanho dos Chunks

⚠️ **Aviso**: Alguns chunks estão maiores que 1MB. Isso é normal para a primeira versão, mas considere otimizar no futuro.

## Recursos Mobile Implementados

### Responsividade
- ✅ Header adapta para telas pequenas (stack vertical)
- ✅ Botões com texto responsivo
- ✅ Tabelas com scroll horizontal
- ✅ Cards ajustáveis
- ✅ Inputs full-width em mobile

### Funcionalidades Mobile
- ✅ Toque otimizado
- ✅ Navegação por gestos
- ✅ Teclado virtual compatível
- ✅ Compartilhamento nativo
- ✅ Câmera integrada
- ✅ Notificações locais

## Próximos Passos Sugeridos

1. Testar o APK em dispositivos físicos
2. Verificar performance em dispositivos de entrada
3. Otimizar tamanho dos chunks se necessário
4. Configurar notificações push (se planejado)
5. Preparar para publicação na Play Store

## Links Úteis

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio](https://developer.android.com/studio)
- [Guia de Assinatura Android](https://developer.android.com/studio/publish/app-signing)

---

**Última Atualização**: 04/02/2026
**Commit**: f100251
