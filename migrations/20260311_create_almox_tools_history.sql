-- Historico de ferramentas do almoxarifado
-- Registra cadastro, retirada, devolucao e exclusao

CREATE TABLE IF NOT EXISTS almox_tools_history (
  id BIGSERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tool_id INTEGER NULL REFERENCES almox_tools(id) ON DELETE SET NULL,
  tool_nome TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('cadastro', 'retirada', 'devolucao', 'exclusao')),
  pessoa_nome TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almox_tools_history_obra_id ON almox_tools_history(obra_id);
CREATE INDEX IF NOT EXISTS idx_almox_tools_history_criado_em ON almox_tools_history(criado_em DESC);
