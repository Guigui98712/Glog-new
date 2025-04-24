-- Script para adicionar colunas faltantes na tabela diario_obra

-- Adicionar coluna observacoes se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'diario_obra' 
                   AND column_name = 'observacoes') THEN
        ALTER TABLE public.diario_obra ADD COLUMN observacoes TEXT;
    END IF;
END $$;

-- Adicionar coluna etapas_iniciadas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'diario_obra' 
                   AND column_name = 'etapas_iniciadas') THEN
        ALTER TABLE public.diario_obra ADD COLUMN etapas_iniciadas TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Adicionar coluna etapas_concluidas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'diario_obra' 
                   AND column_name = 'etapas_concluidas') THEN
        ALTER TABLE public.diario_obra ADD COLUMN etapas_concluidas TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Adicionar coluna fotos se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'diario_obra' 
                   AND column_name = 'fotos') THEN
        ALTER TABLE public.diario_obra ADD COLUMN fotos TEXT[] DEFAULT '{}';
    END IF;
END $$; 