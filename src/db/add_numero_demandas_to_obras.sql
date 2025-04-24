-- Adicionar coluna numero_demandas à tabela obras
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS numero_demandas INTEGER DEFAULT 0;

-- Criar função para recalcular o número de demandas
CREATE OR REPLACE FUNCTION recalcular_numero_demandas(obra_id_param INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.obras o
  SET numero_demandas = (
    SELECT COUNT(*)
    FROM public.demanda_itens di
    WHERE di.obra_id = obra_id_param
    AND di.status = 'demanda'
  )
  WHERE id = obra_id_param;
END;
$$ LANGUAGE plpgsql;

-- Criar função para atualizar numero_demandas automaticamente
CREATE OR REPLACE FUNCTION update_obra_numero_demandas()
RETURNS TRIGGER AS $$
BEGIN
  -- Em caso de INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'demanda' THEN
      PERFORM recalcular_numero_demandas(NEW.obra_id);
    END IF;
  
  -- Em caso de UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se o status mudou
    IF OLD.status != NEW.status THEN
      PERFORM recalcular_numero_demandas(NEW.obra_id);
    END IF;
    -- Se a obra_id mudou, atualizar ambas as obras
    IF OLD.obra_id != NEW.obra_id THEN
      PERFORM recalcular_numero_demandas(OLD.obra_id);
      PERFORM recalcular_numero_demandas(NEW.obra_id);
    END IF;
  
  -- Em caso de DELETE
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'demanda' THEN
      PERFORM recalcular_numero_demandas(OLD.obra_id);
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para manter numero_demandas atualizado
DROP TRIGGER IF EXISTS update_obra_numero_demandas ON public.demanda_itens;
CREATE TRIGGER update_obra_numero_demandas
AFTER INSERT OR DELETE OR UPDATE ON public.demanda_itens
FOR EACH ROW
EXECUTE FUNCTION update_obra_numero_demandas();

-- Atualizar o número de demandas para todas as obras existentes
DO $$
DECLARE
  obra record;
BEGIN
  FOR obra IN SELECT id FROM public.obras
  LOOP
    PERFORM recalcular_numero_demandas(obra.id);
  END LOOP;
END;
$$; 