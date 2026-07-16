-- Estrutura de producao para equipe de hidraulica (encanadores).
-- Mantem o mesmo modelo de acesso compartilhado da producao de pedreiros.

create table if not exists public.producao_hidraulica_encanadores (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_producao_hidraulica_encanadores_obra_nome
  on public.producao_hidraulica_encanadores (obra_id, nome);

create table if not exists public.producao_hidraulica_tarefas (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  nome text not null,
  valor numeric(12, 2) not null default 0,
  metragem_prevista numeric(12, 2) not null default 0,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_hidraulica_tarefas_valor_non_negative check (valor >= 0),
  constraint producao_hidraulica_tarefas_metragem_prevista_non_negative check (metragem_prevista >= 0)
);

create index if not exists idx_producao_hidraulica_tarefas_obra_ordem
  on public.producao_hidraulica_tarefas (obra_id, ordem);

create table if not exists public.producao_hidraulica_registros (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  tarefa_id uuid not null references public.producao_hidraulica_tarefas(id) on delete restrict,
  data date not null,
  data_inicio date not null,
  data_fim date,
  metragem numeric(12, 2),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_hidraulica_registros_metragem_positive check (metragem is null or metragem > 0)
);

alter table public.producao_hidraulica_registros
  add column if not exists encanador_id uuid references public.producao_hidraulica_encanadores(id) on delete restrict;

alter table public.producao_hidraulica_registros
  add column if not exists data_fim date;

alter table public.producao_hidraulica_registros
  alter column metragem drop not null;

alter table public.producao_hidraulica_registros
  drop constraint if exists producao_hidraulica_registros_metragem_positive;

alter table public.producao_hidraulica_registros
  add constraint producao_hidraulica_registros_metragem_positive
  check (metragem is null or metragem > 0);

create index if not exists idx_producao_hidraulica_registros_obra_data
  on public.producao_hidraulica_registros (obra_id, data);

create index if not exists idx_producao_hidraulica_registros_tarefa
  on public.producao_hidraulica_registros (tarefa_id);

create index if not exists idx_producao_hidraulica_registros_encanador
  on public.producao_hidraulica_registros (encanador_id);

alter table public.producao_hidraulica_encanadores enable row level security;
alter table public.producao_hidraulica_tarefas enable row level security;
alter table public.producao_hidraulica_registros enable row level security;

drop policy if exists producao_hidraulica_encanadores_select_shared on public.producao_hidraulica_encanadores;
drop policy if exists producao_hidraulica_encanadores_insert_shared on public.producao_hidraulica_encanadores;
drop policy if exists producao_hidraulica_encanadores_update_shared on public.producao_hidraulica_encanadores;
drop policy if exists producao_hidraulica_encanadores_delete_shared on public.producao_hidraulica_encanadores;

create policy producao_hidraulica_encanadores_select_shared
  on public.producao_hidraulica_encanadores
  for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));

create policy producao_hidraulica_encanadores_insert_shared
  on public.producao_hidraulica_encanadores
  for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_encanadores_update_shared
  on public.producao_hidraulica_encanadores
  for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint))
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_encanadores_delete_shared
  on public.producao_hidraulica_encanadores
  for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));

drop policy if exists producao_hidraulica_tarefas_select_shared on public.producao_hidraulica_tarefas;
drop policy if exists producao_hidraulica_tarefas_insert_shared on public.producao_hidraulica_tarefas;
drop policy if exists producao_hidraulica_tarefas_update_shared on public.producao_hidraulica_tarefas;
drop policy if exists producao_hidraulica_tarefas_delete_shared on public.producao_hidraulica_tarefas;

create policy producao_hidraulica_tarefas_select_shared
  on public.producao_hidraulica_tarefas
  for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));

create policy producao_hidraulica_tarefas_insert_shared
  on public.producao_hidraulica_tarefas
  for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_tarefas_update_shared
  on public.producao_hidraulica_tarefas
  for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint))
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_tarefas_delete_shared
  on public.producao_hidraulica_tarefas
  for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));

drop policy if exists producao_hidraulica_registros_select_shared on public.producao_hidraulica_registros;
drop policy if exists producao_hidraulica_registros_insert_shared on public.producao_hidraulica_registros;
drop policy if exists producao_hidraulica_registros_update_shared on public.producao_hidraulica_registros;
drop policy if exists producao_hidraulica_registros_delete_shared on public.producao_hidraulica_registros;

create policy producao_hidraulica_registros_select_shared
  on public.producao_hidraulica_registros
  for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));

create policy producao_hidraulica_registros_insert_shared
  on public.producao_hidraulica_registros
  for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_registros_update_shared
  on public.producao_hidraulica_registros
  for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint))
  with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_hidraulica_registros_delete_shared
  on public.producao_hidraulica_registros
  for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));
