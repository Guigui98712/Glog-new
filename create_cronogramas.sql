-- Migration: create table to store cronogramas for obras

CREATE TABLE IF NOT EXISTS cronogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookup by obra_id
CREATE INDEX IF NOT EXISTS idx_cronogramas_obra_id ON cronogramas(obra_id);
