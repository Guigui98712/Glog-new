import React, { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { useTextSuggestions } from '@/hooks/useTextSuggestions';
import { useNativeSpellCheck } from '@/hooks/useNativeSpellCheck';
import { Button } from "@/components/ui/button";
import { Capacitor } from '@capacitor/core';

interface SmartTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
  lang?: string;
}

export function SmartTextEditor({
  value,
  onChange,
  className,
  placeholder = 'Digite sua mensagem...',
  minHeight = '120px',
  lang = 'pt-BR'
}: SmartTextEditorProps) {
  const [text, setText] = useState(value);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isNativePlatform = Capacitor.isNativePlatform();

  // Hook de sugestões de texto
  const { 
    suggestions: webSuggestions, 
    currentWord, 
    wordStartPosition, 
    wordEndPosition,
    isLoading: webIsLoading
  } = useTextSuggestions({ 
    text,
    lang
  });
  
  // Hook para sugestões nativas no Android
  const {
    suggestions: nativeSuggestions,
    isAvailable: nativeIsAvailable,
    isLoading: nativeIsLoading,
    error: nativeError
  } = useNativeSpellCheck({
    text,
    currentWord
  });
  
  // Determinar quais sugestões usar (nativas ou web)
  const suggestions = isNativePlatform && nativeIsAvailable 
    ? nativeSuggestions 
    : webSuggestions;
    
  const isLoading = isNativePlatform && nativeIsAvailable
    ? nativeIsLoading
    : webIsLoading;
  
  // Para debugging
  useEffect(() => {
    if (isNativePlatform) {
      console.log('[SmartTextEditor] Ambiente nativo detectado');
      console.log('[SmartTextEditor] Serviço nativo disponível:', nativeIsAvailable);
      if (nativeError) {
        console.error('[SmartTextEditor] Erro do serviço nativo:', nativeError);
      }
    } else {
      console.log('[SmartTextEditor] Usando corretor web');
    }
  }, [isNativePlatform, nativeIsAvailable, nativeError]);

  useEffect(() => {
    setText(value);
  }, [value]);

  // Atualizar a posição do cursor quando o texto muda
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onChange(newText);
    setCursorPosition(e.target.selectionStart);
  };

  // Monitorar mudanças na posição do cursor
  const handleSelect = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  // Aplicar uma sugestão ao texto
  const applySuggestion = (suggestion: string) => {
    if (textareaRef.current) {
      // Calcular o novo texto com a sugestão aplicada
      const beforeWord = text.substring(0, wordStartPosition);
      const afterWord = text.substring(wordEndPosition);
      const newText = beforeWord + suggestion + afterWord;
      
      // Atualizar o texto
      setText(newText);
      onChange(newText);
      
      // Definir nova posição do cursor após a palavra inserida
      const newCursorPosition = wordStartPosition + suggestion.length;
      
      // Aplicar o foco e a seleção
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
          setCursorPosition(newCursorPosition);
        }
      }, 0);
    }
  };

  // Lidar com teclas especiais (tab para selecionar sugestão)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab seleciona a primeira sugestão
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      applySuggestion(suggestions[0]);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ minHeight }}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        spellCheck={true}
        autoCapitalize="sentences"
        autoCorrect="on"
        autoComplete="on"
        inputMode="text"
        lang={lang}
      />
      
      {/* Barra de sugestões - aparece apenas quando há sugestões disponíveis */}
      {suggestions.length > 0 && !isLoading && (
        <div 
          ref={suggestionsRef}
          className="absolute left-0 right-0 -top-10 p-1 bg-background border border-input rounded-md flex gap-1 overflow-x-auto"
        >
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs whitespace-nowrap"
              onClick={() => applySuggestion(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      
      {/* Indicador de serviço nativo (para testes/debug) */}
      {isNativePlatform && (
        <div className="absolute bottom-0 right-0 p-1">
          <div className={`w-2 h-2 rounded-full ${nativeIsAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      )}
    </div>
  );
} 