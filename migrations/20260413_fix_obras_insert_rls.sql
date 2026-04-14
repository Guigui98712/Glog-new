-- Corrige políticas RLS da tabela public.obras para evitar 403 no INSERT
-- em contas autenticadas (inclusive quando user_id nao vier no payload).

begin;

alter table public.obras enable row level security;

-- Garante que novos inserts preencham user_id automaticamente no banco.
alter table public.obras alter column user_id set default auth.uid();

-- Remove qualquer política antiga/inconsistente da tabela.
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

-- SELECT: mantém compatibilidade com compartilhamento quando as funcoes existem.
do $$
begin
  if exists (
    select 1
    from pg_proc pr
    join pg_namespace ns on ns.oid = pr.pronamespace
    where ns.nspname = 'public'
      and pr.proname = 'user_can_view_obra'
      and pg_get_function_identity_arguments(pr.oid) = 'p_obra_id bigint'
  ) then
    execute '
      create policy obras_select_shared
      on public.obras
      for select
      to authenticated
      using (public.user_can_view_obra(id::bigint));
    ';

    execute '
      create policy obras_update_shared
      on public.obras
      for update
      to authenticated
      using (public.user_can_edit_obra(id::bigint))
      with check (public.user_can_edit_obra(id::bigint));
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

-- INSERT: permite inserir quando user_id = auth.uid() OU quando user_id vier nulo
-- (neste caso, o default da coluna atribui auth.uid()).
create policy obras_insert_owner
on public.obras
for insert
to authenticated
with check (coalesce(user_id, auth.uid()) = auth.uid());

-- DELETE: somente dono.
create policy obras_delete_owner
on public.obras
for delete
to authenticated
using (user_id = auth.uid());

commit;
