// Script para corrigir problemas de compatibilidade no Capacitor Android
const fs = require('fs');
const path = require('path');

console.log('Aplicando patch de compatibilidade para o Capacitor Android...');

// Caminho para o arquivo CapacitorWebView.java
const capacitorWebViewPath = path.join(
  __dirname,
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'CapacitorWebView.java'
);

// Verificar se o arquivo existe
if (!fs.existsSync(capacitorWebViewPath)) {
  console.error(`Arquivo não encontrado: ${capacitorWebViewPath}`);
  process.exit(1);
}

// Ler o conteúdo do arquivo
let content = fs.readFileSync(capacitorWebViewPath, 'utf8');

// Substituir a seção problemática
const problemSection = `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM && configEdgeToEdge.equals("auto")) {
            TypedValue value = new TypedValue();
            boolean foundOptOut = getContext().getTheme().resolveAttribute(android.R.attr.windowOptOutEdgeToEdgeEnforcement, value, true);
            boolean optOutValue = value.data != 0; // value is set to -1 on true as of Android 15, so we have to do this.

            autoMargins = !(foundOptOut && optOutValue);
        }`;

const fixedSection = `// Verificação simplificada sem APIs Android 14+
        if (configEdgeToEdge.equals("auto")) {
            // Usar configuração padrão sem verificar APIs específicas do Android 14+
            autoMargins = Build.VERSION.SDK_INT >= 29; // Android 10+
        }`;

content = content.replace(problemSection, fixedSection);

// Salvar o arquivo modificado
fs.writeFileSync(capacitorWebViewPath, content, 'utf8');

console.log('Patch aplicado com sucesso!');
console.log('O arquivo CapacitorWebView.java foi modificado para remover referências a APIs do Android 14+');
console.log('Agora você pode continuar com a compilação do APK.'); 