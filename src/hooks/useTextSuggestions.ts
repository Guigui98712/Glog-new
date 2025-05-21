import { useState, useEffect, useRef } from 'react';
import { useSpellChecker } from './useSpellChecker';

interface UseTextSuggestionsProps {
  text: string;
  lang?: string;
}

interface UseTextSuggestionsResult {
  suggestions: string[];
  currentWord: string;
  wordStartPosition: number;
  wordEndPosition: number;
  applyCorrection: (suggestion: string) => void;
  isLoading: boolean;
}

// Lista de palavras comuns em português para auto-sugestão
const commonPortugueseWords = [
  'você', 'hoje', 'amanhã', 'obrigado', 'como', 'está', 'bom', 'dia', 'noite', 'tarde',
  'também', 'muito', 'bem', 'trabalho', 'casa', 'favor', 'pode', 'vamos', 'preciso',
  'quando', 'onde', 'quem', 'porque', 'para', 'com', 'sem', 'agora', 'depois', 'antes',
  'aqui', 'ali', 'lá', 'certo', 'errado', 'sim', 'não', 'talvez', 'sempre', 'nunca',
  'agradecemos', 'precisamos', 'obrigada', 'estamos', 'vamos', 'entendo', 'certeza',
  'combinado', 'consegue', 'podemos', 'devemos', 'reunião', 'material', 'projeto'
];

export function useTextSuggestions({
  text,
  lang = 'pt-BR'
}: UseTextSuggestionsProps): UseTextSuggestionsResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [wordStartPosition, setWordStartPosition] = useState<number>(0);
  const [wordEndPosition, setWordEndPosition] = useState<number>(0);
  const [inputCallback, setInputCallback] = useState<((suggestion: string) => void) | null>(null);
  const lastWordRef = useRef<string>('');
  const textRef = useRef<string>('');
  const positionRef = useRef<number>(0);
  
  // Utilizamos o corretor ortográfico existente
  const { suggestions: spellSuggestions, isLoading } = useSpellChecker({ text });
  
  // Função para identificar a palavra atual e sua posição
  const identifyCurrentWord = (fullText: string, cursorPosition: number) => {
    // Se o cursor estiver no final do texto, ajustamos para o último caractere
    if (cursorPosition >= fullText.length) {
      cursorPosition = Math.max(0, fullText.length - 1);
    }
    
    // Encontrar o início da palavra atual
    let start = cursorPosition;
    while (start > 0 && /\w|[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(fullText[start - 1])) {
      start--;
    }
    
    // Encontrar o fim da palavra atual
    let end = cursorPosition;
    while (end < fullText.length && /\w|[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(fullText[end])) {
      end++;
    }
    
    // Extrair a palavra atual
    const word = fullText.substring(start, end);
    
    return {
      word,
      start,
      end
    };
  };
  
  // Função para gerar sugestões baseadas na palavra atual
  const generateSuggestions = (word: string) => {
    if (word.length < 2) return [];
    
    // Primeiro, verificamos se há sugestões do corretor ortográfico
    const spellingCorrections = spellSuggestions
      .filter(item => item.word.toLowerCase() === word.toLowerCase())
      .flatMap(item => item.suggestions);
    
    // Segundo, procuramos palavras comuns que começam com o prefixo atual
    const prefixSuggestions = commonPortugueseWords
      .filter(commonWord => 
        commonWord.toLowerCase().startsWith(word.toLowerCase()) && 
        commonWord.toLowerCase() !== word.toLowerCase()
      )
      .sort((a, b) => a.length - b.length); // Ordenar por tamanho
    
    // Combinamos as sugestões, priorizando correções ortográficas
    return [...new Set([...spellingCorrections, ...prefixSuggestions])].slice(0, 5);
  };
  
  // Atualizar o estado quando o texto muda
  const updateCurrentWord = (newText: string, position: number) => {
    const { word, start, end } = identifyCurrentWord(newText, position);
    setCurrentWord(word);
    setWordStartPosition(start);
    setWordEndPosition(end);
    
    // Só atualizamos sugestões se a palavra tiver mudado
    if (word !== lastWordRef.current) {
      lastWordRef.current = word;
      const newSuggestions = generateSuggestions(word);
      setSuggestions(newSuggestions);
    }
  };
  
  // Configurar handler para aplicar correção
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  
  // Função para aplicar uma sugestão de correção
  const applyCorrection = (suggestion: string) => {
    if (inputCallback) {
      inputCallback(suggestion);
    }
  };
  
  // Configurar referência para a função de aplicar sugestão
  const setApplyCallback = (callback: (suggestion: string) => void) => {
    setInputCallback(() => callback);
  };
  
  // Expor a função que atualiza a palavra atual e cursor
  const updatePosition = (position: number) => {
    positionRef.current = position;
    updateCurrentWord(textRef.current, position);
  };
  
  return {
    suggestions,
    currentWord,
    wordStartPosition,
    wordEndPosition,
    applyCorrection,
    isLoading,
    updatePosition // Método para atualizar a posição externamente
  };
} 