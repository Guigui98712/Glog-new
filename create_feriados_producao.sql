-- Tabela para marcar dias de feriado na produção de pedreiros
CREATE TABLE IF NOT EXISTS feriados_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id INTEGER NOT NULL,
  data DATE NOT NULL,
  descricao VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(obra_id, data)
);

-- Adicionar RLS
ALTER TABLE feriados_producao ENABLE ROW LEVEL SECURITY;

-- Policy para leitura
CREATE POLICY "Usuários podem ver feriados da obra" ON feriados_producao
  FOR SELECT USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
  );

-- Policy para inserção
CREATE POLICY "Usuários podem criar feriados na obra" ON feriados_producao
  FOR INSERT WITH CHECK (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
  );

-- Policy para atualização
CREATE POLICY "Usuários podem atualizar feriados da obra" ON feriados_producao
  FOR UPDATE USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
  );

-- Policy para exclusão
CREATE POLICY "Usuários podem deletar feriados da obra" ON feriados_producao
  FOR DELETE USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
  );
