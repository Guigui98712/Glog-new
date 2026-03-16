-- Habilita acesso compartilhado por obra em todos os modulos que usam obra_id.
-- Regras:
-- - Dono da obra: acesso total
-- - Compartilhado com permissao 'visualizar': somente leitura
-- - Compartilhado com outras permissoes: leitura e escrita

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

-- Funcoes auxiliares para entidades Trello sem obra_id direto.
create or replace function public.user_can_view_board(p_board_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_boards b
    where b.id = p_board_id
      and public.user_can_view_obra(b.obra_id::bigint)
  );
$$;

create or replace function public.user_can_edit_board(p_board_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_boards b
    where b.id = p_board_id
      and public.user_can_edit_obra(b.obra_id::bigint)
  );
$$;

create or replace function public.user_can_view_list(p_list_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_lists l
    where l.id = p_list_id
      and public.user_can_view_board(l.board_id::bigint)
  );
$$;

create or replace function public.user_can_edit_list(p_list_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_lists l
    where l.id = p_list_id
      and public.user_can_edit_board(l.board_id::bigint)
  );
$$;

create or replace function public.user_can_view_card(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_cards c
    where c.id = p_card_id
      and public.user_can_view_list(c.list_id::bigint)
  );
$$;

create or replace function public.user_can_edit_card(p_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trello_cards c
    where c.id = p_card_id
      and public.user_can_edit_list(c.list_id::bigint)
  );
$$;

grant execute on function public.user_can_view_board(bigint) to authenticated;
grant execute on function public.user_can_edit_board(bigint) to authenticated;
grant execute on function public.user_can_view_list(bigint) to authenticated;
grant execute on function public.user_can_edit_list(bigint) to authenticated;
grant execute on function public.user_can_view_card(bigint) to authenticated;
grant execute on function public.user_can_edit_card(bigint) to authenticated;

-- Obra base: permite leitura para compartilhados e edicao para permissoes de escrita.
alter table if exists public.obras enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='obras'
  loop
    execute format('drop policy if exists %I on public.obras;', p.policyname);
  end loop;
end;
$$;
create policy obras_select_shared on public.obras for select to authenticated using (public.user_can_view_obra(id::bigint));
create policy obras_insert_owner on public.obras for insert to authenticated with check (user_id = auth.uid());
create policy obras_update_shared on public.obras for update to authenticated using (public.user_can_edit_obra(id::bigint)) with check (public.user_can_edit_obra(id::bigint));
create policy obras_delete_owner on public.obras for delete to authenticated using (user_id = auth.uid());

-- Aplica politicas genericas para tabelas com obra_id.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'diario_obra',
    'etapas',
    'orcamentos',
    'relatorios',
    'cronogramas',
    'etapas_fluxograma',
    'etapas_datas',
    'demanda_itens',
    'almox_items',
    'almox_movements',
    'almox_tools',
    'almox_tools_history',
    'almox_access_codes',
    'almox_access_devices',
    'pastas_projetos',
    'projetos',
    'viagens_obra',
    'viagens'
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

-- Trello: listas
alter table if exists public.trello_lists enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_lists'
  loop
    execute format('drop policy if exists %I on public.trello_lists;', p.policyname);
  end loop;
end;
$$;
create policy trello_lists_select_shared on public.trello_lists for select to authenticated using (public.user_can_view_board(board_id::bigint));
create policy trello_lists_insert_shared on public.trello_lists for insert to authenticated with check (public.user_can_edit_board(board_id::bigint));
create policy trello_lists_update_shared on public.trello_lists for update to authenticated using (public.user_can_edit_board(board_id::bigint)) with check (public.user_can_edit_board(board_id::bigint));
create policy trello_lists_delete_shared on public.trello_lists for delete to authenticated using (public.user_can_edit_board(board_id::bigint));

-- Trello: cards
alter table if exists public.trello_cards enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_cards'
  loop
    execute format('drop policy if exists %I on public.trello_cards;', p.policyname);
  end loop;
end;
$$;
create policy trello_cards_select_shared on public.trello_cards for select to authenticated using (public.user_can_view_list(list_id::bigint));
create policy trello_cards_insert_shared on public.trello_cards for insert to authenticated with check (public.user_can_edit_list(list_id::bigint));
create policy trello_cards_update_shared on public.trello_cards for update to authenticated using (public.user_can_edit_list(list_id::bigint)) with check (public.user_can_edit_list(list_id::bigint));
create policy trello_cards_delete_shared on public.trello_cards for delete to authenticated using (public.user_can_edit_list(list_id::bigint));

