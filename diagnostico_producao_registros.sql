-- Diagnóstico + correção de visibilidade/persistência da tabela producao_registros
-- Execute no SQL Editor do Supabase (projeto de produção)

-- 1) Estrutura da tabela
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'producao_registros'
order by ordinal_position;

-- 2) Constraints da tabela
select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.producao_registros'::regclass
order by conname;

-- 3) Policies atuais
select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'producao_registros'
order by policyname;

-- 4) Triggers da tabela
select
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
where t.tgrelid = 'public.producao_registros'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 5) Distribuição por data (para ver se está gravando em dia diferente)
select
  data::text as data,
  count(*) as total
from public.producao_registros
group by data
order by data desc
limit 60;

-- 6) Correção recomendada de RLS compartilhada por obra
-- (idêntica ao padrão usado no projeto)
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

alter table public.producao_registros enable row level security;

drop policy if exists producao_registros_select_shared on public.producao_registros;
drop policy if exists producao_registros_insert_shared on public.producao_registros;
drop policy if exists producao_registros_update_shared on public.producao_registros;
drop policy if exists producao_registros_delete_shared on public.producao_registros;

create policy producao_registros_select_shared
on public.producao_registros
for select
to authenticated
using (public.user_can_view_obra(obra_id::bigint));

create policy producao_registros_insert_shared
on public.producao_registros
for insert
to authenticated
with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_registros_update_shared
on public.producao_registros
for update
to authenticated
using (public.user_can_edit_obra(obra_id::bigint))
with check (public.user_can_edit_obra(obra_id::bigint));

create policy producao_registros_delete_shared
on public.producao_registros
for delete
to authenticated
using (public.user_can_edit_obra(obra_id::bigint));

-- 7) (Opcional) Se existir coluna user_id, garantir default para rastreabilidade
-- alter table public.producao_registros alter column user_id set default auth.uid();

-- 8) Status de RLS e tabela (forense)
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'producao_registros';

-- 9) Tipo da coluna data + faixa real gravada
select
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as column_type
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'producao_registros'
  and a.attnum > 0
  and not a.attisdropped
  and a.attname in ('data', 'created_at', 'updated_at');

select
  min(data) as menor_data,
  max(data) as maior_data,
  count(*) as total_registros
from public.producao_registros;

-- 10) Constraints suspeitas com limite temporal
select
  c.conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.producao_registros'::regclass
  and (
    lower(pg_get_constraintdef(c.oid)) like '%current_date%'
    or lower(pg_get_constraintdef(c.oid)) like '%now()%'
    or lower(pg_get_constraintdef(c.oid)) like '%timezone%'
    or lower(pg_get_constraintdef(c.oid)) like '% data %<=%'
    or lower(pg_get_constraintdef(c.oid)) like '% data <=%'
    or lower(pg_get_constraintdef(c.oid)) like '% data <%'
    or lower(pg_get_constraintdef(c.oid)) like '% data >%'
    or lower(pg_get_constraintdef(c.oid)) like '% data >=%'
  )
order by c.conname;

-- 11) Trigger functions e codigo-fonte (procura bloqueio por data)
select
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_source
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.producao_registros'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 12) Qualquer função no banco que menciona producao_registros + data/now/current_date
with funcoes as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prokind = 'f' -- apenas funcoes normais (evita aggregate/window/procedure)
)
select
  schema_name,
  function_name,
  function_source
from funcoes
where lower(function_source) like '%producao_registros%'
  and (
    lower(function_source) like '%current_date%'
    or lower(function_source) like '%now()%'
    or lower(function_source) like '%timezone%'
    or lower(function_source) like '% data %'
  )
order by schema_name, function_name;

-- 13) Views/Regras que possam filtrar por data
select
  schemaname,
  viewname,
  definition
from pg_views
where lower(definition) like '%producao_registros%'
  and (
    lower(definition) like '%current_date%'
    or lower(definition) like '%now()%'
    or lower(definition) like '% data %'
  )
order by schemaname, viewname;

select
  schemaname,
  tablename,
  rulename,
  definition
from pg_rules
where lower(definition) like '%producao_registros%'
  and (
    lower(definition) like '%current_date%'
    or lower(definition) like '%now()%'
    or lower(definition) like '% data %'
  )
order by schemaname, tablename, rulename;

-- 14) Índices e unicidade (evita colisão silenciosa por data/pedreiro/tarefa)
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'producao_registros'
order by indexname;

-- 15) Erro 400 pode vir de coluna inexistente no retorno select.
--     Esta consulta mostra quais colunas realmente existem hoje:
select
  string_agg(column_name, ', ' order by ordinal_position) as colunas_existentes
