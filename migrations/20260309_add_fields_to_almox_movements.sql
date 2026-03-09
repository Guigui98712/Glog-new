-- Adiciona campos extras no histórico de movimentações do almoxarifado
-- Entrada: número do pedido e nome da empresa
-- Saída: nome da pessoa que retirou o item

ALTER TABLE IF EXISTS almox_movements
  ADD COLUMN IF NOT EXISTS numero_pedido TEXT,
  ADD COLUMN IF NOT EXISTS empresa_nome TEXT,
  ADD COLUMN IF NOT EXISTS retirado_por TEXT;

-- Índices opcionais para buscas por texto no histórico
CREATE INDEX IF NOT EXISTS idx_almox_movements_numero_pedido_lower
  ON almox_movements (LOWER(numero_pedido));

CREATE INDEX IF NOT EXISTS idx_almox_movements_empresa_nome_lower
  ON almox_movements (LOWER(empresa_nome));

CREATE INDEX IF NOT EXISTS idx_almox_movements_retirado_por_lower
  ON almox_movements (LOWER(retirado_por));
