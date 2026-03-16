-- Torna o RPC de cadastro de item do almoxarife resiliente a divergencias de funcoes auxiliares.
-- Evita dependencia de almox_adjust_item_quantity (que pode ter assinatura diferente entre ambientes).

create or replace function public.create_almox_item_by_device(
  p_obra_id bigint,
  p_device_id bigint,
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
  v_device record;
  v_item record;
  v_quantidade numeric := greatest(coalesce(p_quantidade, 0), 0);
begin
  if p_obra_id is null or p_device_id is null then
    raise exception 'Obra e dispositivo sao obrigatorios';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Nome do item e obrigatorio';
  end if;

  select d.*
    into v_device
  from public.almox_access_devices d
  where d.id = p_device_id
    and d.obra_id = p_obra_id
    and d.active = true
  limit 1;

  if v_device is null then
    raise exception 'Dispositivo invalido ou revogado';
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
    trim(p_nome),
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

    update public.almox_items
      set quantidade = coalesce(quantidade, 0) + v_quantidade
    where id = v_item.id;

    select * into v_item
    from public.almox_items
    where id = v_item.id;
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

grant execute on function public.create_almox_item_by_device(bigint, bigint, text, text, text, numeric) to anon;
grant execute on function public.create_almox_item_by_device(bigint, bigint, text, text, text, numeric) to authenticated;
