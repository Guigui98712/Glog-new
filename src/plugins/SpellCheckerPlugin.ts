import { registerPlugin } from '@capacitor/core';

// Interface para as respostas do plugin
export interface SpellCheckerResponse {
  suggestions: string[];
  available: boolean;
  error?: string;
}

// Interface do plugin
export interface SpellCheckerPlugin {
  getSuggestions(options: { text: string }): Promise<SpellCheckerResponse>;
  checkAvailability(): Promise<{ available: boolean }>;
}

// Registrar o plugin nativo
const SpellChecker = registerPlugin<SpellCheckerPlugin>('SpellChecker', {
  web: {
    async getSuggestions({ text }) {
      // Implementação para web (fallback)
      console.log('Using web fallback for SpellChecker.getSuggestions');
      return {
        suggestions: [],
        available: false,
        error: 'Not implemented for web'
      };
    },
    
    async checkAvailability() {
      // Implementação para web (fallback)
      return { available: false };
    }
  }
});

export default SpellChecker; 