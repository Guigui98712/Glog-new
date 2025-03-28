@echo off
echo Iniciando geração do APK G-Log...

:: Verificar e configurar o ambiente
echo 1. Configurando ambiente...

:: Detectar o Java instalado
for /f "tokens=*" %%i in ('powershell -Command "Get-ChildItem -Path 'C:\Program Files\Java' -Directory | Where-Object { $_.Name -like '*zulu*' -or $_.Name -like '*jdk*' } | Select-Object -First 1 -ExpandProperty FullName"') do set DETECTED_JAVA_HOME=%%i

echo Usando Java em: %DETECTED_JAVA_HOME%

:: Configurar Android SDK
set ANDROID_HOME=C:\Users\guica\AppData\Local\Android\Sdk

:: Limpar diretórios de build
echo 2. Limpando diretórios de build anteriores...
if exist android\app\build rmdir /s /q android\app\build
if exist android\build rmdir /s /q android\build
if exist android\.gradle rmdir /s /q android\.gradle

:: Criar pasta android/app se não existir
if not exist android\app mkdir android\app

:: Configurar arquivos necessários
echo 3. Configurando arquivos de propriedades...

:: Criar local.properties sem espaços extras
echo sdk.dir=%ANDROID_HOME%> android\local.properties

:: Remover qualquer config.properties existente
if exist android\.gradle\config.properties del android\.gradle\config.properties

:: Verificar se capacitor.build.gradle existe e corrigir as versões do Java
echo 4. Corrigindo versões do Java nos arquivos de configuração...

:: Criar um arquivo gradle.properties atualizado
echo # Project-wide Gradle settings.> android\gradle.properties
echo org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8>> android\gradle.properties
echo android.useAndroidX=true>> android\gradle.properties
echo android.enableJetifier=true>> android\gradle.properties
echo android.nonTransitiveRClass=true>> android\gradle.properties
echo org.gradle.configuration-cache=true>> android\gradle.properties

:: Executar o script PowerShell para corrigir referências ao Java 21
powershell -ExecutionPolicy Bypass -File fix_capacitor_plugins.ps1

:: Construir o aplicativo web
echo 5. Compilando a aplicação web...
call npm run build

:: Sincronizar com o Capacitor
echo 6. Sincronizando com o Capacitor...
call npx cap sync android

:: Compilar o APK
echo 7. Compilando o APK usando o Java detectado...
cd android

:: Configurar variável JAVA_HOME para o Gradle
set JAVA_HOME=%DETECTED_JAVA_HOME%
echo Configurando JAVA_HOME para Gradle: %JAVA_HOME%

call gradlew clean --no-daemon
call gradlew assembleDebug --no-daemon --info

:: Verificar se o APK foi gerado e renomear
echo 8. Verificando APK gerado...
if exist app\build\outputs\apk\debug\app-debug.apk (
    echo APK gerado com sucesso em:
    echo %CD%\app\build\outputs\apk\debug\app-debug.apk
    
    echo 9. Renomeando APK para G-Log.apk...
    copy app\build\outputs\apk\debug\app-debug.apk app\build\outputs\apk\debug\G-Log.apk
    echo APK renomeado para G-Log.apk em:
    echo %CD%\app\build\outputs\apk\debug\G-Log.apk
) else (
    echo Falha ao gerar o APK. Verifique os erros acima.
)

cd ..
echo Processo concluído! 