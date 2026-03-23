create or replace function public.update_almox_item_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_item_id bigint,
  p_nome text default null,
  p_unidade text default null,
  p_categoria text default null,
  p_quantidade numeric default null
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  unidade text,
  categoria text,
  quantidade numeric,
  is_deleted boolean,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_nome text;
  v_unidade text;
  v_categoria text;
  v_quantidade numeric;
  v_changes text[] := array[]::text[];
begin
  if p_item_id is null then
    raise exception 'Item e obrigatorio';
  end if;

  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  select i.*
    into v_item
  from public.almox_items i
  where i.id::bigint = p_item_id
    and i.obra_id::bigint = p_obra_id
    and coalesce(i.is_deleted, false) = false
  for update;

  if v_item is null then
    raise exception 'Item nao encontrado';
  end if;

  v_nome := coalesce(nullif(trim(p_nome), ''), v_item.nome);
  v_unidade := coalesce(nullif(trim(p_unidade), ''), v_item.unidade);
  v_categoria := coalesce(nullif(trim(p_categoria), ''), v_item.categoria);
  v_quantidade := coalesce(p_quantidade, v_item.quantidade);

  if v_quantidade < 0 then
    raise exception 'Quantidade invalida. Informe um valor maior ou igual a zero';
  end if;

  if v_nome is distinct from v_item.nome then
    v_changes := array_append(v_changes, format('Nome: "%s" → "%s"', coalesce(v_item.nome, ''), coalesce(v_nome, '')));
  end if;

  if v_unidade is distinct from v_item.unidade then
    v_changes := array_append(v_changes, format('Unidade: "%s" → "%s"', coalesce(v_item.unidade, ''), coalesce(v_unidade, '')));
  end if;

  if v_categoria is distinct from v_item.categoria then
    v_changes := array_append(v_changes, format('Categoria: "%s" → "%s"', coalesce(v_item.categoria, ''), coalesce(v_categoria, '')));
  end if;

  if v_quantidade is distinct from v_item.quantidade then
    v_changes := array_append(v_changes, format('Quantidade: %s → %s', coalesce(v_item.quantidade, 0), coalesce(v_quantidade, 0)));
  end if;

  if coalesce(array_length(v_changes, 1), 0) = 0 then
    return query
    select
      v_item.id::bigint,
      v_item.obra_id::bigint,
      v_item.nome::text,
      v_item.unidade::text,
      v_item.categoria::text,
      v_item.quantidade::numeric,
      v_item.is_deleted::boolean,
      v_item.deleted_at::timestamptz;
    return;
  end if;

  update public.almox_items as item
    set nome = v_nome,
        unidade = v_unidade,
        categoria = v_categoria,
        quantidade = v_quantidade
  where item.id = v_item.id;

  insert into public.almox_movements (
    obra_id,
    item_id,
    tipo,
    quantidade,
    observacao,
    empresa_nome,
    criado_em
  )
  values (
    p_obra_id,
    v_item.id,
    'entrada',
    1,
    'item_editado',
    array_to_string(v_changes, '; '),
    now()
  );

  return query
  select
    i.id::bigint,
    i.obra_id::bigint,
    i.nome::text,
    i.unidade::text,
    i.categoria::text,
    i.quantidade::numeric,
    i.is_deleted::boolean,
    i.deleted_at::timestamptz
  from public.almox_items i
  where i.id = v_item.id;
end;
$$;

grant execute on function public.update_almox_item_by_device(bigint, text, bigint, text, text, text, numeric) to anon;
grant execute on function public.update_almox_item_by_device(bigint, text, bigint, text, text, text, numeric) to authenticated;
