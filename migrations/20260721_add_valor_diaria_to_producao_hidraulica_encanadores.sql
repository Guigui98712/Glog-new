-- Adiciona valor de diaria por encanador para compor pagamento mensal (producao + diarias).

alter table public.producao_hidraulica_encanadores
  add column if not exists valor_diaria numeric(12, 2) not null default 0;

alter table public.producao_hidraulica_encanadores
  drop constraint if exists producao_hidraulica_encanadores_valor_diaria_non_negative;

alter table public.producao_hidraulica_encanadores
  add constraint producao_hidraulica_encanadores_valor_diaria_non_negative
  check (valor_diaria >= 0);
