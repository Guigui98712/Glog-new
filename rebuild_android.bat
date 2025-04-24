@echo off
echo Limpando e reconstruindo o projeto Android...

echo 1. Removendo diretórios de build...
rmdir /s /q android\app\build
rmdir /s /q android\.gradle
rmdir /s /q android\build

echo 2. Verificando e removendo pacotes antigos...
if exist android\app\src\main\java\com\obratracker (
    echo Removendo pacote antigo obratracker...
    rmdir /s /q android\app\src\main\java\com\obratracker
)

echo 3. Sincronizando projeto com Capacitor...
call npx cap sync android

echo 4. Verificando arquivos de recursos...
if not exist android\app\src\main\res\values\colors.xml (
    echo Criando arquivo colors.xml...
    echo ^<?xml version="1.0" encoding="utf-8"?^> > android\app\src\main\res\values\colors.xml
    echo ^<resources^> >> android\app\src\main\res\values\colors.xml
    echo     ^<color name="colorPrimary"^>#1E3A8A^</color^> >> android\app\src\main\res\values\colors.xml
    echo     ^<color name="colorPrimaryDark"^>#1E3A8A^</color^> >> android\app\src\main\res\values\colors.xml
    echo     ^<color name="colorAccent"^>#2563EB^</color^> >> android\app\src\main\res\values\colors.xml
    echo     ^<color name="ic_launcher_background"^>#1E3A8A^</color^> >> android\app\src\main\res\values\colors.xml
    echo ^</resources^> >> android\app\src\main\res\values\colors.xml
)

if not exist android\app\src\main\res\drawable\splash.xml (
    echo Criando arquivo splash.xml...
    if not exist android\app\src\main\res\drawable (
        mkdir android\app\src\main\res\drawable
    )
    echo ^<?xml version="1.0" encoding="utf-8"?^> > android\app\src\main\res\drawable\splash.xml
    echo ^<layer-list xmlns:android="http://schemas.android.com/apk/res/android"^> >> android\app\src\main\res\drawable\splash.xml
    echo     ^<item android:drawable="@color/colorPrimary" /^> >> android\app\src\main\res\drawable\splash.xml
    echo     ^<item^> >> android\app\src\main\res\drawable\splash.xml
    echo         ^<bitmap >> android\app\src\main\res\drawable\splash.xml
    echo             android:gravity="center" >> android\app\src\main\res\drawable\splash.xml
    echo             android:src="@mipmap/ic_launcher_foreground" /^> >> android\app\src\main\res\drawable\splash.xml
    echo     ^</item^> >> android\app\src\main\res\drawable\splash.xml
    echo ^</layer-list^> >> android\app\src\main\res\drawable\splash.xml
)

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