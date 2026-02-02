-- 2026-01-30 - Deduplicate Cronogramas by tipo and add unique index (if needed)
-- Uso: Cole e execute este SQL no Supabase SQL Editor (faça backup antes).
-- Este script encontra duplicatas por obra_id, lower(trim(nome)) e tipo; faz backup e remove mantendo o registro MAIS RECENTE.

-- === A) Inspecionar duplicatas (execute primeiro para revisar) ===
SELECT
  obra_id,
  lower(trim(nome)) AS nome_norm,
  tipo,
  COUNT(*) AS cnt,
  array_agg(json_build_object('id', id, 'nome', nome, 'created_at', created_at) ORDER BY created_at DESC) AS items
FROM cronogramas
GROUP BY obra_id, lower(trim(nome)), tipo
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- === B) Backup: criar tabela de backup se necessário e inserir duplicatas (TODOS os registros que fazem parte de grupos duplicados) ===
CREATE TABLE IF NOT EXISTS cronogramas_duplicates_by_tipo_backup AS
SELECT * FROM cronogramas WHERE 1=2;

WITH dupe_ids AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY obra_id, lower(trim(nome)), tipo ORDER BY created_at DESC) AS rn
    FROM cronogramas
  ) t
  WHERE t.rn > 0
)
INSERT INTO cronogramas_duplicates_by_tipo_backup
SELECT * FROM cronogramas WHERE id IN (SELECT id FROM dupe_ids);

-- Nota: a query acima copia todos os registros (inclusive os que serão mantidos). Se preferir apenas
-- copiar os registros que serão removidos (ou seja, rn > 1), substitua a CTE por rn > 1.

-- === C) Remover duplicatas (mantém o registro MAIS RECENTE por (obra_id, nome normalizado, tipo)) ===
WITH ranked AS (
  SELECT id, obra_id, lower(trim(nome)) AS nome_norm, tipo,
    ROW_NUMBER() OVER (PARTITION BY obra_id, lower(trim(nome)), tipo ORDER BY created_at DESC) AS rn
  FROM cronogramas
)
DELETE FROM cronogramas
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- === D) Garantir índice único por (obra_id, lower(trim(nome)), tipo) ===
DROP INDEX IF EXISTS idx_cronogramas_obra_nome_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cronogramas_obra_nome_tipo_unique
ON cronogramas (obra_id, lower(trim(nome)), tipo);

-- === FIM ===
-- Recomendo rodar a seção A primeiro (apenas SELECT) e revisar o resultado.
-- Em seguida, rode B (backup), C (delete) e por fim D (index).
-- OBS: sempre faça backup do banco ou execute em um ambiente de teste antes de aplicar em produção.
