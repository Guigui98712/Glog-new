-- Permite registrar dias como diaria na producao hidraulica sem vincular a uma tarefa.

alter table public.producao_hidraulica_registros
  add column if not exists eh_diaria boolean not null default false;

alter table public.producao_hidraulica_registros
  alter column tarefa_id drop not null;

create index if not exists idx_producao_hidraulica_registros_diaria_data
  on public.producao_hidraulica_registros (obra_id, eh_diaria, data);
