import { useState, useEffect } from 'react';
import nspell from 'nspell';
import { Buffer } from 'buffer';

interface UseSpellCheckerProps {
  text: string;
}

interface UseSpellCheckerResult {
  suggestions: { word: string; suggestions: string[] }[];
  isLoading: boolean;
  checkWord: (word: string) => boolean;
  getSuggestions: (word: string) => string[];
}

export function useSpellChecker({ text }: UseSpellCheckerProps): UseSpellCheckerResult {
  const [spellChecker, setSpellChecker] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<{ word: string; suggestions: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [useBrowserChecker, setUseBrowserChecker] = useState(false);

  // Verifica se o navegador suporta verificação ortográfica nativa
  const hasBrowserSpellCheck = typeof window !== 'undefined' && 'Spellcheck' in window;

  // Verifica se estamos em ambiente Capacitor nativo
  const isCapacitorNative = typeof window !== 'undefined' && 
                          !!(window as any)?.Capacitor?.isNativePlatform && 
                          (window as any).Capacitor.isNativePlatform();

  useEffect(() => {
    const loadDictionary = async () => {
      setIsLoading(true);
      setErrorLoading(null);
      
      try {
        // Verifica se estamos em ambiente Capacitor nativo
        if (isCapacitorNative) {
          await loadDictionaryForNative();
        } else {
          // Carregamento para ambiente web
          await loadDictionaryForWeb();
        }
      } catch (err: any) {
        console.error('Erro ao carregar dicionário:', err);
        console.warn('Usando verificador ortográfico nativo como alternativa');
        setUseBrowserChecker(true);
        setErrorLoading(err.message || 'Erro desconhecido ao carregar dicionário.');
      } finally {
        setIsLoading(false);
      }
    };

    const loadDictionaryForNative = async () => {
      try {
        console.log('Carregando dicionário para ambiente nativo Capacitor');
        
        // Importar dinamicamente os módulos do Capacitor para evitar erros em ambiente web
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        // Tentar carregar os arquivos do diretório de assets do aplicativo
        const affResponse = await Filesystem.readFile({
          path: 'dictionaries/pt.aff',
          directory: Directory.Application
        });
        
        const dicResponse = await Filesystem.readFile({
          path: 'dictionaries/pt.dic',
          directory: Directory.Application
        });
        
        console.log('Arquivos de dicionário carregados do ambiente nativo:', 
                   !!affResponse.data, !!dicResponse.data);
        
        if (!affResponse.data || !dicResponse.data) {
          throw new Error('Falha ao ler arquivos do dicionário no ambiente nativo');
        }
        
        // Converter os dados de base64 para Buffer
        const affBuffer = Buffer.from(
          typeof affResponse.data === 'string' ? 
          affResponse.data : 
          JSON.stringify(affResponse.data), 
          'base64'
        );
        
        const dicBuffer = Buffer.from(
          typeof dicResponse.data === 'string' ? 
          dicResponse.data : 
          JSON.stringify(dicResponse.data), 
          'base64'
        );
        
        console.log('Buffers criados para ambiente nativo, tamanhos:', 
                   affBuffer.length, dicBuffer.length);
        
        // Criar a instância do nspell com os buffers
        const spell = nspell(affBuffer, dicBuffer);
        console.log('Instância nspell criada com sucesso para ambiente nativo');
        setSpellChecker(spell);
        setUseBrowserChecker(false);
      } catch (err) {
        console.error('Erro ao carregar dicionário em ambiente nativo:', err);
        throw err;
      }
    };
    
    const loadDictionaryForWeb = async () => {
      try {
        // Buscar os arquivos do dicionário da pasta public
        const affResponse = await fetch('/dictionaries/pt.aff');
        const dicResponse = await fetch('/dictionaries/pt.dic');

        if (!affResponse.ok || !dicResponse.ok) {
          throw new Error(`Falha ao baixar arquivos do dicionário. AFF status: ${affResponse.status}, DIC status: ${dicResponse.status}`);
        }

        // Ler o conteúdo como ArrayBuffer e converter para Buffer (necessário pelo nspell)
        try {
          const affArrayBuffer = await affResponse.arrayBuffer();
          const dicArrayBuffer = await dicResponse.arrayBuffer();
          
          console.log('ArrayBuffers obtidos, tamanhos:', affArrayBuffer.byteLength, dicArrayBuffer.byteLength);
          
          const affBuffer = Buffer.from(affArrayBuffer);
          const dicBuffer = Buffer.from(dicArrayBuffer);
          
          console.log('Buffers convertidos, tamanhos:', affBuffer.length, dicBuffer.length);
          
          // Criar a instância do nspell com os buffers
          const spell = nspell(affBuffer, dicBuffer);
          console.log('Instância nspell criada com sucesso');
          setSpellChecker(spell);
          setUseBrowserChecker(false);
        } catch (bufferErr) {
          console.error('Erro ao converter ArrayBuffer para Buffer ou criar nspell:', bufferErr);
          console.warn('Usando verificador ortográfico nativo do navegador como alternativa');
          setUseBrowserChecker(true);
          setErrorLoading(`Erro na conversão de buffer: ${bufferErr.message}`);
        }
      } catch (err) {
        console.error('Erro ao carregar dicionário em ambiente web:', err);
        throw err;
      }
    };

    loadDictionary();
  }, [isCapacitorNative]);

  useEffect(() => {
    if (isLoading || !text) {
      setSuggestions([]);
      return;
    }

    // Se estiver usando o verificador nativo do navegador
    if (useBrowserChecker) {
      // Aqui usamos apenas uma implementação básica por enquanto
      // Não temos sugestões reais com o verificador nativo
      setSuggestions([]);
      return;
    }

    // Código original para nspell
    if (errorLoading || !spellChecker) {
      setSuggestions([]);
      return;
    }

    // Dividir o texto em palavras (melhor regex para pontuação)
    const words = text.match(/\b\w+\b/g) || [];
    const newSuggestions = words
      // Filtrar palavras curtas e números
      .filter(word => word.length > 2 && isNaN(Number(word)) && !spellChecker.correct(word))
      .map(word => ({
        word,
        // Limitar o número de sugestões
        suggestions: spellChecker.suggest(word).slice(0, 7)
      }))
      // Remover duplicados baseados na palavra com erro
      .filter((value, index, self) =>
        index === self.findIndex((t) => t.word === value.word)
      );

    setSuggestions(newSuggestions);
  }, [text, spellChecker, isLoading, errorLoading, useBrowserChecker]);

  const checkWord = (word: string): boolean => {
    // Se estiver usando o verificador nativo, sempre retornamos true
    // pois não temos como verificar programaticamente
    if (useBrowserChecker) return true;
    
    if (isLoading || errorLoading || !spellChecker) return true; // Assume correto se carregando/erro ou sem spellchecker
    // Considera correto se for número ou palavra curta
    if (!isNaN(Number(word)) || word.length <= 2) return true;
    return spellChecker.correct(word);
  };

  const getSuggestions = (word: string): string[] => {
    if (useBrowserChecker) return []; // Sem sugestões no modo nativo
    if (isLoading || errorLoading || !spellChecker) return [];
    return spellChecker.suggest(word).slice(0, 7);
  };

  return {
    suggestions,
    isLoading,
    checkWord,
    getSuggestions
  };
} 