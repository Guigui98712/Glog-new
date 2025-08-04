-- Migração para adicionar campo de pessoas na tabela de viagens
-- Execute este SQL após criar a tabela inicial de viagens

-- Adicionar coluna para armazenar os nomes das pessoas que participaram da viagem
ALTER TABLE public.viagens_obra 
ADD COLUMN IF NOT EXISTS pessoas TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.viagens_obra.pessoas IS 'Nomes das pessoas que participaram da viagem, separados por vírgula';
