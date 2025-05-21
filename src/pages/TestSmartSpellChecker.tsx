import React, { useState } from 'react';
import { SmartTextEditor } from '@/components/ui/smart-text-editor';
import { Button } from '@/components/ui/button';

export default function TestSmartSpellChecker() {
  const [text, setText] = useState<string>('Digite um texto aqui. O corretor irá sujeerir correções e autocompleetar palavras.');
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const showDebugInfo = () => {
    // Obtém algumas informações de diagnóstico
    const info = `
**Estado do Corretor Inteligente**

Texto atual: "${text}"

**Ambiente**:
- Navegador: ${navigator.userAgent}
- Plataforma: ${navigator.platform}
- Idioma: ${navigator.language}

**Suporte a APIs**:
- spellcheck: ${document.createElement('textarea').spellcheck !== undefined ? 'Suportado' : 'Não suportado'}
- autocorrect: ${document.createElement('textarea').getAttribute('autocorrect') !== null ? 'Suportado' : 'Não suportado'}
- Capacitor: ${(window as any).Capacitor ? 'Disponível' : 'Não disponível'}
- Nativo: ${(window as any).Capacitor?.isNativePlatform ? ((window as any).Capacitor.isNativePlatform() ? 'Sim' : 'Não') : 'N/A'}
`;

    setDebugInfo(info);
  };

  return (
    <div style={{ padding: 16, maxWidth: '800px', margin: '0 auto' }}>
      <h1>Teste do Corretor Inteligente (Estilo WhatsApp)</h1>
      
      <p>
        Este editor de texto oferece sugestões em tempo real e correção ortográfica 
        similar ao WhatsApp. Digite e observe as sugestões aparecendo acima do campo.
      </p>
      
      <div style={{ marginTop: '20px', position: 'relative' }}>
        <SmartTextEditor 
          value={text} 
          onChange={setText}
          minHeight="150px"
          placeholder="Digite um texto aqui para testar o corretor inteligente..."
        />
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <Button 
          onClick={showDebugInfo}
          variant="outline"
        >
          Mostrar Informações de Debug
        </Button>
      </div>
      
      {debugInfo && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #edf2f7',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {debugInfo}
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <h2>Instruções de Uso:</h2>
        <ul>
          <li>Digite normalmente no campo de texto acima</li>
          <li>Enquanto digita, sugestões de palavras aparecerão acima do campo</li>
          <li>Clique em qualquer sugestão para completar automaticamente</li>
          <li>Pressione TAB para usar a primeira sugestão rapidamente</li>
          <li>As sugestões incluem correções para palavras erradas e autocompletar</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Recursos:</h2>
        <ul>
          <li><strong>Correção Ortográfica:</strong> Identifica palavras com erros de ortografia</li>
          <li><strong>Sugestões de Correção:</strong> Mostra opções para corrigir palavras erradas</li>
          <li><strong>Autocompletar:</strong> Sugere palavras comuns à medida que você escreve</li>
          <li><strong>Funcionamento Offline:</strong> Funciona sem necessidade de conexão</li>
        </ul>
      </div>
    </div>
  );
} 