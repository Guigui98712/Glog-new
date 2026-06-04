BEGIN;

-- Garante as colunas necessarias para o backfill.
ALTER TABLE public.demanda_itens_historico_pago
  ADD COLUMN IF NOT EXISTS empresa TEXT;

ALTER TABLE public.demanda_itens
  ADD COLUMN IF NOT EXISTS empresa TEXT;

-- Preenche empresa/categoria vazias no historico de pagos.
-- Prioridade de fonte:
-- 1) dado atual em demanda_itens
-- 2) outro registro historico do mesmo demanda_item_id com valor preenchido

WITH referencia_historico AS (
  SELECT
    demanda_item_id,
    MAX(categoria) FILTER (WHERE categoria IS NOT NULL AND BTRIM(categoria) <> '') AS categoria_ref,
    MAX(empresa) FILTER (WHERE empresa IS NOT NULL AND BTRIM(empresa) <> '') AS empresa_ref
  FROM public.demanda_itens_historico_pago
  WHERE demanda_item_id IS NOT NULL
  GROUP BY demanda_item_id
)
UPDATE public.demanda_itens_historico_pago h
SET
  categoria = COALESCE(
    NULLIF(BTRIM(h.categoria), ''),
    NULLIF(BTRIM(d.categoria), ''),
    rh.categoria_ref
  ),
  empresa = COALESCE(
    NULLIF(BTRIM(h.empresa), ''),
    NULLIF(BTRIM(d.empresa), ''),
    rh.empresa_ref
  )
FROM referencia_historico rh
LEFT JOIN public.demanda_itens d
  ON d.id = rh.demanda_item_id
WHERE h.demanda_item_id = rh.demanda_item_id
  AND (
    (h.categoria IS NULL OR BTRIM(h.categoria) = '')
    OR
    (h.empresa IS NULL OR BTRIM(h.empresa) = '')
  );

COMMIT;