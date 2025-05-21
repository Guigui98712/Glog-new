import { useState, useEffect, useCallback } from 'react';
import SpellChecker from '@/plugins/SpellCheckerPlugin';
import { Capacitor } from '@capacitor/core';

interface UseNativeSpellCheckProps {
  text: string;
  currentWord: string;
}

interface UseNativeSpellCheckResult {
  suggestions: string[];
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useNativeSpellCheck({ 
  text, 
  currentWord 
}: UseNativeSpellCheckProps): UseNativeSpellCheckResult {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar se o serviço está disponível
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // Se não estiver em ambiente nativo, não tentamos
        if (!Capacitor.isNativePlatform()) {
          setIsAvailable(false);
          setIsLoading(false);
          return;
        }
        
        const result = await SpellChecker.checkAvailability();
        setIsAvailable(result.available);
      } catch (err) {
        console.error('Erro ao verificar disponibilidade do spell checker:', err);
        setIsAvailable(false);
        setError('Erro ao verificar disponibilidade do serviço');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAvailability();
  }, []);
  
  // Buscar sugestões quando a palavra atual mudar
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Só busca sugestões se houver uma palavra atual
      if (!currentWord || currentWord.length < 2 || !isAvailable) {
        setSuggestions([]);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await SpellChecker.getSuggestions({ text: currentWord });
        
        if (result.available) {
          setSuggestions(result.suggestions || []);
        } else if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        console.error('Erro ao obter sugestões:', err);
        setError('Erro ao obter sugestões');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isAvailable) {
      fetchSuggestions();
    }
  }, [currentWord, isAvailable]);
  
  return {
    suggestions,
    isAvailable,
    isLoading,
    error
  };
} 