-- Ajuste defensivo de RLS em public.obras para cenarios onde
-- policies baseadas em funcoes de compartilhamento possam falhar.

begin;

alter table public.obras enable row level security;
alter table public.obras alter column user_id set default auth.uid();

-- Limpa policies atuais da tabela.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'obras'
  loop
    execute format('drop policy if exists %I on public.obras;', p.policyname);
  end loop;
end;
$$;

-- INSERT e DELETE sempre por dono.
create policy obras_insert_owner
on public.obras
for insert
to authenticated
with check (coalesce(user_id, auth.uid()) = auth.uid());

create policy obras_delete_owner
on public.obras
for delete
to authenticated
using (user_id = auth.uid());

-- SELECT/UPDATE: se a tabela de compartilhamentos existir, permite compartilhado.
-- Caso contrario, aplica regra apenas por dono da obra.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'compartilhamentos'
  ) then
    execute '
      create policy obras_select_owner_or_shared
      on public.obras
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.compartilhamentos c
          where c.obra_id = public.obras.id
            and (
              c.colaborador_id = auth.uid()
              or lower(coalesce(c.colaborador_email, '''')) = lower(coalesce(auth.jwt() ->> ''email'', ''''))
            )
        )
      );
    ';

    execute '
      create policy obras_update_owner_or_shared
      on public.obras
      for update
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.compartilhamentos c
          where c.obra_id = public.obras.id
            and (
              c.colaborador_id = auth.uid()
              or lower(coalesce(c.colaborador_email, '''')) = lower(coalesce(auth.jwt() ->> ''email'', ''''))
            )
            and lower(coalesce(c.permissao, ''editar'')) <> ''visualizar''
        )
      )
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.compartilhamentos c
          where c.obra_id = public.obras.id
            and (
              c.colaborador_id = auth.uid()
              or lower(coalesce(c.colaborador_email, '''')) = lower(coalesce(auth.jwt() ->> ''email'', ''''))
            )
            and lower(coalesce(c.permissao, ''editar'')) <> ''visualizar''
        )
      );
    ';
  else
    execute '
      create policy obras_select_owner
      on public.obras
      for select
      to authenticated
      using (user_id = auth.uid());
    ';

    execute '
      create policy obras_update_owner
      on public.obras
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    ';
  end if;
end;
$$;

commit;
