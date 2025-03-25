-- Script para corrigir as tabelas do Trello

-- Verificar e criar a tabela trello_boards se não existir
CREATE TABLE IF NOT EXISTS public.trello_boards (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER REFERENCES public.obras(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verificar e criar a tabela trello_lists se não existir
CREATE TABLE IF NOT EXISTS public.trello_lists (
  id SERIAL PRIMARY KEY,
  board_id INTEGER REFERENCES public.trello_boards(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verificar e criar a tabela trello_cards se não existir
CREATE TABLE IF NOT EXISTS public.trello_cards (
  id SERIAL PRIMARY KEY,
  list_id INTEGER REFERENCES public.trello_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna position à tabela trello_lists se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_lists' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.trello_lists ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
END
$$;

-- Verificar se a tabela trello_cards tem as colunas necessárias
DO $$
BEGIN
  -- Verificar e adicionar coluna title se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.trello_cards ADD COLUMN title TEXT;
    
    -- Copiar dados da coluna nome para title
    UPDATE public.trello_cards SET title = nome WHERE title IS NULL;
    
    -- Tornar title NOT NULL
    ALTER TABLE public.trello_cards ALTER COLUMN title SET NOT NULL;
  END IF;
  
  -- Verificar e adicionar coluna position se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.trello_cards ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
  
  -- Verificar e adicionar coluna due_date se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.trello_cards ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Verificar e adicionar coluna labels se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'labels'
  ) THEN
    ALTER TABLE public.trello_cards ADD COLUMN labels TEXT[] DEFAULT '{}';
  END IF;
  
  -- Verificar e renomear coluna descricao para description se necessário
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'descricao'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trello_cards' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.trello_cards RENAME COLUMN descricao TO description;
  END IF;
END
$$;

-- Habilitar RLS (Row Level Security) para as tabelas
ALTER TABLE public.trello_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trello_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trello_cards ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Permitir acesso a usuários autenticados' 
    AND polrelid = 'public.trello_boards'::regclass
  ) THEN
    CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_boards
      USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Permitir acesso a usuários autenticados' 
    AND polrelid = 'public.trello_lists'::regclass
  ) THEN
    CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_lists
      USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Permitir acesso a usuários autenticados' 
    AND polrelid = 'public.trello_cards'::regclass
  ) THEN
    CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_cards
      USING (auth.role() = 'authenticated');
  END IF;
END
$$; 