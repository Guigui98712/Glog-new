-- Criar bucket para notas fiscais (se não existir)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'notas-fiscais') then
    insert into storage.buckets (id, name, public) values ('notas-fiscais', 'notas-fiscais', true);
  end if;
end $$;

-- Importar políticas de storage
\i storage_policies.sql

-- Criar tabela de itens de demanda
create table demanda_itens (
  id bigint primary key generated always as identity,
  obra_id bigint references obras(id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null check (status in ('demanda', 'pedido', 'entregue', 'pago')),
  data_criacao timestamp with time zone not null default now(),
  data_pedido timestamp with time zone,
  data_entrega timestamp with time zone,
  data_pagamento timestamp with time zone,
  valor decimal(10,2),
  pedido_completo boolean,
  observacao_entrega text,
  nota_fiscal text,
  tempo_entrega text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Criar índices
create index demanda_itens_obra_id_idx on demanda_itens(obra_id);
create index demanda_itens_status_idx on demanda_itens(status);

-- Criar trigger para atualizar updated_at
create trigger set_updated_at
  before update on demanda_itens
  for each row
  execute function update_updated_at_column(); 