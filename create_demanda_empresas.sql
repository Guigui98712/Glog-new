-- Script para criar tabela de empresas em demandas
-- Executar no Supabase

-- Tabela de empresas para demandas (similar às categorias)
create table if not exists public.demanda_empresas (
  id bigint primary key generated always as identity,
  obra_id bigint not null references public.obras(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (obra_id, nome)
);

-- Adicionar coluna de empresa_id na tabela demanda_itens
alter table public.demanda_itens
  add column if not exists empresa_id bigint references public.demanda_empresas(id) on delete set null;

-- Adicionar coluna de empresa (text) como fallback se necessário
alter table public.demanda_itens
  add column if not exists empresa text;

-- Guardar empresa também no histórico mensal de itens pagos
alter table public.demanda_itens_historico_pago
  add column if not exists empresa text;

-- Criar índices para performance
create index if not exists demanda_empresas_obra_id_idx
  on public.demanda_empresas (obra_id);

create index if not exists demanda_empresas_ativo_idx
  on public.demanda_empresas (ativo);

create index if not exists demanda_itens_empresa_id_idx
  on public.demanda_itens (empresa_id);

create index if not exists demanda_itens_empresa_idx
  on public.demanda_itens (empresa);

-- Criar trigger para atualizar updated_at
drop trigger if exists set_updated_at_demanda_empresas on public.demanda_empresas;
create trigger set_updated_at_demanda_empresas
  before update on public.demanda_empresas
  for each row
  execute function update_updated_at_column();

-- Habilitar RLS (Row Level Security)
alter table public.demanda_empresas enable row level security;

-- Criar políticas de segurança para demanda_empresas
drop policy if exists "Usuários autenticados podem ver empresas de demanda" on public.demanda_empresas;
create policy "Usuários autenticados podem ver empresas de demanda"
  on public.demanda_empresas for select
  to authenticated
  using (true);

drop policy if exists "Usuários autenticados podem inserir empresas de demanda" on public.demanda_empresas;
create policy "Usuários autenticados podem inserir empresas de demanda"
  on public.demanda_empresas for insert
  to authenticated
  with check (true);

drop policy if exists "Usuários autenticados podem atualizar empresas de demanda" on public.demanda_empresas;
create policy "Usuários autenticados podem atualizar empresas de demanda"
  on public.demanda_empresas for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuários autenticados podem excluir empresas de demanda" on public.demanda_empresas;
create policy "Usuários autenticados podem excluir empresas de demanda"
  on public.demanda_empresas for delete
  to authenticated
  using (true);
