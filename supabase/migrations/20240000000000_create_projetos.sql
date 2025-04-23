create table if not exists projetos (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  tipo text not null check (tipo in ('DWG', 'REVIT', 'PDF')),
  url text not null,
  obra_id uuid not null references obras(id) on delete cascade,
  data_upload timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar política RLS para permitir acesso apenas a usuários autenticados
create policy "Permitir acesso a projetos para usuários autenticados"
  on projetos
  for all
  using (auth.role() = 'authenticated');

-- Habilitar RLS na tabela
alter table projetos enable row level security; 