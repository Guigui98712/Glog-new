-- Script para criar a tabela de pendências
CREATE TABLE IF NOT EXISTS public.pendencias (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER REFERENCES public.obras(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_conclusao TIMESTAMP WITH TIME ZONE,
  responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhorar a performance
CREATE INDEX IF NOT EXISTS idx_pendencias_obra_id ON public.pendencias(obra_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON public.pendencias(status);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Permitir acesso a usuários autenticados' 
    AND polrelid = 'public.pendencias'::regclass
  ) THEN
    CREATE POLICY "Permitir acesso a usuários autenticados" ON public.pendencias
      USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- Criar trigger para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_pendencias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pendencias_updated_at ON public.pendencias;
CREATE TRIGGER update_pendencias_updated_at
  BEFORE UPDATE ON public.pendencias
  FOR EACH ROW
  EXECUTE FUNCTION update_pendencias_updated_at();

-- Inserir algumas pendências de exemplo
-- Comentado para evitar duplicação de dados em execuções repetidas
/*
INSERT INTO public.pendencias (obra_id, titulo, descricao, status, prioridade, responsavel)
VALUES
  (1, 'Verificar fundação', 'Verificar se a fundação está de acordo com o projeto', 'pendente', 'alta', 'João Silva'),
  (1, 'Comprar materiais', 'Comprar materiais para a próxima fase da obra', 'em_andamento', 'media', 'Maria Souza'),
  (1, 'Contratar eletricista', 'Contratar eletricista para instalação elétrica', 'concluida', 'baixa', 'Pedro Santos'); 
*/ 