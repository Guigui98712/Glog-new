-- Enable shared obra access for production tables.
-- Owner: full access
-- Shared with permission "visualizar": read-only
-- Shared with other permissions: read/write

create or replace function public.user_can_view_obra(p_obra_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = p_obra_id
      and o.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.compartilhamentos c
    where c.obra_id = p_obra_id
      and (
        c.colaborador_id = auth.uid()
        or lower(coalesce(c.colaborador_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.user_can_edit_obra(p_obra_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = p_obra_id
      and o.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.compartilhamentos c
    where c.obra_id = p_obra_id
      and (
        c.colaborador_id = auth.uid()
        or lower(coalesce(c.colaborador_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and lower(coalesce(c.permissao, 'editar')) <> 'visualizar'
  );
$$;

grant execute on function public.user_can_view_obra(bigint) to authenticated;
grant execute on function public.user_can_edit_obra(bigint) to authenticated;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'producao_pedreiros',
    'producao_tarefas',
    'producao_registros',
    'feriados_producao'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'obra_id'
    ) then
      execute format('alter table public.%I enable row level security;', t);

      for p in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = t
      loop
        execute format('drop policy if exists %I on public.%I;', p.policyname, t);
      end loop;

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.user_can_view_obra(obra_id::bigint));',
        t || '_select_shared', t
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.user_can_edit_obra(obra_id::bigint));',
        t || '_insert_shared', t
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.user_can_edit_obra(obra_id::bigint)) with check (public.user_can_edit_obra(obra_id::bigint));',
        t || '_update_shared', t
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.user_can_edit_obra(obra_id::bigint));',
        t || '_delete_shared', t
      );
    end if;
  end loop;
end;
$$;