# Script para testar o verificador ortográfico no APK Android
# Este script constrói uma versão do APK com configurações de depuração
# para verificar se o corretor ortográfico está funcionando corretamente

Write-Host "Preparando ambiente para teste do corretor ortográfico no APK..." -ForegroundColor Cyan

# Verifica se os arquivos de dicionário existem
if (-not (Test-Path "public/dictionaries/pt.aff") -or -not (Test-Path "public/dictionaries/pt.dic")) {
    Write-Host "ERRO: Arquivos de dicionário não encontrados em public/dictionaries/" -ForegroundColor Red
    Write-Host "      Verifique se os arquivos pt.aff e pt.dic existem neste diretório." -ForegroundColor Red
    exit 1
}

# Construir o projeto com logs de depuração adicionais
Write-Host "1. Construindo projeto com logs de depuração adicionais..." -ForegroundColor Yellow
npm run build:dev

# Sincronizar com o Capacitor
Write-Host "2. Sincronizando com o Capacitor..." -ForegroundColor Yellow
npx cap sync

# Copiar dicionários para o diretório apropriado
Write-Host "3. Copiando dicionários para o APK..." -ForegroundColor Yellow
node setup-dictionaries.cjs

# Adicionar logs extras para o verificador ortográfico (temporário)
Write-Host "4. Adicionando logs de depuração extras ao corretor ortográfico..." -ForegroundColor Yellow
((Get-Content -Path "src/hooks/useSpellChecker.ts" -Raw) -replace "// Criar a instância do nspell com os buffers", "// Criar a instância do nspell com os buffers`n    console.log('DEBUG SPELLCHECK: Tentando criar instância nspell');") | Set-Content -Path "src/hooks/useSpellChecker.ts"

# Construir novamente com logs extras
npm run build:dev
npx cap sync

# Construir o APK de depuração
Write-Host "5. Construindo APK de depuração..." -ForegroundColor Yellow
cd android
./gradlew.bat assembleDebug
cd ..

Write-Host "`nAPK de depuração gerado com sucesso!" -ForegroundColor Green
Write-Host "Para testar o corretor ortográfico, instale o APK em um dispositivo e:" -ForegroundColor Cyan
Write-Host "1. Abra o app e navegue até uma tela com campo de texto" -ForegroundColor White
Write-Host "2. Escreva palavras com erros ortográficos (ex: 'caza', 'çidade')" -ForegroundColor White
Write-Host "3. Use o botão 'Verificar ortografia' para testar a funcionalidade" -ForegroundColor White
Write-Host "4. Verifique no Android Studio -> Logcat os logs com 'DEBUG SPELLCHECK'" -ForegroundColor White
Write-Host "`nLocalização do APK: android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Magenta 