import React, { useState, useEffect, useRef } from 'react';

export default function TestNativeSpellCheck() {
  const [text, setText] = useState<string>('teste inicial com errros de ortografia em um textarea.');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  useEffect(() => {
    if (textareaRef.current) {
      // Foca no textarea ao montar para facilitar o teste
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Teste com `&lt;textarea&gt;`</h1>
      <p>
        Este é um teste usando um elemento <code>&lt;textarea&gt;</code> padrão com os atributos 
        <code>autocapitalize="sentences"</code>, <code>autocorrect="on"</code>, e <code>spellcheck="true"</code>.
        Verifique o comportamento do teclado (capitalização, previsão) e do corretor.
      </p>
      
      <textarea 
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        spellCheck="true"
        lang="pt-BR"
        autoCapitalize="sentences"
        autoCorrect="on" // No Android, autocapitalize e spellcheck são mais relevantes
        inputMode="text"
        rows={8}
        style={{
          width: '100%',
          border: '1px solid #ccc',
          padding: '10px',
          marginTop: '20px',
          fontSize: '16px',
          boxSizing: 'border-box' // Para incluir padding/border na largura total
        }}
      />

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#555' }}>
        <h2>O que observar (comparado ao `contentEditable`):</h2>
        <ul>
          <li><strong>Comportamento do Teclado:</strong> A capitalização automática ao iniciar frases funciona de forma interativa no teclado? A previsão de palavras aparece?</li>
          <li><strong>Sublinhado de erros:</strong> Palavras com erros ortográficos são sublinhadas?</li>
          <li><strong>Autocorreção do Teclado:</strong> O teclado corrige automaticamente erros comuns?</li>
          <li><strong>Pop-up de correção:</strong> Tocar em uma palavra sublinhada oferece sugestões do sistema/teclado?</li>
        </ul>
        <p>
          <em>O objetivo é ver se o teclado (IME) interage de forma diferente (melhor ou pior) com um <code>&lt;textarea&gt;</code> padrão em comparação com o <code>div contentEditable</code> dentro do WebView do APK.</em>
        </p>
      </div>
    </div>
  );
} 