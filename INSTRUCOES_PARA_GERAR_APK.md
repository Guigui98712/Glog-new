# Instruções para Gerar o APK do G-Log

Devido a problemas com a compilação via linha de comando, recomendamos gerar o APK diretamente pelo Android Studio. Siga os passos abaixo:

## Preparação do Ambiente

1. **Instale o Android Studio**
   - Baixe e instale a versão mais recente do [Android Studio](https://developer.android.com/studio)

2. **Preparação do Projeto**
   ```bash
   # Instale as dependências
   npm install
   
   # Compile o aplicativo web para produção
   npm run build
   
   # Sincronize com o Capacitor
   npx cap sync android
   ```

## Importação e Compilação no Android Studio

3. **Abra o Projeto no Android Studio**
   - Abra o Android Studio
   - Selecione "Open an Existing Project"
   - Navegue até a pasta `android` do seu projeto G-Log
   - Selecione a pasta e clique em "OK"

4. **Resolva Problemas de Configuração**
   - Se o Android Studio detectar problemas, clique em "Fix" para resolvê-los automaticamente
   - Se solicitado, atualize o Android Gradle Plugin

5. **Configure o Java 17**
   - Vá em File > Project Structure
   - Na seção "SDK Location", verifique se o "JDK Location" está apontando para uma versão do Java 17
   - Caso não esteja, clique no botão "..." e selecione a instalação do Java 17

6. **Correção de arquivos de build**
   - Abra os seguintes arquivos no Android Studio e verifique se estão usando Java 17:
     - `app/build.gradle`
     - `app/capacitor.build.gradle`
     - `capacitor-cordova-android-plugins/build.gradle`
   - Se encontrar `JavaVersion.VERSION_21`, substitua por `JavaVersion.VERSION_17`

7. **Limpeza e Compilação**
   - No menu, vá em Build > Clean Project
   - Depois, vá em Build > Rebuild Project

8. **Gerar o APK**
   - No menu, vá em Build > Build Bundle(s) / APK(s) > Build APK(s)
   - Ou, alternativamente:
     - No menu, vá em Build > Generate Signed Bundle / APK
     - Selecione "APK"
     - Configure uma chave de assinatura (ou use a existente)
     - Selecione "Debug" ou "Release" conforme necessário
     - Clique em "Finish"

9. **Localizar o APK Gerado**
   - Um pop-up aparecerá quando o APK for gerado com sucesso
   - Clique em "locate" para abrir a pasta onde o APK foi gerado
   - O caminho típico é: `android/app/build/outputs/apk/debug/app-debug.apk`

## Instalação no Dispositivo

10. **Instalar o APK**
    - Transfira o APK para o dispositivo Android por cabo USB ou compartilhamento de arquivo
    - No dispositivo, abra o gerenciador de arquivos, navegue até o APK e toque nele para instalar
    - Pode ser necessário permitir a instalação de aplicativos de fontes desconhecidas

## Solução de Problemas

Se você encontrar erros relacionados a versões do Java:
- Certifique-se de que o Java 17 está instalado no seu computador
- Verifique se todos os arquivos de build estão configurados para usar JavaVersion.VERSION_17
- Remova as pastas `.gradle` e `build` e tente novamente

Se você encontrar erros relacionados ao SDK Android:
- Verifique se o Android SDK está corretamente instalado
- No Android Studio, vá em File > Settings > Appearance & Behavior > System Settings > Android SDK
- Certifique-se de que SDK Platform 33 ou superior esteja instalado 