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

-- Recria policies para suportar obras compartilhadas
DROP POLICY IF EXISTS "Usuários podem ver feriados da obra" ON feriados_producao;
DROP POLICY IF EXISTS "Usuários podem criar feriados na obra" ON feriados_producao;
DROP POLICY IF EXISTS "Usuários podem atualizar feriados da obra" ON feriados_producao;
DROP POLICY IF EXISTS "Usuários podem deletar feriados da obra" ON feriados_producao;

-- Policy para leitura
CREATE POLICY "Usuários podem ver feriados da obra" ON feriados_producao
  FOR SELECT USING (
    public.user_can_view_obra(obra_id::bigint)
  );

-- Policy para inserção
CREATE POLICY "Usuários podem criar feriados na obra" ON feriados_producao
  FOR INSERT WITH CHECK (
    public.user_can_edit_obra(obra_id::bigint)
  );

-- Policy para atualização
CREATE POLICY "Usuários podem atualizar feriados da obra" ON feriados_producao
  FOR UPDATE USING (
    public.user_can_edit_obra(obra_id::bigint)
  )
  WITH CHECK (
    public.user_can_edit_obra(obra_id::bigint)
  );

-- Policy para exclusão
CREATE POLICY "Usuários podem deletar feriados da obra" ON feriados_producao
  FOR DELETE USING (
    public.user_can_edit_obra(obra_id::bigint)
  );
