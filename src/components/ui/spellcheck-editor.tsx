import React, { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { useSpellChecker } from '@/hooks/useSpellChecker';
import { useNativeBrowserSpellCheck } from '@/hooks/useNativeBrowserSpellCheck';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SpellcheckEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
  useNativeSpellCheck?: boolean;
}

export function SpellcheckEditor({
  value,
  onChange,
  className,
  placeholder = 'Digite seu texto aqui...',
  minHeight = '120px',
  useNativeSpellCheck = true,
}: SpellcheckEditorProps) {
  const [text, setText] = useState(value);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Hook nspell para verificação offline
  const { suggestions, isLoading } = useSpellChecker({ text });
  
  // Hook para verificação nativa do navegador
  const { textWithCorrections, isChecking } = useNativeBrowserSpellCheck({ text });

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onChange(newText);
    setSelectionStart(e.target.selectionStart);
    setSelectionEnd(e.target.selectionEnd);
  };

  const handleSelect = () => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart);
      setSelectionEnd(textareaRef.current.selectionEnd);
    }
  };

  const applySuggestion = (suggestion: string, wordToReplace: string) => {
    const beforeSelection = text.substring(0, selectionStart);
    const afterSelection = text.substring(selectionEnd);
    
    // Encontrar a palavra selecionada no texto
    const selectedWord = text.substring(selectionStart, selectionEnd);
    
    // Se a palavra selecionada é a que queremos substituir
    if (selectedWord === wordToReplace) {
      const newText = beforeSelection + suggestion + afterSelection;
      setText(newText);
      onChange(newText);
    } else {
      // Se não, procurar a palavra no texto e substituir
      const newText = text.replace(wordToReplace, suggestion);
      setText(newText);
      onChange(newText);
    }
  };

  // Método para habilitar o editor contentEditable
  const enableContentEditableEditor = () => {
    if (!editorRef.current) return;
    
    // Configurar o editor para verificação ortográfica nativa
    editorRef.current.contentEditable = 'true';
    editorRef.current.spellcheck = true;
    editorRef.current.innerHTML = text;
    editorRef.current.style.display = 'block';
    
    // Esconder a textarea
    if (textareaRef.current) {
      textareaRef.current.style.display = 'none';
    }
  };
  
  // Método para desabilitar o editor contentEditable e voltar para textarea
  const disableContentEditableEditor = () => {
    if (!editorRef.current || !textareaRef.current) return;
    
    // Capturar o conteúdo possivelmente corrigido
    const correctedText = editorRef.current.innerHTML;
    setText(correctedText);
    onChange(correctedText);
    
    // Restaurar a textarea
    editorRef.current.style.display = 'none';
    textareaRef.current.style.display = 'block';
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onSelect={handleSelect}
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
        spellCheck={useNativeSpellCheck}
        lang="pt-BR"
      />
      
      {/* Editor alternativo usando contentEditable para verificação nativa */}
      <div 
        ref={editorRef}
        style={{ 
          display: 'none', 
          minHeight,
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--input)',
          borderRadius: '0.375rem',
          backgroundColor: 'var(--background)',
        }}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onBlur={disableContentEditableEditor}
      />
      
      {/* Botão para ativar correção ortográfica nativa */}
      <div className="absolute left-2 bottom-2 flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={enableContentEditableEditor}
          title="Verificar ortografia usando o corretor do navegador"
        >
          Verificar ortografia
        </Button>
      </div>
      
      {!isLoading && suggestions.length > 0 && (
        <div className="absolute right-2 top-2 flex gap-1">
          {suggestions.map(({ word, suggestions: wordSuggestions }) => (
            <Popover key={word}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                >
                  {word}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2">
                <div className="space-y-1">
                  {wordSuggestions.slice(0, 5).map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => applySuggestion(suggestion, word)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}
    </div>
  );
} 