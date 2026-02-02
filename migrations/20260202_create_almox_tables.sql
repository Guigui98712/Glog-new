-- Migration: criar tabelas para almoxarifado
-- Cria tabela de itens e tabela de movimentos, e função para ajustar quantidade de forma atômica

CREATE TABLE IF NOT EXISTS almox_items (
  id serial PRIMARY KEY,
  obra_id integer REFERENCES obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade text,
  categoria text,
  quantidade numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almox_items_nome_lower ON almox_items (lower(nome));

CREATE TABLE IF NOT EXISTS almox_movements (
  id serial PRIMARY KEY,
  obra_id integer REFERENCES obras(id) ON DELETE CASCADE,
  item_id integer REFERENCES almox_items(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade numeric NOT NULL,
  observacao text,
  criado_em timestamptz DEFAULT now()
);

-- Função RPC para ajustar quantidade do item de forma atômica (pode ser chamada via supabase.rpc)
CREATE OR REPLACE FUNCTION almox_adjust_item_quantity(p_item_id integer, p_delta numeric)
RETURNS numeric AS $$
DECLARE
  new_q numeric;
BEGIN
  UPDATE almox_items
  SET quantidade = COALESCE(quantidade, 0) + p_delta
  WHERE id = p_item_id
  RETURNING quantidade INTO new_q;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % não encontrado', p_item_id;
  END IF;

  RETURN new_q;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
