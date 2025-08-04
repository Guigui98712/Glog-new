-- Criação da tabela de viagens para controle de deslocamentos por obra
CREATE TABLE IF NOT EXISTS public.viagens_obra (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    obra_id INTEGER NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
    data_viagem DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- Constraint para evitar duplicatas (uma viagem por dia por obra)
    UNIQUE(obra_id, data_viagem)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_viagens_obra_obra_id ON public.viagens_obra(obra_id);
CREATE INDEX IF NOT EXISTS idx_viagens_obra_data ON public.viagens_obra(data_viagem);
CREATE INDEX IF NOT EXISTS idx_viagens_obra_user_id ON public.viagens_obra(user_id);

-- RLS (Row Level Security) - apenas usuários autenticados podem acessar
ALTER TABLE public.viagens_obra ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas suas próprias viagens
CREATE POLICY "Users can view own viagens" ON public.viagens_obra
    FOR SELECT USING (auth.uid() = user_id);

-- Política para permitir que usuários insiram suas próprias viagens
CREATE POLICY "Users can insert own viagens" ON public.viagens_obra
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem suas próprias viagens
CREATE POLICY "Users can update own viagens" ON public.viagens_obra
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para permitir que usuários deletem suas próprias viagens
CREATE POLICY "Users can delete own viagens" ON public.viagens_obra
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_viagens_obra_updated_at 
    BEFORE UPDATE ON public.viagens_obra 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.viagens_obra IS 'Tabela para controle de viagens/deslocamentos por obra';
COMMENT ON COLUMN public.viagens_obra.obra_id IS 'ID da obra (referência para a tabela de obras)';
COMMENT ON COLUMN public.viagens_obra.data_viagem IS 'Data da viagem/deslocamento';
COMMENT ON COLUMN public.viagens_obra.user_id IS 'ID do usuário que registrou a viagem';
