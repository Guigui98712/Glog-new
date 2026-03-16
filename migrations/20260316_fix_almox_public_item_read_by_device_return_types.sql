-- Corrige os tipos de retorno das funcoes publicas do almox.
-- Em alguns ambientes, almox_items.id e almox_items.obra_id sao integer,
-- entao o RETURN QUERY precisa fazer cast explicito para bigint.

create or replace function public.list_almox_items_by_device(
  p_obra_id bigint,
  p_device_id text
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  unidade text,
  categoria text,
  quantidade numeric,
  is_deleted boolean,
  deleted_at timestamptz,
  created_at timestamptz
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
  select
    i.id::bigint,
    i.obra_id::bigint,
    i.nome,
    i.unidade,
    i.categoria,
    i.quantidade,
    i.is_deleted,
    i.deleted_at,
    i.created_at
  from public.almox_items i
  where i.obra_id = p_obra_id
    and coalesce(i.is_deleted, false) = false
  order by i.nome asc;
end;
$$;

create or replace function public.search_almox_items_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_query text
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  unidade text,
  categoria text,
  quantidade numeric,
  is_deleted boolean,
  deleted_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term text;
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

  v_term := coalesce(trim(p_query), '');
  if v_term = '' then
    return;
  end if;

  return query
  select
    i.id::bigint,
    i.obra_id::bigint,
    i.nome,
    i.unidade,
    i.categoria,
    i.quantidade,
    i.is_deleted,
    i.deleted_at,
    i.created_at
  from public.almox_items i
  where i.obra_id = p_obra_id
    and coalesce(i.is_deleted, false) = false
    and i.nome ilike (v_term || '%')
  order by i.nome asc
  limit 20;
end;
$$;

create or replace function public.get_almox_item_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_item_id bigint
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  unidade text,
  categoria text,
  quantidade numeric,
  is_deleted boolean,
  deleted_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
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

  return query
  select
    i.id::bigint,
    i.obra_id::bigint,
    i.nome,
    i.unidade,
    i.categoria,
    i.quantidade,
    i.is_deleted,
    i.deleted_at,
    i.created_at
  from public.almox_items i
  where i.id = p_item_id
    and i.obra_id = p_obra_id
    and coalesce(i.is_deleted, false) = false
  limit 1;
end;
$$;

grant execute on function public.list_almox_items_by_device(bigint, text) to anon;
grant execute on function public.list_almox_items_by_device(bigint, text) to authenticated;

grant execute on function public.search_almox_items_by_device(bigint, text, text) to anon;
grant execute on function public.search_almox_items_by_device(bigint, text, text) to authenticated;

grant execute on function public.get_almox_item_by_device(bigint, text, bigint) to anon;
grant execute on function public.get_almox_item_by_device(bigint, text, bigint) to authenticated;