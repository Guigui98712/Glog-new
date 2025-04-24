const fs = require('fs');
const path = require('path');

// Caminho para o arquivo build.gradle do plugin live-updates
const liveUpdatesGradlePath = path.join(__dirname, 'node_modules', '@capacitor', 'live-updates', 'android', 'build.gradle');
const appUpdateGradlePath = path.join(__dirname, 'node_modules', '@capawesome', 'capacitor-app-update', 'android', 'build.gradle');

// Função para atualizar o arquivo build.gradle
function updateBuildGradle(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Substituir VERSION_21 por VERSION_17
        content = content.replace(/VERSION_21/g, 'VERSION_17');
        
        fs.writeFileSync(filePath, content);
        console.log(`Successfully updated ${filePath}`);
    } catch (error) {
        console.error(`Error updating ${filePath}:`, error);
    }
}

// Atualizar os arquivos
updateBuildGradle(liveUpdatesGradlePath);
updateBuildGradle(appUpdateGradlePath); 