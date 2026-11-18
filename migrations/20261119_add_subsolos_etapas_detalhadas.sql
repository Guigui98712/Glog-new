alter table public.obras
  add column if not exists numero_subsolos integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'obras_numero_subsolos_range'
      and conrelid = 'public.obras'::regclass
  ) then
    alter table public.obras
      add constraint obras_numero_subsolos_range
      check (numero_subsolos between 0 and 200);
  end if;
end;
$$;

alter table public.obra_etapas_conclusoes
  drop constraint if exists obra_etapas_conclusoes_pavimento_check;

update public.obra_etapas_conclusoes
set pavimento = pavimento - 1
where pavimento > 0;

alter table public.obra_etapas_conclusoes
  add constraint obra_etapas_conclusoes_pavimento_range
  check (pavimento between -200 and 200);
