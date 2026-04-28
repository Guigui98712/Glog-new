alter table public.demanda_itens
  add column if not exists categoria text;

create index if not exists demanda_itens_categoria_idx
  on public.demanda_itens (categoria);

create table if not exists public.demanda_categorias (
  id bigint primary key generated always as identity,
  obra_id bigint not null references public.obras(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (obra_id, nome)
);

create index if not exists demanda_categorias_obra_id_idx
  on public.demanda_categorias (obra_id);

create index if not exists demanda_categorias_ativo_idx
  on public.demanda_categorias (ativo);

drop trigger if exists set_updated_at_demanda_categorias on public.demanda_categorias;
create trigger set_updated_at_demanda_categorias
  before update on public.demanda_categorias
  for each row
  execute function update_updated_at_column();

alter table public.demanda_categorias enable row level security;

drop policy if exists "Usuários autenticados podem ver categorias de demanda" on public.demanda_categorias;
create policy "Usuários autenticados podem ver categorias de demanda"
  on public.demanda_categorias for select
  to authenticated
  using (true);

drop policy if exists "Usuários autenticados podem inserir categorias de demanda" on public.demanda_categorias;
create policy "Usuários autenticados podem inserir categorias de demanda"
  on public.demanda_categorias for insert
  to authenticated
  with check (true);

drop policy if exists "Usuários autenticados podem atualizar categorias de demanda" on public.demanda_categorias;
create policy "Usuários autenticados podem atualizar categorias de demanda"
  on public.demanda_categorias for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuários autenticados podem excluir categorias de demanda" on public.demanda_categorias;
create policy "Usuários autenticados podem excluir categorias de demanda"
  on public.demanda_categorias for delete
  to authenticated
  using (true);