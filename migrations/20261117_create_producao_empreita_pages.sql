create table if not exists public.producao_empreita_paginas (
  id uuid primary key default gen_random_uuid(),
  obra_id bigint not null references public.obras(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  tipo text not null default 'empreita' check (tipo in ('empreita', 'hidraulica', 'eletrica')),
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.producao_empreita_paginas
  add column if not exists tipo text not null default 'empreita';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_empreita_paginas_tipo_check'
      and conrelid = 'public.producao_empreita_paginas'::regclass
  ) then
    alter table public.producao_empreita_paginas
      add constraint producao_empreita_paginas_tipo_check
      check (tipo in ('empreita', 'hidraulica', 'eletrica'));
  end if;
end;
$$;

drop index if exists public.idx_producao_empreita_paginas_nome_ativo;

insert into public.producao_empreita_paginas (obra_id, nome, tipo)
select o.id, 'Hidráulica', 'hidraulica'
from public.obras o
where not exists (
  select 1 from public.producao_empreita_paginas p
  where p.obra_id = o.id and p.tipo = 'hidraulica'
);

insert into public.producao_empreita_paginas (obra_id, nome, tipo)
select o.id, 'Elétrica', 'eletrica'
from public.obras o
where not exists (
  select 1 from public.producao_empreita_paginas p
  where p.obra_id = o.id and p.tipo = 'eletrica'
);

create unique index if not exists idx_producao_empreita_paginas_nome_ativo
  on public.producao_empreita_paginas (obra_id, lower(nome))
  where arquivada = false and tipo = 'empreita';

create unique index if not exists idx_producao_paginas_tipo_fixo
  on public.producao_empreita_paginas (obra_id, tipo)
  where tipo in ('hidraulica', 'eletrica');

create or replace function public.criar_paginas_producao_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.producao_empreita_paginas (obra_id, nome, tipo)
  values
    (new.id, 'Hidráulica', 'hidraulica'),
    (new.id, 'Elétrica', 'eletrica')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists criar_paginas_producao_padrao_apos_obra on public.obras;
create trigger criar_paginas_producao_padrao_apos_obra
  after insert on public.obras
  for each row execute function public.criar_paginas_producao_padrao();

alter table public.producao_pedreiros
  add column if not exists pagina_id uuid;

alter table public.producao_tarefas
  add column if not exists pagina_id uuid;

alter table public.producao_registros
  add column if not exists pagina_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_pedreiros_pagina_id_fkey'
      and conrelid = 'public.producao_pedreiros'::regclass
  ) then
    alter table public.producao_pedreiros
      add constraint producao_pedreiros_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_tarefas_pagina_id_fkey'
      and conrelid = 'public.producao_tarefas'::regclass
  ) then
    alter table public.producao_tarefas
      add constraint producao_tarefas_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_registros_pagina_id_fkey'
      and conrelid = 'public.producao_registros'::regclass
  ) then
    alter table public.producao_registros
      add constraint producao_registros_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;
end;
$$;

create index if not exists idx_producao_pedreiros_obra_pagina
  on public.producao_pedreiros (obra_id, pagina_id);

create index if not exists idx_producao_tarefas_obra_pagina_ordem
  on public.producao_tarefas (obra_id, pagina_id, ordem);

create index if not exists idx_producao_registros_obra_pagina_data
  on public.producao_registros (obra_id, pagina_id, data);

alter table public.producao_empreita_paginas enable row level security;

drop policy if exists producao_empreita_paginas_select_shared on public.producao_empreita_paginas;
create policy producao_empreita_paginas_select_shared
  on public.producao_empreita_paginas for select to authenticated
  using (public.user_can_view_obra(obra_id));

drop policy if exists producao_empreita_paginas_insert_shared on public.producao_empreita_paginas;
create policy producao_empreita_paginas_insert_shared
  on public.producao_empreita_paginas for insert to authenticated
  with check (public.user_can_edit_obra(obra_id));

drop policy if exists producao_empreita_paginas_update_shared on public.producao_empreita_paginas;
create policy producao_empreita_paginas_update_shared
  on public.producao_empreita_paginas for update to authenticated
  using (public.user_can_edit_obra(obra_id))
  with check (public.user_can_edit_obra(obra_id));
