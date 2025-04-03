import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Obtém as variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[SUPABASE] Inicializando cliente com:', {
  url: supabaseUrl,
  key: supabaseKey ? "***" : "não definida"
});

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL e chave anônima são necessárias');
}

// Cria o cliente Supabase
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
