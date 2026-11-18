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
