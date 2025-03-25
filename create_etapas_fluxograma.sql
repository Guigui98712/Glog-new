-- Script para criar a tabela etapas_fluxograma

-- Verificar se a tabela já existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'etapas_fluxograma'
    ) THEN
        -- Criar a tabela etapas_fluxograma
        CREATE TABLE public.etapas_fluxograma (
            id SERIAL PRIMARY KEY,
            obra_id INTEGER NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
            nome TEXT NOT NULL,
            position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        );

        -- Adicionar comentário à tabela
        COMMENT ON TABLE public.etapas_fluxograma IS 'Tabela para armazenar as etapas do fluxograma de obras com suas posições';

        -- Criar índices para melhorar a performance
        CREATE INDEX idx_etapas_fluxograma_obra_id ON public.etapas_fluxograma(obra_id);

        -- Configurar RLS (Row Level Security)
        ALTER TABLE public.etapas_fluxograma ENABLE ROW LEVEL SECURITY;

        -- Criar políticas de acesso
        CREATE POLICY "Permitir select para usuários autenticados"
        ON public.etapas_fluxograma FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Permitir insert para usuários autenticados"
        ON public.etapas_fluxograma FOR INSERT
        TO authenticated
        WITH CHECK (true);

        CREATE POLICY "Permitir update para usuários autenticados"
        ON public.etapas_fluxograma FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Permitir delete para usuários autenticados"
        ON public.etapas_fluxograma FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END
$$; 