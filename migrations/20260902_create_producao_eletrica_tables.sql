-- Estrutura de producao para equipe de eletrica (eletricistas).
-- Execute este arquivo no SQL Editor do Supabase antes de usar a pagina de Eletrica.

create table if not exists public.producao_eletrica_eletricistas (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  valor_diaria numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_eletrica_eletricistas_valor_diaria_non_negative check (valor_diaria >= 0)
);

create index if not exists idx_producao_eletrica_eletricistas_obra_nome
  on public.producao_eletrica_eletricistas (obra_id, nome);

create table if not exists public.producao_eletrica_tarefas (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  nome text not null,
  valor numeric(12, 2) not null default 0,
  metragem_prevista numeric(12, 2) not null default 0,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_eletrica_tarefas_valor_non_negative check (valor >= 0),
  constraint producao_eletrica_tarefas_metragem_prevista_non_negative check (metragem_prevista >= 0)
);

create index if not exists idx_producao_eletrica_tarefas_obra_ordem
  on public.producao_eletrica_tarefas (obra_id, ordem);

create table if not exists public.producao_eletrica_registros (
  id uuid primary key default gen_random_uuid(),
  obra_id integer not null references public.obras(id) on delete cascade,
  eletricista_id uuid not null references public.producao_eletrica_eletricistas(id) on delete restrict,
  tarefa_id uuid references public.producao_eletrica_tarefas(id) on delete restrict,
  eh_diaria boolean not null default false,
  fator_diaria numeric(2, 1) not null default 1 check (fator_diaria in (0.5, 1)),
  valor numeric(12, 2),
  data date not null,
  data_inicio date not null,
  data_fim date,
  metragem numeric(12, 2),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_eletrica_registros_metragem_positive check (metragem is null or metragem > 0),
  constraint producao_eletrica_registros_valor_non_negative check (valor is null or valor >= 0),
  constraint producao_eletrica_registros_tarefa_required check (eh_diaria or tarefa_id is not null)
);

create index if not exists idx_producao_eletrica_registros_obra_data
  on public.producao_eletrica_registros (obra_id, data);

create index if not exists idx_producao_eletrica_registros_eletricista
  on public.producao_eletrica_registros (eletricista_id);

create index if not exists idx_producao_eletrica_registros_diaria_data
  on public.producao_eletrica_registros (obra_id, eh_diaria, data);

alter table public.producao_eletrica_eletricistas enable row level security;
alter table public.producao_eletrica_tarefas enable row level security;
alter table public.producao_eletrica_registros enable row level security;

create policy producao_eletrica_eletricistas_select_shared
  on public.producao_eletrica_eletricistas for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));
create policy producao_eletrica_eletricistas_insert_shared
  on public.producao_eletrica_eletricistas for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_eletricistas_update_shared
  on public.producao_eletrica_eletricistas for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint)) with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_eletricistas_delete_shared
  on public.producao_eletrica_eletricistas for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));

create policy producao_eletrica_tarefas_select_shared
  on public.producao_eletrica_tarefas for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));
create policy producao_eletrica_tarefas_insert_shared
  on public.producao_eletrica_tarefas for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_tarefas_update_shared
  on public.producao_eletrica_tarefas for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint)) with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_tarefas_delete_shared
  on public.producao_eletrica_tarefas for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));

create policy producao_eletrica_registros_select_shared
  on public.producao_eletrica_registros for select to authenticated
  using (public.user_can_view_obra(obra_id::bigint));
create policy producao_eletrica_registros_insert_shared
  on public.producao_eletrica_registros for insert to authenticated
  with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_registros_update_shared
  on public.producao_eletrica_registros for update to authenticated
  using (public.user_can_edit_obra(obra_id::bigint)) with check (public.user_can_edit_obra(obra_id::bigint));
create policy producao_eletrica_registros_delete_shared
  on public.producao_eletrica_registros for delete to authenticated
  using (public.user_can_edit_obra(obra_id::bigint));