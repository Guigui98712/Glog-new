BEGIN;

-- 1) Colunas de arquivamento
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivada_por uuid REFERENCES auth.users(id);

-- 2) Indice para acelerar listagens por usuario (ativas/arquivadas)
CREATE INDEX IF NOT EXISTS idx_obras_user_arquivada_created_at
  ON public.obras (user_id, arquivada, created_at DESC);

-- 3) Funcao para arquivar obra
CREATE OR REPLACE FUNCTION public.arquivar_obra(p_obra_id integer)
RETURNS public.obras
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_obra public.obras;
BEGIN
  UPDATE public.obras
     SET arquivada = true,
         arquivada_em = now(),
         arquivada_por = auth.uid(),
         updated_at = now()
   WHERE id = p_obra_id
  RETURNING * INTO v_obra;

  IF v_obra.id IS NULL THEN
    RAISE EXCEPTION 'Obra % nao encontrada ou sem permissao', p_obra_id;
  END IF;

  RETURN v_obra;
END;
$$;

-- 4) Funcao para desarquivar obra
CREATE OR REPLACE FUNCTION public.desarquivar_obra(p_obra_id integer)
RETURNS public.obras
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_obra public.obras;
BEGIN
  UPDATE public.obras
     SET arquivada = false,
         arquivada_em = NULL,
         arquivada_por = NULL,
         updated_at = now()
   WHERE id = p_obra_id
  RETURNING * INTO v_obra;

  IF v_obra.id IS NULL THEN
    RAISE EXCEPTION 'Obra % nao encontrada ou sem permissao', p_obra_id;
  END IF;

  RETURN v_obra;
END;
$$;

COMMIT;
