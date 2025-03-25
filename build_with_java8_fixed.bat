@echo off
echo Configurando ambiente para Java 8 e compilando o projeto...

echo 1. Configurando JAVA_HOME para Java 8...
set JAVA_HOME=C:\Program Files\Java\jre-1.8
echo JAVA_HOME definido como: %JAVA_HOME%

echo 2. Verificando a versão do Java...
"%JAVA_HOME%\bin\java" -version

echo 3. Removendo diretórios de build...
if exist android\app\build rmdir /s /q android\app\build
if exist android\build rmdir /s /q android\build

echo 4. Sincronizando projeto com Capacitor...
call npx cap sync android

echo 5. Navegando para o diretório Android...
cd android

echo 6. Limpando projeto com Gradle...
call gradlew clean

echo 7. Compilando APK de debug...
call gradlew assembleDebug

echo 8. Verificando se o APK foi gerado...
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