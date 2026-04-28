-- Permite registros de producao sem quantidade (ex.: apenas observacao)
-- Este script remove checks antigos de quantidade > 0 e garante quantidade >= 0.

DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.producao_registros') IS NULL THEN
    RAISE NOTICE 'Tabela public.producao_registros nao encontrada. Nada a fazer.';
    RETURN;
  END IF;

  -- Remove checks que exigem quantidade estritamente maior que zero.
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

  -- Garante que quantidade nao seja negativa.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.producao_registros'::regclass
      AND contype = 'c'
      AND conname = 'producao_registros_quantidade_non_negative_check'
  ) THEN
    ALTER TABLE public.producao_registros
      ADD CONSTRAINT producao_registros_quantidade_non_negative_check
      CHECK (quantidade >= 0);
  END IF;
END $$;
