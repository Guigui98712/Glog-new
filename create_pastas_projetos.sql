-- Criar tabela para pastas de projetos
CREATE TABLE IF NOT EXISTS pastas_projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- DWG, REVIT, PDF
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nome, tipo, obra_id) -- Evita pastas com mesmo nome no mesmo tipo e obra
);

-- Adicionar coluna pasta_id na tabela projetos (se não existir)
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS pasta_id UUID REFERENCES pastas_projetos(id) ON DELETE SET NULL;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pastas_projetos_obra_tipo ON pastas_projetos(obra_id, tipo);
CREATE INDEX IF NOT EXISTS idx_projetos_pasta_id ON projetos(pasta_id);

-- Políticas RLS (Row Level Security) para pastas_projetos
ALTER TABLE pastas_projetos ENABLE ROW LEVEL SECURITY;

-- Política simples para permitir acesso a usuários autenticados
CREATE POLICY "Usuários autenticados podem gerenciar pastas de projetos" ON pastas_projetos
  FOR ALL USING (auth.uid() IS NOT NULL); 