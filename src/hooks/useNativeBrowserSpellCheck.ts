import { useState, useEffect, useRef } from 'react';

interface UseNativeBrowserSpellCheckProps {
  text: string;
}

interface UseNativeBrowserSpellCheckResult {
  textWithCorrections: string;
  isChecking: boolean;
}

export function useNativeBrowserSpellCheck({ 
  text 
}: UseNativeBrowserSpellCheckProps): UseNativeBrowserSpellCheckResult {
  const [textWithCorrections, setTextWithCorrections] = useState(text);
  const [isChecking, setIsChecking] = useState(false);
  const spellCheckerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!text) {
      setTextWithCorrections('');
      return;
    }

    // Criar um elemento div para verificação ortográfica nativa
    if (!spellCheckerRef.current) {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.left = '-9999px';
      div.style.top = '-9999px';
      div.contentEditable = 'true';
      div.spellcheck = true;
      div.lang = 'pt-BR';
      document.body.appendChild(div);
      spellCheckerRef.current = div;
    }

    const checkSpelling = async () => {
      try {
        setIsChecking(true);
        
        if (spellCheckerRef.current) {
          // Definir o texto a ser verificado
          spellCheckerRef.current.innerHTML = text;
          
          // Dar tempo para o navegador aplicar a verificação ortográfica
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Capturar o texto possivelmente corrigido pelo navegador
          const correctedText = spellCheckerRef.current.innerHTML;
          setTextWithCorrections(correctedText);
        }
      } catch (error) {
        console.error('Erro na verificação ortográfica nativa:', error);
        setTextWithCorrections(text); // Fallback para o texto original
      } finally {
        setIsChecking(false);
      }
    };

    checkSpelling();

    // Limpeza
    return () => {
      if (spellCheckerRef.current && document.body.contains(spellCheckerRef.current)) {
        document.body.removeChild(spellCheckerRef.current);
        spellCheckerRef.current = null;
      }
    };
  }, [text]);

  return {
    textWithCorrections,
    isChecking
  };
} 