from information_schema.columns
where table_schema = 'public'
  and table_name = 'producao_registros';

-- 16) Teste rápido de inserção de data futura (rode MANUALMENTE, opcional)
-- IMPORTANTE: ajuste IDs existentes antes de rodar.
-- begin;
-- insert into public.producao_registros (obra_id, data, pedreiro_id, tarefa_id, quantidade, observacao)
-- values (<obra_id_existente>, current_date + 1, '<pedreiro_id_existente>', '<tarefa_id_existente>', 1, 'teste data futura');
-- rollback;

-- 17) Diagnóstico automático: tenta inserir data futura e devolve erro detalhado
-- Não persiste nada (rollback automático).
do $$
declare
  v_obra_id bigint;
  v_pedreiro_id uuid;
  v_tarefa_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
begin
  -- Busca uma obra com pedreiro e tarefa cadastrados
  select p.obra_id, p.id, t.id
    into v_obra_id, v_pedreiro_id, v_tarefa_id
  from public.producao_pedreiros p
  join public.producao_tarefas t
    on t.obra_id = p.obra_id
  order by p.created_at desc nulls last
  limit 1;

  if v_obra_id is null or v_pedreiro_id is null or v_tarefa_id is null then
    raise notice 'DIAG_PRODUCAO: sem dados base em producao_pedreiros/producao_tarefas para teste.';
    return;
  end if;

  begin
    insert into public.producao_registros (
      obra_id,
      pedreiro_id,
      tarefa_id,
      data,
      quantidade,
      observacao,
      pavimento
    ) values (
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id,
      current_date + 1,
      1,
      'DIAG_FUTURE_DATE',
      'DIAG'
    );

    raise notice 'DIAG_PRODUCAO: insert com data futura passou.';

    delete from public.producao_registros
    where obra_id = v_obra_id
      and pedreiro_id = v_pedreiro_id
      and tarefa_id = v_tarefa_id
      and observacao = 'DIAG_FUTURE_DATE';
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;

      raise notice 'DIAG_PRODUCAO_ERRO | SQLSTATE=% | MESSAGE=% | DETAIL=% | HINT=%',
        coalesce(v_sqlstate, ''),
        coalesce(v_message, ''),
        coalesce(v_detail, ''),
        coalesce(v_hint, '');
  end;
end $$;

-- 19) Diagnóstico em formato de tabela (mais fácil de visualizar no SQL Editor)
create or replace function public.diag_producao_registros_future_insert_test()
returns table (
  ok boolean,
  sqlstate text,
  message text,
  detail text,
  hint text,
  out_obra_id bigint,
  out_pedreiro_id uuid,
  out_tarefa_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra_id bigint;
  v_pedreiro_id uuid;
  v_tarefa_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
begin
  select p.obra_id, p.id, t.id
    into v_obra_id, v_pedreiro_id, v_tarefa_id
  from public.producao_pedreiros p
  join public.producao_tarefas t
    on t.obra_id = p.obra_id
  order by p.created_at desc nulls last
  limit 1;

  if v_obra_id is null or v_pedreiro_id is null or v_tarefa_id is null then
    return query
    select
      false,
      'NO_BASE_DATA'::text,
      'Sem dados base em producao_pedreiros/producao_tarefas para teste.'::text,
      null::text,
      null::text,
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id;
    return;
  end if;

  begin
    insert into public.producao_registros (
      obra_id,
      pedreiro_id,
      tarefa_id,
      data,
      quantidade,
      observacao,
      pavimento
    ) values (
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id,
      current_date + 1,
      1,
      'DIAG_FUTURE_DATE',
      'DIAG'
    );

    delete from public.producao_registros
    where public.producao_registros.obra_id = v_obra_id
      and public.producao_registros.pedreiro_id = v_pedreiro_id
      and public.producao_registros.tarefa_id = v_tarefa_id
      and public.producao_registros.observacao = 'DIAG_FUTURE_DATE';

    return query
    select
      true,
      null::text,
      'Insert com data futura funcionou.'::text,
      null::text,
      null::text,
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id;
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;

      return query
      select
        false,
        coalesce(v_sqlstate, ''),
        coalesce(v_message, ''),
        coalesce(v_detail, ''),
        coalesce(v_hint, ''),
        v_obra_id,
        v_pedreiro_id,
        v_tarefa_id;
  end;
end;
$$;

grant execute on function public.diag_producao_registros_future_insert_test() to authenticated;

-- Rode esta query e me envie o resultado:
select * from public.diag_producao_registros_future_insert_test();

-- 20) DIAGNOSTICO RISCO ZERO (recomendado)
-- Este bloco SEMPRE faz rollback. Nada fica gravado/apagado no banco.
begin;

