const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Diretórios de ícones no Android
const iconDirectories = [
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'android/app/src/main/res/mipmap-anydpi-v26'
];

// Verificar se os diretórios existem
console.log('Verificando diretórios de ícones...');
iconDirectories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Criando diretório: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Instruções para o usuário
console.log('\n===== INSTRUÇÕES PARA CONFIGURAR O ÍCONE DO APLICATIVO =====');
console.log('\n1. Coloque seu arquivo de ícone (preferencialmente PNG de alta resolução) na pasta raiz do projeto');
console.log('2. Abra o projeto Android no Android Studio com o comando:');
console.log('   npm run cap:open:android');
console.log('\n3. No Android Studio, clique com o botão direito na pasta "app" e selecione:');
console.log('   New > Image Asset');
console.log('\n4. Na janela "Asset Studio":');
console.log('   - Em "Icon Type", selecione "Launcher Icons (Adaptive and Legacy)"');
console.log('   - Em "Path", clique em "..." e navegue até o arquivo de ícone');
console.log('   - Ajuste o recorte e as configurações conforme necessário');
console.log('   - Clique em "Next" e depois em "Finish"');
console.log('\n5. Para o ícone da tela de splash, repita o processo, mas selecione:');
console.log('   - "Icon Type" como "Notification Icons"');
console.log('\n6. Após configurar os ícones, construa o APK com:');
console.log('   npm run cap:build:android');
console.log('\n===== FIM DAS INSTRUÇÕES =====');

// Verificar se o Android Studio está instalado
try {
  console.log('\nVerificando instalação do Android Studio...');
  if (process.platform === 'win32') {
    // Verificar no Windows
    const programFiles = process.env['ProgramFiles(x86)'] || process.env['ProgramFiles'];
    const androidStudioPath = path.join(programFiles, 'Android', 'Android Studio');
    
    if (fs.existsSync(androidStudioPath)) {
      console.log('Android Studio encontrado em:', androidStudioPath);
    } else {
      console.log('Android Studio não encontrado no caminho padrão. Verifique se está instalado corretamente.');
    }
  } else {
    // Verificar em outros sistemas operacionais
    try {
      execSync('which studio', { stdio: 'ignore' });
      console.log('Android Studio encontrado no PATH');
    } catch (error) {
      console.log('Android Studio não encontrado no PATH. Verifique se está instalado corretamente.');
    }
  }
} catch (error) {
  console.log('Erro ao verificar o Android Studio:', error.message);
}

console.log('\nPara abrir o projeto no Android Studio, execute:');
console.log('npm run cap:open:android'); 