-- Corrige referencia ambigua a "id" dentro dos RPCs publicos do almox.
-- O problema ocorre porque as funcoes retornam "id" como OUT param,
-- e clausulas como "where id = v_item.id" ficam ambiguas em PL/pgSQL.

create or replace function public.create_almox_item_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_nome text,
  p_unidade text default null,
  p_categoria text default null,
  p_quantidade numeric default 0
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  unidade text,
  categoria text,
  quantidade numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_quantidade numeric := greatest(coalesce(p_quantidade, 0), 0);
  v_nome text := trim(coalesce(p_nome, ''));
begin
  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  if v_nome = '' then
    raise exception 'Nome do item e obrigatorio';
  end if;

  insert into public.almox_items (
    obra_id,
    nome,
    unidade,
    categoria,
    quantidade,
    is_deleted,
    deleted_at
  )
  values (
    p_obra_id,
    v_nome,
    nullif(trim(coalesce(p_unidade, '')), ''),
    nullif(trim(coalesce(p_categoria, '')), ''),
    0,
    false,
    null
  )
  returning * into v_item;

  if v_quantidade > 0 then
    insert into public.almox_movements (
      obra_id,
      item_id,
      tipo,
      quantidade,
      observacao,
      criado_em
    )
    values (
      p_obra_id,
      v_item.id,
      'entrada',
      v_quantidade,
      'entrada_inicial',
      now()
    );

    update public.almox_items as item
      set quantidade = coalesce(item.quantidade, 0) + v_quantidade
    where item.id = v_item.id;

    select * into v_item
    from public.almox_items item
    where item.id = v_item.id;
  end if;

  return query
  select
    v_item.id::bigint,
    v_item.obra_id::bigint,
    v_item.nome,
    v_item.unidade,
    v_item.categoria,
    v_item.quantidade,
    v_item.created_at;
end;
$$;

create or replace function public.register_almox_movement_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_item_id bigint,
  p_tipo text,
  p_quantidade numeric,
  p_numero_pedido text default null,
  p_empresa_nome text default null,
  p_retirado_por text default null,
  p_observacao text default null
)
returns table (
  id bigint,
  obra_id bigint,
  item_id bigint,
  tipo text,
  quantidade numeric,
  observacao text,
  numero_pedido text,
  empresa_nome text,
  retirado_por text,
  criado_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_mov record;
  v_tipo text := trim(coalesce(p_tipo, ''));
  v_quantidade numeric := coalesce(p_quantidade, 0);
  v_nova_quantidade numeric;
begin
  if p_item_id is null then
    raise exception 'Item e obrigatorio';
  end if;

  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  if v_tipo not in ('entrada', 'saida') then
    raise exception 'Tipo de movimento invalido';
  end if;

  if not (v_quantidade > 0) then
    raise exception 'Informe uma quantidade valida maior que zero';
  end if;

  if v_tipo = 'entrada' and (coalesce(trim(p_numero_pedido), '') = '' or coalesce(trim(p_empresa_nome), '') = '') then
    raise exception 'Informe numero do pedido e nome da empresa para registrar entrada';
  end if;

  if v_tipo = 'saida' and coalesce(trim(p_retirado_por), '') = '' and coalesce(trim(p_observacao), '') <> 'item_excluido' then
    raise exception 'Informe quem retirou o item para registrar saida';
  end if;

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

  v_nova_quantidade := coalesce(v_item.quantidade, 0) + case when v_tipo = 'entrada' then v_quantidade else -v_quantidade end;

  if v_nova_quantidade < 0 then
    raise exception 'Quantidade insuficiente em estoque';
  end if;

  update public.almox_items as item
    set quantidade = v_nova_quantidade
  where item.id = v_item.id;

  insert into public.almox_movements (
    obra_id,
    item_id,
    tipo,
    quantidade,
    observacao,
    numero_pedido,
    empresa_nome,
    retirado_por,
    criado_em
  )
  values (
    p_obra_id,
    v_item.id,
    v_tipo,
    v_quantidade,
    nullif(trim(coalesce(p_observacao, '')), ''),
    nullif(trim(coalesce(p_numero_pedido, '')), ''),
    nullif(trim(coalesce(p_empresa_nome, '')), ''),
    nullif(trim(coalesce(p_retirado_por, '')), ''),
    now()
  )
  returning * into v_mov;

  return query
  select
    v_mov.id::bigint,
    v_mov.obra_id::bigint,
    v_mov.item_id::bigint,
    v_mov.tipo,
    v_mov.quantidade,
    v_mov.observacao,
    v_mov.numero_pedido,
    v_mov.empresa_nome,
    v_mov.retirado_por,
    v_mov.criado_em;
end;
$$;

create or replace function public.delete_almox_item_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_item_id bigint
)
returns table (
  id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
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

  update public.almox_items as item
    set is_deleted = true,
        deleted_at = now(),
        quantidade = 0
  where item.id = v_item.id;

  if coalesce(v_item.quantidade, 0) > 0 then
    insert into public.almox_movements (
      obra_id,
      item_id,
      tipo,
      quantidade,
      observacao,
      criado_em
    )
    values (
      p_obra_id,
      v_item.id,
      'saida',
      v_item.quantidade,
      'item_excluido',
      now()
    );
  end if;

  return query
  select v_item.id::bigint;
end;
$$;

grant execute on function public.create_almox_item_by_device(bigint, text, text, text, text, numeric) to anon;
grant execute on function public.create_almox_item_by_device(bigint, text, text, text, text, numeric) to authenticated;

grant execute on function public.register_almox_movement_by_device(bigint, text, bigint, text, numeric, text, text, text, text) to anon;
grant execute on function public.register_almox_movement_by_device(bigint, text, bigint, text, numeric, text, text, text, text) to authenticated;

grant execute on function public.delete_almox_item_by_device(bigint, text, bigint) to anon;
grant execute on function public.delete_almox_item_by_device(bigint, text, bigint) to authenticated;