do $$
declare
  v_obra_id bigint;
  v_pedreiro_id uuid;
  v_tarefa_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
begin
  select p.obra_id, p.id, t.id
    into v_obra_id, v_pedreiro_id, v_tarefa_id
  from public.producao_pedreiros p
  join public.producao_tarefas t
    on t.obra_id = p.obra_id
  order by p.created_at desc nulls last
  limit 1;

  if v_obra_id is null or v_pedreiro_id is null or v_tarefa_id is null then
    raise exception 'NO_BASE_DATA: sem dados base em producao_pedreiros/producao_tarefas para teste.';
  end if;

  begin
    insert into public.producao_registros (
      obra_id,
      pedreiro_id,
      tarefa_id,
      data,
      quantidade,
      observacao,
      pavimento
    ) values (
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id,
      current_date + 1,
      1,
      'DIAG_ZERO_RISCO',
      'DIAG'
    );

    raise notice 'ZERO_RISCO_OK | Insert de data futura aceito. obra_id=% pedreiro_id=% tarefa_id=%',
      v_obra_id, v_pedreiro_id, v_tarefa_id;
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;

      raise notice 'ZERO_RISCO_ERRO | SQLSTATE=% | MESSAGE=% | DETAIL=% | HINT=% | obra_id=% | pedreiro_id=% | tarefa_id=%',
        coalesce(v_sqlstate, ''),
        coalesce(v_message, ''),
        coalesce(v_detail, ''),
        coalesce(v_hint, ''),
        v_obra_id,
        v_pedreiro_id,
        v_tarefa_id;
  end;
end $$;

rollback;

-- 21) DIAGNOSTICO RISCO ZERO COM RESULTADO VISIVEL (sem NOTICE)
-- Executa teste e retorna 1 linha com status/erro. Nada fica salvo.
begin;

create temp table if not exists tmp_diag_producao_result (
  ok boolean,
  sqlstate text,
  message text,
  detail text,
  hint text,
  obra_id bigint,
  pedreiro_id uuid,
  tarefa_id uuid
) on commit drop;

truncate tmp_diag_producao_result;

do $$
declare
  v_obra_id bigint;
  v_pedreiro_id uuid;
  v_tarefa_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
begin
  select p.obra_id, p.id, t.id
    into v_obra_id, v_pedreiro_id, v_tarefa_id
  from public.producao_pedreiros p
  join public.producao_tarefas t
    on t.obra_id = p.obra_id
  order by p.created_at desc nulls last
  limit 1;

  if v_obra_id is null or v_pedreiro_id is null or v_tarefa_id is null then
    insert into tmp_diag_producao_result
      (ok, sqlstate, message, detail, hint, obra_id, pedreiro_id, tarefa_id)
    values
      (false, 'NO_BASE_DATA', 'Sem dados base em producao_pedreiros/producao_tarefas para teste.', null, null, v_obra_id, v_pedreiro_id, v_tarefa_id);
    return;
  end if;

  begin
    insert into public.producao_registros (
      obra_id,
      pedreiro_id,
      tarefa_id,
      data,
      quantidade,
      observacao,
      pavimento
    ) values (
      v_obra_id,
      v_pedreiro_id,
      v_tarefa_id,
      current_date + 1,
      1,
      'DIAG_ZERO_RISCO',
      'DIAG'
    );

    insert into tmp_diag_producao_result
      (ok, sqlstate, message, detail, hint, obra_id, pedreiro_id, tarefa_id)
    values
      (true, null, 'Insert com data futura aceito no banco.', null, null, v_obra_id, v_pedreiro_id, v_tarefa_id);
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;

      insert into tmp_diag_producao_result
        (ok, sqlstate, message, detail, hint, obra_id, pedreiro_id, tarefa_id)
      values
        (false, coalesce(v_sqlstate, ''), coalesce(v_message, ''), coalesce(v_detail, ''), coalesce(v_hint, ''), v_obra_id, v_pedreiro_id, v_tarefa_id);
  end;
end $$;

select * from tmp_diag_producao_result;

rollback;

-- 18) Correção opcional e segura: remove apenas CHECKs temporais na tabela de produção
-- Rode só se o diagnóstico acima indicar bloqueio por data futura (ex.: data <= current_date).
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.producao_registros'::regclass
      and contype = 'c'
      and (
        lower(pg_get_constraintdef(oid)) like '%current_date%'
        or lower(pg_get_constraintdef(oid)) like '%now()%'
      )
      and lower(pg_get_constraintdef(oid)) like '%data%'
  loop
    execute format('alter table public.producao_registros drop constraint %I', c.conname);
    raise notice 'CHECK temporal removido: % | %', c.conname, c.def;
  end loop;
end $$;

