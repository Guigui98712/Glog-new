@echo off
echo Assinando o APK do G Log...

set KEYSTORE_FILE=glog.keystore
set KEYSTORE_PASS=glogapp
set KEY_ALIAS=glogkey
set KEY_PASS=glogapp
set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk
set SIGNED_APK_PATH=android\app\build\outputs\apk\debug\G-Log-signed.apk

echo 1. Verificando se o APK existe...
if not exist %APK_PATH% (
    echo APK não encontrado em %APK_PATH%
    echo Execute rebuild_android.bat primeiro para gerar o APK.
    exit /b 1
)

echo 2. Verificando se o keystore existe...
if not exist %KEYSTORE_FILE% (
    echo Keystore não encontrado. Criando novo keystore...
    keytool -genkey -v -keystore %KEYSTORE_FILE% -alias %KEY_ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %KEYSTORE_PASS% -keypass %KEY_PASS% -dname "CN=G Log, OU=Development, O=G Log, L=Cidade, S=Estado, C=BR"
)

echo 3. Assinando o APK...
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore %KEYSTORE_FILE% -storepass %KEYSTORE_PASS% -keypass %KEY_PASS% %APK_PATH% %KEY_ALIAS%

echo 4. Verificando a assinatura...
jarsigner -verify -verbose -certs %APK_PATH%

echo 5. Otimizando o APK...
zipalign -v 4 %APK_PATH% %SIGNED_APK_PATH%

echo 6. APK assinado e otimizado gerado em:
echo %SIGNED_APK_PATH%

echo Processo concluído! 