-- Trello: tabelas filhas por card/checklist
alter table if exists public.trello_checklists enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_checklists'
  loop
    execute format('drop policy if exists %I on public.trello_checklists;', p.policyname);
  end loop;
end;
$$;
create policy trello_checklists_select_shared on public.trello_checklists for select to authenticated using (public.user_can_view_card(card_id::bigint));
create policy trello_checklists_insert_shared on public.trello_checklists for insert to authenticated with check (public.user_can_edit_card(card_id::bigint));
create policy trello_checklists_update_shared on public.trello_checklists for update to authenticated using (public.user_can_edit_card(card_id::bigint)) with check (public.user_can_edit_card(card_id::bigint));
create policy trello_checklists_delete_shared on public.trello_checklists for delete to authenticated using (public.user_can_edit_card(card_id::bigint));

alter table if exists public.trello_checklist_items enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_checklist_items'
  loop
    execute format('drop policy if exists %I on public.trello_checklist_items;', p.policyname);
  end loop;
end;
$$;
create policy trello_checklist_items_select_shared on public.trello_checklist_items for select to authenticated using (
  exists (
    select 1 from public.trello_checklists ck where ck.id = trello_checklist_items.checklist_id and public.user_can_view_card(ck.card_id::bigint)
  )
);
create policy trello_checklist_items_insert_shared on public.trello_checklist_items for insert to authenticated with check (
  exists (
    select 1 from public.trello_checklists ck where ck.id = trello_checklist_items.checklist_id and public.user_can_edit_card(ck.card_id::bigint)
  )
);
create policy trello_checklist_items_update_shared on public.trello_checklist_items for update to authenticated using (
  exists (
    select 1 from public.trello_checklists ck where ck.id = trello_checklist_items.checklist_id and public.user_can_edit_card(ck.card_id::bigint)
  )
) with check (
  exists (
    select 1 from public.trello_checklists ck where ck.id = trello_checklist_items.checklist_id and public.user_can_edit_card(ck.card_id::bigint)
  )
);
create policy trello_checklist_items_delete_shared on public.trello_checklist_items for delete to authenticated using (
  exists (
    select 1 from public.trello_checklists ck where ck.id = trello_checklist_items.checklist_id and public.user_can_edit_card(ck.card_id::bigint)
  )
);

alter table if exists public.trello_comments enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_comments'
  loop
    execute format('drop policy if exists %I on public.trello_comments;', p.policyname);
  end loop;
end;
$$;
create policy trello_comments_select_shared on public.trello_comments for select to authenticated using (public.user_can_view_card(card_id::bigint));
create policy trello_comments_insert_shared on public.trello_comments for insert to authenticated with check (public.user_can_edit_card(card_id::bigint));
create policy trello_comments_update_shared on public.trello_comments for update to authenticated using (public.user_can_edit_card(card_id::bigint)) with check (public.user_can_edit_card(card_id::bigint));
create policy trello_comments_delete_shared on public.trello_comments for delete to authenticated using (public.user_can_edit_card(card_id::bigint));

alter table if exists public.trello_attachments enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_attachments'
  loop
    execute format('drop policy if exists %I on public.trello_attachments;', p.policyname);
  end loop;
end;
$$;
create policy trello_attachments_select_shared on public.trello_attachments for select to authenticated using (public.user_can_view_card(card_id::bigint));
create policy trello_attachments_insert_shared on public.trello_attachments for insert to authenticated with check (public.user_can_edit_card(card_id::bigint));
create policy trello_attachments_update_shared on public.trello_attachments for update to authenticated using (public.user_can_edit_card(card_id::bigint)) with check (public.user_can_edit_card(card_id::bigint));
create policy trello_attachments_delete_shared on public.trello_attachments for delete to authenticated using (public.user_can_edit_card(card_id::bigint));

alter table if exists public.trello_card_labels enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='trello_card_labels'
  loop
    execute format('drop policy if exists %I on public.trello_card_labels;', p.policyname);
  end loop;
end;
$$;
create policy trello_card_labels_select_shared on public.trello_card_labels for select to authenticated using (public.user_can_view_card(card_id::bigint));
create policy trello_card_labels_insert_shared on public.trello_card_labels for insert to authenticated with check (public.user_can_edit_card(card_id::bigint));
create policy trello_card_labels_delete_shared on public.trello_card_labels for delete to authenticated using (public.user_can_edit_card(card_id::bigint));
