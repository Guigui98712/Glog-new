@echo off
echo Configurando ambiente para Java 8 e compilando o projeto...

echo 1. Verificando a versão do Java...
java -version

echo 2. Removendo diretórios de build...
rmdir /s /q android\app\build
rmdir /s /q android\build

echo 3. Sincronizando projeto com Capacitor...
call npx cap sync android

echo 4. Navegando para o diretório Android...
cd android

echo 5. Limpando projeto com Gradle...
call gradlew clean

echo 6. Compilando APK de debug...
call gradlew assembleDebug

echo 7. Verificando se o APK foi gerado...
if exist app\build\outputs\apk\debug\app-debug.apk (
    echo APK gerado com sucesso em:
    echo %CD%\app\build\outputs\apk\debug\app-debug.apk
    
    echo 8. Renomeando APK para G-Log.apk...
    copy app\build\outputs\apk\debug\app-debug.apk app\build\outputs\apk\debug\G-Log.apk
    echo APK renomeado para G-Log.apk em:
    echo %CD%\app\build\outputs\apk\debug\G-Log.apk
) else (
    echo Falha ao gerar o APK. Verifique os erros acima.
)

cd ..
echo Processo concluído! 