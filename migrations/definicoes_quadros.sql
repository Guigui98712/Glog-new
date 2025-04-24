-- Criar tabela de quadros de definições
CREATE TABLE IF NOT EXISTS public.definicoes_quadros (
    id TEXT PRIMARY KEY,
    title TEXT,
    nome TEXT,
    lists JSONB,
    obra_id INTEGER REFERENCES public.obras(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar permissões de acesso à tabela
ALTER TABLE public.definicoes_quadros ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para a tabela definicoes_quadros
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'definicoes_quadros')
        AND polname = 'Usuários autenticados podem visualizar definições'
    ) THEN
        CREATE POLICY "Usuários autenticados podem visualizar definições" 
        ON public.definicoes_quadros FOR SELECT 
        TO authenticated 
        USING (
            obra_id IN (
                SELECT id FROM public.obras 
                WHERE user_id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'definicoes_quadros')
        AND polname = 'Usuários autenticados podem inserir definições'
    ) THEN
        CREATE POLICY "Usuários autenticados podem inserir definições" 
        ON public.definicoes_quadros FOR INSERT 
        TO authenticated 
        WITH CHECK (
            obra_id IN (
                SELECT id FROM public.obras 
                WHERE user_id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'definicoes_quadros')
        AND polname = 'Usuários autenticados podem atualizar definições'
    ) THEN
        CREATE POLICY "Usuários autenticados podem atualizar definições" 
        ON public.definicoes_quadros FOR UPDATE
        TO authenticated 
        USING (
            obra_id IN (
                SELECT id FROM public.obras 
                WHERE user_id = auth.uid()
            )
        ) 
        WITH CHECK (
            obra_id IN (
                SELECT id FROM public.obras 
                WHERE user_id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'definicoes_quadros')
        AND polname = 'Usuários autenticados podem excluir definições'
    ) THEN
        CREATE POLICY "Usuários autenticados podem excluir definições" 
        ON public.definicoes_quadros FOR DELETE
        TO authenticated 
        USING (
            obra_id IN (
                SELECT id FROM public.obras 
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END
$$;

-- Adicionar coluna definicoes_board_id à tabela obras (se ainda não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'obras' AND column_name = 'definicoes_board_id'
    ) THEN
        ALTER TABLE public.obras ADD COLUMN definicoes_board_id TEXT;
    END IF;
END
$$; 