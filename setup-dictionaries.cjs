const fs = require('fs');
const path = require('path');

/**
 * Script para garantir que os arquivos de dicionário sejam copiados para o app Android
 * Esse script deve ser executado após o "npx cap sync" e antes de gerar o APK
 */

console.log('Configurando arquivos de dicionário para o app...');

const sourceDir = path.join(__dirname, 'public', 'dictionaries');
const targetDirs = [
  // Para o app Android
  path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public', 'dictionaries'),
  // Backup para o diretório raiz de assets
  path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'dictionaries')
];

// Verifica se o diretório fonte existe
if (!fs.existsSync(sourceDir)) {
  console.error(`❌ Diretório de origem não encontrado: ${sourceDir}`);
  process.exit(1);
}

// Copia os arquivos para os diretórios de destino
targetDirs.forEach(targetDir => {
  // Cria o diretório de destino se não existir
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✅ Diretório criado: ${targetDir}`);
  }

  // Lista e copia todos os arquivos do diretório fonte
  fs.readdirSync(sourceDir).forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    // Pula se não for arquivo
    if (!fs.lstatSync(sourcePath).isFile()) return;

    // Copia o arquivo
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Arquivo copiado: ${file} -> ${targetDir}`);
  });
});

console.log('✅ Configuração dos arquivos de dicionário concluída!');
console.log('');
console.log('Importante: Se você não estiver vendo os arquivos no app, verifique:');
console.log('1. Rode este script novamente após "npm run cap:sync"');
console.log('2. Verifique se o SpellChecker está importando o Filesystem do Capacitor corretamente');
console.log('3. Use WebViewDebug para inspecionar o console do WebView Android'); 