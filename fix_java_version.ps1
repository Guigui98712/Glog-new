# Script para atualizar as versões do Java em todos os arquivos build.gradle
Write-Host "Atualizando a versão do Java em todos os arquivos build.gradle..."

# Obter todos os arquivos build.gradle
$gradleFiles = Get-ChildItem -Path "android" -Recurse -Include "*.gradle" -File

foreach ($file in $gradleFiles) {
    Write-Host "Processando arquivo: $($file.FullName)"
    
    # Ler o conteúdo do arquivo
    $content = Get-Content -Path $file.FullName -Raw
    
    # Substituir VERSION_21 por VERSION_17
    $newContent = $content -replace "JavaVersion\.VERSION_21", "JavaVersion.VERSION_17"
    
    # Se o conteúdo foi alterado, salvar o arquivo
    if ($content -ne $newContent) {
        Write-Host "  - Atualizando versão do Java de 21 para 17"
        Set-Content -Path $file.FullName -Value $newContent
    }
}

# Adicionar configuração global ao arquivo gradle.properties
$gradlePropertiesPath = "android/gradle.properties"
$gradleProperties = Get-Content -Path $gradlePropertiesPath -Raw
$javaHomeConfig = "org.gradle.java.home=C:\\Program Files\\Java\\jdk-17.0.14"

if (-not ($gradleProperties -match $javaHomeConfig)) {
    Write-Host "Adicionando configuração do Java Home ao gradle.properties"
    Add-Content -Path $gradlePropertiesPath -Value "`n# Configuração para forçar o uso do Java 17`n$javaHomeConfig"
}

Write-Host "Processo concluído!" 