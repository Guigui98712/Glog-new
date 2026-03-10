-- Mantem itens excluidos no historico com exclusao logica

ALTER TABLE IF EXISTS almox_items
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_almox_items_obra_not_deleted
  ON almox_items (obra_id, is_deleted);
