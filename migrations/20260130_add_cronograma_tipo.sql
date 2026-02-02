-- 2026-01-30 - Add tipo to cronogramas and enforce uniqueness by tipo
-- Uso: Cole e execute este SQL no Supabase SQL Editor (faça backup antes).

-- 1) Adicionar coluna 'tipo' (temporariamente NULLable)
ALTER TABLE cronogramas
  ADD COLUMN IF NOT EXISTS tipo TEXT;

-- 2) Preencher 'tipo' a partir dos dados existentes (weeks/months). Default: 'weeks'
UPDATE cronogramas
SET tipo = CASE
  WHEN (data->'weeks') IS NOT NULL THEN 'weeks'
  WHEN (data->'months') IS NOT NULL THEN 'months'
  ELSE 'weeks'
END
WHERE tipo IS NULL;

-- 3) (Opcional) verificar agrupamentos por tipo antes de alterar índice
-- SELECT obra_id, lower(trim(nome)) AS nome_norm, tipo, COUNT(*) AS cnt,
--   array_agg(json_build_object('id', id, 'nome', nome, 'created_at', created_at) ORDER BY created_at DESC) AS items
-- FROM cronogramas
-- GROUP BY obra_id, lower(trim(nome)), tipo
-- HAVING COUNT(*) > 1
-- ORDER BY cnt DESC;

-- 4) Ajustar índice único: dropar o índice anterior e criar novo índice que inclui tipo
DROP INDEX IF EXISTS idx_cronogramas_obra_nome_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cronogramas_obra_nome_tipo_unique
ON cronogramas (obra_id, lower(trim(nome)), tipo);

-- 5) Adicionar constraint para limitar valores possíveis (weeks/months)
ALTER TABLE cronogramas
  ADD CONSTRAINT cronogramas_tipo_check CHECK (tipo IN ('weeks', 'months'));

-- 6) Tornar a coluna não-nula e definir default 'weeks' para novas linhas
ALTER TABLE cronogramas
  ALTER COLUMN tipo SET DEFAULT 'weeks';

ALTER TABLE cronogramas
  ALTER COLUMN tipo SET NOT NULL;

-- Recomendações:
-- 1) Execute a query de verificação (comentada no passo 3) para revisar duplicatas por obra_id, nome_norm e tipo.
-- 2) Se existirem duplicatas ainda (cnt > 1), você pode usar a estratégia de backup + delete similar ao script de deduplicação existente, mas respeitando também a coluna tipo.
-- 3) Após rodar esse script, execute testes de criação (semanal e mensal) a partir do frontend para confirmar o comportamento esperado.

-- FIM
