# Guia para Gerar e Instalar o APK do G Log

Este guia fornece instruções detalhadas para gerar e instalar corretamente o APK do G Log, resolvendo problemas comuns de instalação.

## Gerando o APK

### Método 1: Usando o Script Automatizado (Recomendado)

1. **Execute o script de reconstrução**:
   ```bash
   rebuild_android.bat
   ```

   Este script irá:
   - Limpar os diretórios de build
   - Remover pacotes antigos que podem causar conflitos
   - Sincronizar o projeto com o Capacitor
   - Verificar e criar arquivos de recursos necessários
   - Compilar o APK
   - Renomear o APK para G-Log.apk

2. **Assine o APK para melhor compatibilidade**:
   ```bash
   sign_apk.bat
   ```

   Este script irá:
   - Criar um keystore se não existir
   - Assinar o APK com a chave
   - Otimizar o APK
   - Gerar um APK assinado em `android/app/build/outputs/apk/debug/G-Log-signed.apk`

### Método 2: Usando o Android Studio

1. **Abra o projeto no Android Studio**:
   ```bash
   npm run cap:open:android
   ```

2. **Aguarde o Android Studio abrir e indexar o projeto**

3. **Limpe o projeto**:
   - Clique em **Build** > **Clean Project**
   - Aguarde a conclusão

4. **Sincronize o projeto com o Gradle**:
   - Clique em **File** > **Sync Project with Gradle Files**
   - Aguarde a conclusão da sincronização

5. **Gere o APK de Debug**:
   - Clique em **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
   - Aguarde a conclusão da compilação
   - Clique em "locate" na notificação para encontrar o APK

### Método 3: Usando a Linha de Comando

Se você tiver o ambiente Java configurado corretamente:

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

O APK será gerado em:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Instalando o APK

### Preparação do Dispositivo

1. **Desinstale versões anteriores do aplicativo**:
   - Vá para **Configurações** > **Aplicativos**
   - Procure por "G Log" ou aplicativos com nomes similares (como "obra tracker")
   - Desinstale completamente

2. **Limpe o cache do gerenciador de pacotes**:
   - Vá para **Configurações** > **Aplicativos** > **Ver todos os aplicativos**
   - Toque no ícone de menu (⋮) e selecione **Mostrar sistema**
   - Encontre "Gerenciador de pacotes" ou "Package Installer"
   - Toque em **Armazenamento** > **Limpar cache**

3. **Habilite a instalação de fontes desconhecidas**:
   - Vá para **Configurações** > **Segurança** (ou **Segurança e privacidade**)
   - Ative a opção **Fontes desconhecidas** ou **Instalar aplicativos desconhecidos**
   - Em Android 8.0+, você precisa habilitar isso para cada aplicativo que usa para instalar APKs

4. **Desative temporariamente o Google Play Protect**:
   - Abra o **Google Play Store**
   - Toque no ícone do seu perfil
   - Vá para **Play Protect**
   - Toque no ícone de engrenagem (⚙️)
   - Desative temporariamente a opção **Verificar aplicativos**

### Instalação do APK

1. **Escolha o APK correto**:
   - Use preferencialmente o APK assinado: `G-Log-signed.apk`
   - Ou use o APK renomeado: `G-Log.apk`
   - Em último caso, use o APK padrão: `app-debug.apk`

2. **Transfira o APK para o dispositivo**:
   - Use um cabo USB
   - Ou envie por e-mail, WhatsApp, etc.

3. **Instale o APK**:
   - Localize o arquivo no dispositivo
   - Toque nele para iniciar a instalação
   - Se aparecer um aviso, toque em **Mais detalhes** e depois em **Instalar mesmo assim**

## Solução de Problemas

### Erro "Não foi possível instalar por causa de um erro interno"

1. **Verifique o nome do pacote**:
   - Certifique-se de que o APK está sendo gerado com o pacote correto: `com.glog.app`
   - Verifique se não há conflitos entre o pacote antigo (`com.obratracker.app`) e o novo

2. **Use o APK assinado**:
   - Tente instalar o APK assinado gerado pelo script `sign_apk.bat`
   - A assinatura pode resolver problemas de verificação de integridade

3. **Reinicie o dispositivo**:
   - Desligue e ligue novamente o dispositivo
   - Tente instalar o APK novamente

### Erro "Aplicativo não instalado"

1. **Verifique o espaço de armazenamento**:
   - Certifique-se de que há espaço suficiente no dispositivo

2. **Verifique a versão do Android**:
   - O aplicativo requer Android 5.1 (API 22) ou superior

3. **Tente instalar via ADB** (para usuários avançados):
   ```bash
   adb install -r -t android/app/build/outputs/apk/debug/G-Log-signed.apk
   ```
   
   Se ocorrer um erro específico, use o comando com mais detalhes:
   ```bash
   adb install -r -t -d android/app/build/outputs/apk/debug/G-Log-signed.apk
   ```

   Para ver o erro específico:
   ```bash
   adb install -r -t -d android/app/build/outputs/apk/debug/G-Log-signed.apk
   ```

### Erro "INSTALL_FAILED_UPDATE_INCOMPATIBLE"

Este erro ocorre quando você tenta instalar um APK com o mesmo nome de pacote, mas assinado com uma chave diferente:

1. **Desinstale completamente o aplicativo anterior**:
   - Vá para **Configurações** > **Aplicativos**
   - Encontre o aplicativo e desinstale-o
   - Reinicie o dispositivo

2. **Limpe os dados do aplicativo**:
   - Se a desinstalação não for suficiente, vá para **Configurações** > **Aplicativos**
   - Encontre o aplicativo (se ainda estiver listado)
   - Toque em **Armazenamento** > **Limpar dados** e **Limpar cache**

## Após a Instalação

1. **Reative o Google Play Protect**:
   - Não se esqueça de reativar para manter seu dispositivo seguro

2. **Teste o aplicativo**:
   - Verifique se todas as funcionalidades estão funcionando corretamente

3. **Reporte problemas**:
   - Se encontrar problemas, anote os detalhes para ajudar na solução 