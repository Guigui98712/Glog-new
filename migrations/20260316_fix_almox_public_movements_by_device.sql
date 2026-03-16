-- Permite registrar movimentos e consultar historico no fluxo publico do almox,
-- validando o dispositivo e evitando dependencia de sessao autenticada.

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
  v_quantidade numeric := coalesce(p_quantidade, 0);
  v_nova_quantidade numeric;
begin
  if p_obra_id is null or p_device_id is null or p_item_id is null then
    raise exception 'Obra, dispositivo e item sao obrigatorios';
  end if;

  if not exists (
    select 1
    from public.almox_access_devices d
    where d.id::text = p_device_id
      and d.obra_id = p_obra_id
      and d.active = true
  ) then
    raise exception 'Dispositivo invalido ou revogado';
  end if;

  if p_tipo not in ('entrada', 'saida') then
    raise exception 'Tipo de movimento invalido';
  end if;

  if not (v_quantidade > 0) then
    raise exception 'Informe uma quantidade valida maior que zero';
  end if;

  select i.*
    into v_item
  from public.almox_items i
  where i.id = p_item_id
    and i.obra_id = p_obra_id
    and coalesce(i.is_deleted, false) = false
  for update;

  if v_item is null then
    raise exception 'Item nao encontrado';
  end if;

  v_nova_quantidade := coalesce(v_item.quantidade, 0) + case when p_tipo = 'entrada' then v_quantidade else -v_quantidade end;

  if v_nova_quantidade < 0 then
    raise exception 'Quantidade insuficiente em estoque';
  end if;

  update public.almox_items
    set quantidade = v_nova_quantidade
  where id = v_item.id;

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
    p_item_id,
    p_tipo,
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

create or replace function public.get_almox_history_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_year integer default null
)
returns table (
  id bigint,
  tipo text,
  quantidade numeric,
  observacao text,
  numero_pedido text,
  empresa_nome text,
  retirado_por text,
  data timestamptz,
  item_nome text,
  item_excluido boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_obra_id is null or p_device_id is null then
    raise exception 'Obra e dispositivo sao obrigatorios';
  end if;

  if not exists (
    select 1
    from public.almox_access_devices d
    where d.id::text = p_device_id
      and d.obra_id = p_obra_id
      and d.active = true
  ) then
    raise exception 'Dispositivo invalido ou revogado';
  end if;

  if p_year is not null then
    v_start := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC');
    v_end := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC');
  end if;

  return query
  select
    mov.id::bigint,
    mov.tipo,
    mov.quantidade,
    mov.observacao,
    mov.numero_pedido,
    mov.empresa_nome,
    mov.retirado_por,
    mov.criado_em as data,
    coalesce(it.nome, 'Item removido') as item_nome,
    coalesce(it.is_deleted, true) as item_excluido
  from public.almox_movements mov
  left join public.almox_items it on it.id = mov.item_id
  where mov.obra_id = p_obra_id
    and coalesce(mov.quantidade, 0) > 0
    and (p_year is null or (mov.criado_em >= v_start and mov.criado_em < v_end))
  order by mov.criado_em desc;
end;
$$;

create or replace function public.get_almox_history_years_by_device(
  p_obra_id bigint,
  p_device_id text
)
returns table (
  year integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_obra_id is null or p_device_id is null then
    raise exception 'Obra e dispositivo sao obrigatorios';
  end if;

  if not exists (
    select 1
    from public.almox_access_devices d
    where d.id::text = p_device_id
      and d.obra_id = p_obra_id
      and d.active = true
  ) then
    raise exception 'Dispositivo invalido ou revogado';
  end if;

  return query
  select distinct extract(year from mov.criado_em)::integer as year
  from public.almox_movements mov
  where mov.obra_id = p_obra_id
  order by year desc;
end;
$$;

grant execute on function public.register_almox_movement_by_device(bigint, text, bigint, text, numeric, text, text, text, text) to anon;
grant execute on function public.register_almox_movement_by_device(bigint, text, bigint, text, numeric, text, text, text, text) to authenticated;

grant execute on function public.get_almox_history_by_device(bigint, text, integer) to anon;
grant execute on function public.get_almox_history_by_device(bigint, text, integer) to authenticated;

grant execute on function public.get_almox_history_years_by_device(bigint, text) to anon;
grant execute on function public.get_almox_history_years_by_device(bigint, text) to authenticated;