BEGIN;

-- Limpa apenas o histórico de itens que passaram por "pago".
-- Nao altera os itens atuais da tabela demanda_itens.
DELETE FROM public.demanda_itens_historico_pago;

-- Reinicia o contador do ID da tabela de histórico.
ALTER SEQUENCE IF EXISTS public.demanda_itens_historico_pago_id_seq RESTART WITH 1;

COMMIT;