-- Ferramentas do almoxarifado por obra
-- Controle de estoque (disponível) e retirada por pessoa

CREATE TABLE IF NOT EXISTS almox_tools (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  foto_url TEXT,
  com_pessoa_nome TEXT,
  retirado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almox_tools_obra_id ON almox_tools(obra_id);
CREATE INDEX IF NOT EXISTS idx_almox_tools_nome_lower ON almox_tools(LOWER(nome));
