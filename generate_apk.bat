@echo off
echo Iniciando geração do APK G-Log...

:: Verificar e configurar o ambiente
echo 1. Configurando ambiente...
set JAVA_HOME=
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

:: Criar local.properties
echo sdk.dir=%ANDROID_HOME%> android\local.properties

:: Verificar se capacitor.build.gradle existe e corrigir as versões do Java
echo 4. Corrigindo versões do Java nos arquivos de configuração...
powershell -Command "$content = Get-Content 'android\app\capacitor.build.gradle' -Raw -ErrorAction SilentlyContinue; if ($content) { $content = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'; Set-Content -Path 'android\app\capacitor.build.gradle' -Value $content }"

powershell -Command "$content = Get-Content 'android\capacitor-cordova-android-plugins\build.gradle' -Raw -ErrorAction SilentlyContinue; if ($content) { $content = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'; Set-Content -Path 'android\capacitor-cordova-android-plugins\build.gradle' -Value $content }"

:: Construir o aplicativo web
echo 5. Compilando a aplicação web...
call npm run build

:: Sincronizar com o Capacitor
echo 6. Sincronizando com o Capacitor...
call npx cap sync android

:: Compilar o APK
echo 7. Compilando o APK...
cd android
call gradlew clean
call gradlew assembleDebug --info

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