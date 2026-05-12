-- Permite registros de producao sem quantidade (ex.: apenas observacao)
-- Remove constraints antigas e aplica regra nova:
-- 1) quantidade nunca negativa
-- 2) quando quantidade = 0, observacao obrigatoria
-- 3) quando observacao com tag [FALTOU], quantidade deve ser 0

DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.producao_registros') IS NULL THEN
    RAISE NOTICE 'Tabela public.producao_registros nao encontrada. Nada a fazer.';
    RETURN;
  END IF;

  -- Remove checks antigos de quantidade estritamente maior que zero.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.producao_registros'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%quantidade%'
      AND pg_get_constraintdef(oid) ILIKE '%> 0%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%>= 0%'
  LOOP
    EXECUTE format('ALTER TABLE public.producao_registros DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- Remove constraint antiga de falta/quantidade, se existir.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.producao_registros'::regclass
      AND contype = 'c'
      AND conname = 'producao_registros_falta_quantidade_chk'
  ) THEN
    ALTER TABLE public.producao_registros
      DROP CONSTRAINT producao_registros_falta_quantidade_chk;
  END IF;

  -- Remove checks antigos equivalentes para evitar conflito com a regra nova.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.producao_registros'::regclass
      AND contype = 'c'
      AND conname IN (
        'producao_registros_quantidade_non_negative_check',
        'producao_registros_quantidade_observacao_check'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.producao_registros DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- Regra final consolidada.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.producao_registros'::regclass
      AND contype = 'c'
      AND conname = 'producao_registros_quantidade_observacao_check'
  ) THEN
    ALTER TABLE public.producao_registros
      ADD CONSTRAINT producao_registros_quantidade_observacao_check
      CHECK (
        quantidade >= 0
        AND (
          quantidade > 0
          OR nullif(trim(coalesce(observacao, '')), '') IS NOT NULL
        )
        AND (
          coalesce(observacao, '') !~ '^\\[FALTOU\\]'
          OR quantidade = 0
        )
      );
  END IF;
END $$;
