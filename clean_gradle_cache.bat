@echo off
echo Limpando o cache do Gradle...

echo 1. Removendo diretório .gradle do projeto...
rmdir /s /q android\.gradle

echo 2. Removendo diretórios de build...
rmdir /s /q android\app\build
rmdir /s /q android\build

echo 3. Removendo cache do Gradle no diretório do usuário...
rmdir /s /q %USERPROFILE%\.gradle\caches\7.6
rmdir /s /q %USERPROFILE%\.gradle\caches\8.9
rmdir /s /q %USERPROFILE%\.gradle\caches\modules-2\files-2.1
rmdir /s /q %USERPROFILE%\.gradle\caches\transforms-3
rmdir /s /q %USERPROFILE%\.gradle\daemon
rmdir /s /q %USERPROFILE%\.gradle\wrapper\dists\gradle-7.6-all
rmdir /s /q %USERPROFILE%\.gradle\wrapper\dists\gradle-8.9-all

echo 4. Sincronizando projeto com Capacitor...
call npx cap sync android

echo 5. Navegando para o diretório Android...
cd android

echo 6. Executando gradlew com a opção --refresh-dependencies...
call gradlew --refresh-dependencies

echo 7. Limpando projeto com Gradle...
call gradlew clean

echo 8. Compilando APK de debug...
call gradlew assembleDebug

echo 9. Verificando se o APK foi gerado...
if exist app\build\outputs\apk\debug\app-debug.apk (
    echo APK gerado com sucesso em:
    echo %CD%\app\build\outputs\apk\debug\app-debug.apk
    
    echo 10. Renomeando APK para G-Log.apk...
    copy app\build\outputs\apk\debug\app-debug.apk app\build\outputs\apk\debug\G-Log.apk
    echo APK renomeado para G-Log.apk em:
    echo %CD%\app\build\outputs\apk\debug\G-Log.apk
) else (
    echo Falha ao gerar o APK. Verifique os erros acima.
)

cd ..
echo Processo concluído! 