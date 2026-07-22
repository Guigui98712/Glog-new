-- Adiciona valor por lancamento para diarias da producao hidraulica.

alter table public.producao_hidraulica_registros
  add column if not exists valor numeric(12, 2);

alter table public.producao_hidraulica_registros
  drop constraint if exists producao_hidraulica_registros_valor_non_negative;

alter table public.producao_hidraulica_registros
  add constraint producao_hidraulica_registros_valor_non_negative
  check (valor is null or valor >= 0);
