# Script para corrigir as versões do Java nos plugins do Capacitor
Write-Host "Corrigindo versões do Java nos plugins do Capacitor..."

# Função para corrigir arquivos build.gradle
function Fix-JavaVersion {
    param (
        [string]$filePath
    )
    
    if (Test-Path $filePath) {
        Write-Host "Processando: $filePath"
        $content = Get-Content -Path $filePath -Raw
        $newContent = $content -replace "JavaVersion\.VERSION_21", "JavaVersion.VERSION_17"
        
        if ($content -ne $newContent) {
            Write-Host "  - Atualizando versão do Java de 21 para 17"
            Set-Content -Path $filePath -Value $newContent
        }
        else {
            Write-Host "  - Arquivo já está usando Java 17 ou não contém referências a VERSION_21"
        }
    }
    else {
        Write-Host "  - Arquivo não encontrado: $filePath"
    }
}

# Corrigir arquivos principais
Fix-JavaVersion -filePath "android\app\capacitor.build.gradle"
Fix-JavaVersion -filePath "android\capacitor-cordova-android-plugins\build.gradle"

# Procurar plugins em android/app/src/main/assets/capacitor.plugins.json
$pluginsJsonPath = "android\app\src\main\assets\capacitor.plugins.json"
if (Test-Path $pluginsJsonPath) {
    Write-Host "Analisando plugins registrados em capacitor.plugins.json..."
    $pluginsJson = Get-Content -Path $pluginsJsonPath -Raw | ConvertFrom-Json
    
    foreach ($plugin in $pluginsJson) {
        $pluginPath = $plugin.id -replace "/", "\"
        $pluginBuildGradle = "android\$pluginPath\build.gradle"
        
        Fix-JavaVersion -filePath $pluginBuildGradle
    }
}

# Procurar diretamente nos diretórios
$pluginDirs = @(
    "android\capacitor-live-updates",
    "android\capawesome-capacitor-app-update"
)

foreach ($dir in $pluginDirs) {
    $buildGradlePath = "$dir\build.gradle"
    Fix-JavaVersion -filePath $buildGradlePath
}

# Procurar recursivamente todos os arquivos build.gradle
Write-Host "Procurando recursivamente por arquivos build.gradle em android/..."
$gradleFiles = Get-ChildItem -Path "android" -Recurse -Include "*.gradle" -File

foreach ($file in $gradleFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match "JavaVersion\.VERSION_21") {
        Write-Host "Encontrado VERSION_21 em: $($file.FullName)"
        Fix-JavaVersion -filePath $file.FullName
    }
}

# Verificar e remover config.properties com java.home incorreto
$configPropertiesPath = "android\.gradle\config.properties"
if (Test-Path $configPropertiesPath) {
    $configContent = Get-Content -Path $configPropertiesPath -Raw
    if ($configContent -match "java\.home=") {
        Write-Host "Removendo referência incorreta a java.home em config.properties"
        Remove-Item -Path $configPropertiesPath -Force
    }
}

Write-Host "Processo concluído!" 