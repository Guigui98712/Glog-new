-- Adiciona RPCs publicas por dispositivo para ferramentas do almoxarifado.
-- Mantem o mesmo comportamento da pagina principal, mas validando dispositivo ativo.

create or replace function public.list_almox_tools_by_device(
  p_obra_id bigint,
  p_device_id text
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  descricao text,
  foto_url text,
  com_pessoa_nome text,
  retirado_em timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  return query
  select
    t.id::bigint,
    t.obra_id::bigint,
    t.nome,
    t.descricao,
    t.foto_url,
    t.com_pessoa_nome,
    t.retirado_em,
    t.created_at,
    t.updated_at
  from public.almox_tools t
  where t.obra_id::bigint = p_obra_id
  order by t.created_at desc;
end;
$$;

create or replace function public.create_almox_tool_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_nome text,
  p_descricao text default null,
  p_foto_url text default null
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  descricao text,
  foto_url text,
  com_pessoa_nome text,
  retirado_em timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_tool public.almox_tools%rowtype;
begin
  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  if v_nome = '' then
    raise exception 'Nome da ferramenta e obrigatorio';
  end if;

  insert into public.almox_tools (
    obra_id,
    nome,
    descricao,
    foto_url,
    updated_at
  )
  values (
    p_obra_id,
    v_nome,
    nullif(trim(coalesce(p_descricao, '')), ''),
    nullif(trim(coalesce(p_foto_url, '')), ''),
    now()
  )
  returning * into v_tool;

  insert into public.almox_tools_history (
    obra_id,
    tool_id,
    tool_nome,
    acao,
    pessoa_nome,
    observacao
  )
  values (
    p_obra_id,
    v_tool.id,
    v_tool.nome,
    'cadastro',
    null,
    null
  );

  return query
  select
    v_tool.id::bigint,
    v_tool.obra_id::bigint,
    v_tool.nome,
    v_tool.descricao,
    v_tool.foto_url,
    v_tool.com_pessoa_nome,
    v_tool.retirado_em,
    v_tool.created_at,
    v_tool.updated_at;
end;
$$;

create or replace function public.withdraw_almox_tool_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_tool_id bigint,
  p_pessoa_nome text
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  descricao text,
  foto_url text,
  com_pessoa_nome text,
  retirado_em timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa_nome text := trim(coalesce(p_pessoa_nome, ''));
  v_tool public.almox_tools%rowtype;
begin
  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  if v_pessoa_nome = '' then
    raise exception 'Nome de quem retirou e obrigatorio';
  end if;

  select *
  into v_tool
  from public.almox_tools t
  where t.id = p_tool_id
    and t.obra_id::bigint = p_obra_id;

  if not found then
    raise exception 'Ferramenta nao encontrada para esta obra';
  end if;

  update public.almox_tools t
  set
    com_pessoa_nome = v_pessoa_nome,
    retirado_em = now(),
    updated_at = now()
  where t.id = p_tool_id
    and t.obra_id::bigint = p_obra_id
  returning * into v_tool;

  insert into public.almox_tools_history (
    obra_id,
    tool_id,
    tool_nome,
    acao,
    pessoa_nome,
    observacao
  )
  values (
    p_obra_id,
    v_tool.id,
    v_tool.nome,
    'retirada',
    v_pessoa_nome,
    null
  );

  return query
  select
    v_tool.id::bigint,
    v_tool.obra_id::bigint,
    v_tool.nome,
    v_tool.descricao,
    v_tool.foto_url,
    v_tool.com_pessoa_nome,
    v_tool.retirado_em,
    v_tool.created_at,
    v_tool.updated_at;
end;
$$;

create or replace function public.return_almox_tool_by_device(
  p_obra_id bigint,
  p_device_id text,
  p_tool_id bigint
)
returns table (
  id bigint,
  obra_id bigint,
  nome text,
  descricao text,
  foto_url text,
  com_pessoa_nome text,
  retirado_em timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool public.almox_tools%rowtype;
  v_pessoa_nome text;
begin
  perform public.assert_valid_almox_device(p_obra_id, p_device_id);

  select *
  into v_tool
  from public.almox_tools t
  where t.id = p_tool_id
    and t.obra_id::bigint = p_obra_id;

  if not found then
    raise exception 'Ferramenta nao encontrada para esta obra';
  end if;

  v_pessoa_nome := v_tool.com_pessoa_nome;

  update public.almox_tools t
  set
    com_pessoa_nome = null,
    retirado_em = null,
    updated_at = now()
  where t.id = p_tool_id
    and t.obra_id::bigint = p_obra_id
  returning * into v_tool;

  insert into public.almox_tools_history (
    obra_id,
    tool_id,
    tool_nome,
    acao,
    pessoa_nome,
    observacao
  )
  values (
    p_obra_id,
    v_tool.id,
    v_tool.nome,
    'devolucao',
    v_pessoa_nome,
    null
  );

  return query
  select
    v_tool.id::bigint,
    v_tool.obra_id::bigint,
    v_tool.nome,
    v_tool.descricao,
    v_tool.foto_url,
    v_tool.com_pessoa_nome,
    v_tool.retirado_em,
    v_tool.created_at,
    v_tool.updated_at;
end;
$$;

grant execute on function public.list_almox_tools_by_device(bigint, text) to anon;
grant execute on function public.list_almox_tools_by_device(bigint, text) to authenticated;

grant execute on function public.create_almox_tool_by_device(bigint, text, text, text, text) to anon;
grant execute on function public.create_almox_tool_by_device(bigint, text, text, text, text) to authenticated;

grant execute on function public.withdraw_almox_tool_by_device(bigint, text, bigint, text) to anon;
grant execute on function public.withdraw_almox_tool_by_device(bigint, text, bigint, text) to authenticated;

grant execute on function public.return_almox_tool_by_device(bigint, text, bigint) to anon;
grant execute on function public.return_almox_tool_by_device(bigint, text, bigint) to authenticated;
