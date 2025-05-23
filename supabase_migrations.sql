-- Código SQL para criar a tabela de presenças no Supabase

-- Parte 1: Criar ou atualizar a tabela de obras
CREATE TABLE IF NOT EXISTS obras (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    custo_previsto DECIMAL(15,2) NOT NULL,
    custo_real DECIMAL(15,2) DEFAULT 0,
    progresso INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'em_andamento',
    logo_url TEXT,
    cliente VARCHAR(255),
    responsavel VARCHAR(255),
    data_inicio DATE,
    data_previsao_fim DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atualização da tabela de obras (caso já exista)
ALTER TABLE obras 
ADD COLUMN IF NOT EXISTS data_inicio DATE,
ADD COLUMN IF NOT EXISTS data_previsao_fim DATE;

-- Parte 2: Criar a tabela de funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(255),
    telefone VARCHAR(20),
    email VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parte 3: Criar a tabela de presenças sem constraints
CREATE TABLE IF NOT EXISTS presencas (
    id BIGSERIAL PRIMARY KEY,
    obra_id BIGINT NOT NULL,
    funcionario_id BIGINT NOT NULL,
    data DATE NOT NULL,
    presente DECIMAL(2,1) NOT NULL DEFAULT 0, -- 0 = ausente, 0.5 = meio período, 1 = presente
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(obra_id, funcionario_id, data)
);

-- Parte 4: Trigger para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger nas tabelas
DROP TRIGGER IF EXISTS set_timestamp ON presencas;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON presencas
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp ON funcionarios;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON funcionarios
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp ON obras;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON obras
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Parte 5: Adicionar índices para melhorar a performance
CREATE INDEX IF NOT EXISTS idx_presencas_obra_id ON presencas(obra_id);
CREATE INDEX IF NOT EXISTS idx_presencas_funcionario_id ON presencas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_presencas_data ON presencas(data);

-- Parte 6: Adicionar as constraints de chave estrangeira
-- Execute esta parte separadamente após verificar que as tabelas foram criadas corretamente
/*
ALTER TABLE presencas
DROP CONSTRAINT IF EXISTS fk_presencas_obra;

ALTER TABLE presencas
ADD CONSTRAINT fk_presencas_obra
FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE;

ALTER TABLE presencas
DROP CONSTRAINT IF EXISTS fk_presencas_funcionario;

ALTER TABLE presencas
ADD CONSTRAINT fk_presencas_funcionario
FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE;
*/

-- Comentários nas tabelas para documentação
COMMENT ON TABLE presencas IS 'Registros de presença dos funcionários nas obras';
COMMENT ON COLUMN presencas.presente IS '0 = ausente, 0.5 = meio período, 1 = presente';

COMMENT ON TABLE funcionarios IS 'Cadastro de funcionários para controle de presença';

-- Script de diagnóstico para verificar a estrutura atual das tabelas

-- Verificar quais tabelas existem no schema public
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verificar a estrutura da tabela obras (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'obras';

-- Verificar a estrutura da tabela presencas (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'presencas';

-- Verificar a estrutura da tabela funcionarios (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'funcionarios';

-- Verificar as constraints existentes
SELECT conname, conrelid::regclass, conkey
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
