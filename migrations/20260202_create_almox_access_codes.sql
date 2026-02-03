-- Tabela de códigos de acesso temporário ao Almoxarifado
create table if not exists almox_access_codes (
  id bigserial primary key,
  obra_id bigint not null references obras(id) on delete cascade,
  code varchar(10) not null unique,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_almox_access_codes_obra_id on almox_access_codes(obra_id);
create index if not exists idx_almox_access_codes_code on almox_access_codes(code);
