import React from 'react';
import { SpellcheckEditor } from './spellcheck-editor';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite seu texto aqui...',
  className,
  minHeight = '120px',
}: RichTextEditorProps) {
  return (
    <SpellcheckEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      minHeight={minHeight}
    />
  );
} 