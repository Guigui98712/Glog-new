const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Lista de plugins necessários
const requiredPlugins = [
  '@capacitor/android',
  '@capacitor/core',
  '@capacitor/app',
  '@capacitor/haptics',
  '@capacitor/keyboard',
  '@capacitor/status-bar',
  '@capacitor/splash-screen',
  '@capacitor/toast',
  '@capacitor/dialog',
  '@capacitor/filesystem',
  '@capacitor/camera',
  '@capacitor/share',
  '@capacitor/network',
  '@capacitor/device',
  '@capacitor/preferences',
  '@capawesome/capacitor-app-update',
  '@capacitor/live-updates'
];

// Verificar package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

// Verificar plugins instalados
const missingPlugins = [];
for (const plugin of requiredPlugins) {
  if (!dependencies[plugin]) {
    missingPlugins.push(plugin);
  }
}

// Instalar plugins ausentes
if (missingPlugins.length > 0) {
  console.log(`Instalando ${missingPlugins.length} plugins ausentes...`);
  try {
    execSync(`npm install ${missingPlugins.join(' ')}`, { stdio: 'inherit' });
    console.log('Plugins instalados com sucesso!');
  } catch (error) {
    console.error('Erro ao instalar plugins:', error);
    process.exit(1);
  }
} else {
  console.log('Todos os plugins necessários já estão instalados.');
}

// Sincronizar com o Capacitor
console.log('Sincronizando com o Capacitor...');
try {
  execSync('npx cap sync', { stdio: 'inherit' });
  console.log('Sincronização concluída com sucesso!');
} catch (error) {
  console.error('Erro ao sincronizar com o Capacitor:', error);
  process.exit(1);
}

console.log('\nTudo pronto! Você pode gerar o APK com os seguintes comandos:');
console.log('- npm run cap:build:android (versão de debug)');
console.log('- npm run cap:build:android:release (versão de release)'); 