alter table public.producao_hidraulica_encanadores
  add column if not exists pagina_id uuid;

alter table public.producao_hidraulica_tarefas
  add column if not exists pagina_id uuid;

alter table public.producao_hidraulica_registros
  add column if not exists pagina_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_hidraulica_encanadores_pagina_id_fkey'
      and conrelid = 'public.producao_hidraulica_encanadores'::regclass
  ) then
    alter table public.producao_hidraulica_encanadores
      add constraint producao_hidraulica_encanadores_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_hidraulica_tarefas_pagina_id_fkey'
      and conrelid = 'public.producao_hidraulica_tarefas'::regclass
  ) then
    alter table public.producao_hidraulica_tarefas
      add constraint producao_hidraulica_tarefas_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_hidraulica_registros_pagina_id_fkey'
      and conrelid = 'public.producao_hidraulica_registros'::regclass
  ) then
    alter table public.producao_hidraulica_registros
      add constraint producao_hidraulica_registros_pagina_id_fkey
      foreign key (pagina_id) references public.producao_empreita_paginas(id) on delete restrict;
  end if;
end;
$$;

create index if not exists idx_producao_hidraulica_encanadores_obra_pagina
  on public.producao_hidraulica_encanadores (obra_id, pagina_id);

create index if not exists idx_producao_hidraulica_tarefas_obra_pagina_ordem
  on public.producao_hidraulica_tarefas (obra_id, pagina_id, ordem);

create index if not exists idx_producao_hidraulica_registros_obra_pagina_data
  on public.producao_hidraulica_registros (obra_id, pagina_id, data);
