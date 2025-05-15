import React, { useState } from 'react';
import { SpellcheckEditor } from '@/components/ui/spellcheck-editor';
import { useSpellChecker } from '@/hooks/useSpellChecker';

export default function TestSpellChecker() {
  const [text, setText] = useState<string>('Digite algum texto aqui com errros de ortografia para testar.');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const { suggestions, isLoading } = useSpellChecker({ text });
  
  const isCapacitor = typeof window !== 'undefined' && 
                     !!(window as any)?.Capacitor?.isNativePlatform && 
                     (window as any).Capacitor.isNativePlatform();

  // Função para exibir informações de debug
  const showDebugInfo = async () => {
    try {
      let info = '';
      
      // Verifica ambiente
      info += `Ambiente: ${isCapacitor ? 'Nativo (Capacitor)' : 'Web'}\n`;
      info += `Carregador: ${isLoading ? 'Carregando...' : 'Carregado'}\n`;
      info += `Sugestões encontradas: ${suggestions.length}\n\n`;
      
      // Se estiver em ambiente nativo, tenta verificar arquivos
      if (isCapacitor) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          
          // Lista o diretório de dicionários para verificar se os arquivos estão lá
          try {
            const result = await Filesystem.readdir({
              path: 'dictionaries',
              directory: Directory.Application
            });
            
            info += `Arquivos em 'dictionaries/':\n`;
            result.files.forEach(file => {
              info += `- ${file.name} (${file.type})\n`;
            });
          } catch (e) {
            info += `Erro ao listar diretório: ${e.message}\n`;
          }
          
          // Tenta ler os arquivos específicos
          try {
            const affExists = await Filesystem.stat({
              path: 'dictionaries/pt.aff',
              directory: Directory.Application
            });
            
            const dicExists = await Filesystem.stat({
              path: 'dictionaries/pt.dic',
              directory: Directory.Application
            });
            
            info += `\npt.aff: ${affExists ? 'Encontrado' : 'Não encontrado'}\n`;
            info += `pt.dic: ${dicExists ? 'Encontrado' : 'Não encontrado'}\n`;
          } catch (e) {
            info += `\nErro ao verificar arquivos: ${e.message}\n`;
          }
        } catch (e) {
          info += `\nErro ao importar Filesystem: ${e.message}\n`;
        }
      }
      
      setDebugInfo(info);
      
    } catch (error) {
      setDebugInfo(`Erro ao obter informações de debug: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: '800px', margin: '0 auto' }}>
      <h1>Teste do Corretor Ortográfico</h1>
      
      <p>
        Esta página permite testar o corretor ortográfico no aplicativo.
        Digite texto com erros de ortografia para ver as sugestões.
      </p>
      
      <div style={{ marginTop: '20px' }}>
        <SpellcheckEditor 
          value={text} 
          onChange={setText}
          minHeight="150px"
        />
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={showDebugInfo}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4a5568',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Mostrar Informações de Debug
        </button>
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
        <h2>Instruções:</h2>
        <ol>
          <li>Digite texto com erros ortográficos no editor acima.</li>
          <li>Palavras com erros devem aparecer destacadas (em vermelho) no canto superior direito.</li>
          <li>Clique nessas palavras para ver sugestões de correção.</li>
          <li>Se as sugestões não aparecerem, clique em "Verificar ortografia" para usar o corretor nativo.</li>
          <li>Use o botão "Mostrar Informações de Debug" para diagnosticar problemas.</li>
        </ol>
      </div>
      
      <div style={{ marginTop: '30px', fontSize: '12px', color: '#718096' }}>
        <p>
          Ambiente: {isCapacitor ? 'APK (Nativo)' : 'Web'}
          <br />
          Status: {isLoading ? 'Carregando dicionário...' : suggestions.length > 0 ? `${suggestions.length} sugestões encontradas` : 'Nenhuma sugestão disponível'}
        </p>
      </div>
    </div>
  );
} 