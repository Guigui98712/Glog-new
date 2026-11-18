alter table public.obras
  add column if not exists numero_pavimentos integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'obras_numero_pavimentos_positive'
      and conrelid = 'public.obras'::regclass
  ) then
    alter table public.obras
      add constraint obras_numero_pavimentos_positive
      check (numero_pavimentos is null or numero_pavimentos > 0);
  end if;
end;
$$;

create table if not exists public.obra_etapas_categorias (
  id uuid primary key default gen_random_uuid(),
  obra_id bigint not null references public.obras(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  created_at timestamptz not null default now(),
  unique (id, obra_id)
);

create unique index if not exists idx_obra_etapas_categorias_nome
  on public.obra_etapas_categorias (obra_id, lower(nome));

create table if not exists public.obra_etapas_detalhadas (
  id uuid primary key default gen_random_uuid(),
  obra_id bigint not null references public.obras(id) on delete cascade,
  categoria_id uuid not null,
  nome text not null check (length(btrim(nome)) > 0),
  created_at timestamptz not null default now(),
  unique (id, obra_id),
  constraint obra_etapas_detalhadas_categoria_fkey
    foreign key (categoria_id, obra_id)
    references public.obra_etapas_categorias(id, obra_id) on delete cascade
);

create unique index if not exists idx_obra_etapas_detalhadas_nome
  on public.obra_etapas_detalhadas (obra_id, categoria_id, lower(nome));

create table if not exists public.obra_etapas_conclusoes (
  id uuid primary key default gen_random_uuid(),
  obra_id bigint not null references public.obras(id) on delete cascade,
  etapa_id uuid not null,
  pavimento integer not null check (pavimento > 0),
  data_conclusao date not null default current_date,
  observacao text,
  created_at timestamptz not null default now(),
  constraint obra_etapas_conclusoes_etapa_fkey
    foreign key (etapa_id, obra_id)
    references public.obra_etapas_detalhadas(id, obra_id) on delete restrict,
  unique (obra_id, pavimento, etapa_id)
);

create index if not exists idx_obra_etapas_conclusoes_obra_data
  on public.obra_etapas_conclusoes (obra_id, data_conclusao desc);

alter table public.obra_etapas_categorias enable row level security;
alter table public.obra_etapas_detalhadas enable row level security;
alter table public.obra_etapas_conclusoes enable row level security;

drop policy if exists obra_etapas_categorias_select_shared on public.obra_etapas_categorias;
create policy obra_etapas_categorias_select_shared
  on public.obra_etapas_categorias for select to authenticated
  using (public.user_can_view_obra(obra_id));
drop policy if exists obra_etapas_categorias_insert_shared on public.obra_etapas_categorias;
create policy obra_etapas_categorias_insert_shared
  on public.obra_etapas_categorias for insert to authenticated
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_categorias_update_shared on public.obra_etapas_categorias;
create policy obra_etapas_categorias_update_shared
  on public.obra_etapas_categorias for update to authenticated
  using (public.user_can_edit_obra(obra_id))
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_categorias_delete_shared on public.obra_etapas_categorias;
create policy obra_etapas_categorias_delete_shared
  on public.obra_etapas_categorias for delete to authenticated
  using (public.user_can_edit_obra(obra_id));

drop policy if exists obra_etapas_detalhadas_select_shared on public.obra_etapas_detalhadas;
create policy obra_etapas_detalhadas_select_shared
  on public.obra_etapas_detalhadas for select to authenticated
  using (public.user_can_view_obra(obra_id));
drop policy if exists obra_etapas_detalhadas_insert_shared on public.obra_etapas_detalhadas;
create policy obra_etapas_detalhadas_insert_shared
  on public.obra_etapas_detalhadas for insert to authenticated
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_detalhadas_update_shared on public.obra_etapas_detalhadas;
create policy obra_etapas_detalhadas_update_shared
  on public.obra_etapas_detalhadas for update to authenticated
  using (public.user_can_edit_obra(obra_id))
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_detalhadas_delete_shared on public.obra_etapas_detalhadas;
create policy obra_etapas_detalhadas_delete_shared
  on public.obra_etapas_detalhadas for delete to authenticated
  using (public.user_can_edit_obra(obra_id));

drop policy if exists obra_etapas_conclusoes_select_shared on public.obra_etapas_conclusoes;
create policy obra_etapas_conclusoes_select_shared
  on public.obra_etapas_conclusoes for select to authenticated
  using (public.user_can_view_obra(obra_id));
drop policy if exists obra_etapas_conclusoes_insert_shared on public.obra_etapas_conclusoes;
create policy obra_etapas_conclusoes_insert_shared
  on public.obra_etapas_conclusoes for insert to authenticated
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_conclusoes_update_shared on public.obra_etapas_conclusoes;
create policy obra_etapas_conclusoes_update_shared
  on public.obra_etapas_conclusoes for update to authenticated
  using (public.user_can_edit_obra(obra_id))
  with check (public.user_can_edit_obra(obra_id));
drop policy if exists obra_etapas_conclusoes_delete_shared on public.obra_etapas_conclusoes;
create policy obra_etapas_conclusoes_delete_shared
  on public.obra_etapas_conclusoes for delete to authenticated
  using (public.user_can_edit_obra(obra_id));
