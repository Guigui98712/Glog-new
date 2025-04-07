# Script para corrigir as versões do Java nos arquivos de build do Capacitor

Write-Host "Corrigindo versões do Java nos arquivos de configuração do Capacitor..."

# Função para corrigir versão do Java em um arquivo
function Fix-JavaVersion {
    param (
        [string]$filePath
    )
    
    if (Test-Path $filePath) {
        # Ler o conteúdo do arquivo
        $content = Get-Content $filePath -Raw
        
        # Substituir VERSION_21 por VERSION_17
        $updatedContent = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
        
        # Salvar o arquivo atualizado
        Set-Content -Path $filePath -Value $updatedContent
        
        Write-Host "✅ Versão do Java corrigida em $filePath"
    } else {
        Write-Host "❌ Arquivo não encontrado: $filePath"
    }
}

# Corrigir no módulo principal do Capacitor
Fix-JavaVersion "node_modules/@capacitor/android/capacitor/build.gradle"

# Corrigir nos plugins
Fix-JavaVersion "node_modules/@capacitor/browser/android/build.gradle"
Fix-JavaVersion "node_modules/@capacitor/filesystem/android/build.gradle"
Fix-JavaVersion "node_modules/@capacitor/share/android/build.gradle"

# Corrigir nos arquivos do projeto Android
Fix-JavaVersion "android/capacitor-cordova-android-plugins/build.gradle"
Fix-JavaVersion "android/app/capacitor.build.gradle"

Write-Host "Verificação e correção da versão do Java concluídas!" 