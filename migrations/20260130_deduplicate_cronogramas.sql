-- 2026-01-30 - Deduplicate Cronogramas & Add Unique Index
-- Uso: Cole e execute este SQL no Supabase SQL Editor para:
-- 1) inspecionar duplicatas;
-- 2) fazer backup das duplicatas em tabela separada (segurança);
-- 3) remover duplicatas mantendo o registro MAIS RECENTE (created_at DESC);
-- 4) criar índice único para prevenir novas duplicatas.

-- === A) Inspecionar duplicatas (execute primeiro para revisar) ===
SELECT
  obra_id,
  lower(trim(nome)) AS nome_norm,
  COUNT(*) AS cnt,
  array_agg(json_build_object('id', id, 'nome', nome, 'created_at', created_at) ORDER BY created_at DESC) AS items
FROM cronogramas
GROUP BY obra_id, lower(trim(nome))
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- === B) Backup: copiar duplicatas encontradas para tabela de segurança ===
-- (Isto cria a tabela se não existir e insere todos os registros que fazem parte de grupos duplicados)
CREATE TABLE IF NOT EXISTS cronogramas_duplicates_backup AS
SELECT * FROM cronogramas WHERE 1=2;

WITH dupe_ids AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY obra_id, lower(trim(nome)) ORDER BY created_at DESC) AS rn
    FROM cronogramas
  ) t
  WHERE t.rn > 0
)
INSERT INTO cronogramas_duplicates_backup
SELECT * FROM cronogramas WHERE id IN (SELECT id FROM dupe_ids);

-- Nota: a query acima copia todos os registros (inclusive os que serão mantidos). Se preferir apenas
-- copiar os registros que serão removidos (ou seja, rn > 1), substitua a CTE por rn > 1.

-- === C) Remover duplicatas (mantém o registro MAIS RECENTE por (obra_id, nome normalizado)) ===
WITH ranked AS (
  SELECT id, obra_id, lower(trim(nome)) AS nome_norm,
    ROW_NUMBER() OVER (PARTITION BY obra_id, lower(trim(nome)) ORDER BY created_at DESC) AS rn
  FROM cronogramas
)
DELETE FROM cronogramas
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- === D) Criar índice único para prevenir duplicatas futuras ===
CREATE UNIQUE INDEX IF NOT EXISTS idx_cronogramas_obra_nome_unique
ON cronogramas (obra_id, lower(trim(nome)));

-- === FIM ===
-- Recomendo rodar a seção A primeiro (apenas SELECT) e revisar o resultado.
-- Em seguida, rode B (backup), C (delete) e por fim D (index).
-- OBS: sempre faça backup do banco ou execute em um ambiente de teste antes de aplicar em produção.
