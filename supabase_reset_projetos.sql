-- Remover a tabela existente se existir
DROP TABLE IF EXISTS projetos;

-- Criar nova tabela de projetos
CREATE TABLE projetos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    url TEXT NOT NULL,
    data_upload TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    obra_id TEXT NOT NULL
);

-- Adicionar índices para melhorar performance
CREATE INDEX idx_projetos_tipo ON projetos(tipo);
CREATE INDEX idx_projetos_obra_id ON projetos(obra_id);
CREATE INDEX idx_projetos_data_upload ON projetos(data_upload DESC);

-- Opcional: Adicionar comentário na tabela
COMMENT ON TABLE projetos IS 'Tabela para armazenar projetos associados a obras'; 