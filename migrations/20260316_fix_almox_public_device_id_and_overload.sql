-- Corrige dois problemas em producao:
-- 1) remove a sobrecarga antiga de create_almox_item_by_device com p_device_id bigint,
--    que deixa o PostgREST ambiguo;
-- 2) recria check_almox_device_session com device_id text,
--    sem assumir bigint quando o id do dispositivo e uuid.

drop function if exists public.create_almox_item_by_device(bigint, bigint, text, text, text, numeric);
drop function if exists public.check_almox_device_session(bigint, text);

create or replace function public.check_almox_device_session(
	p_obra_id bigint,
	p_device_id text
)
returns table (
	is_valid boolean,
	device_id text,
	obra_id bigint,
	device_name text,
	active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
	if p_obra_id is null or p_device_id is null or coalesce(trim(p_device_id), '') = '' then
		return query
		select false, null::text, p_obra_id, null::text, false;
		return;
	end if;

	return query
	select
		true as is_valid,
		d.id::text,
		d.obra_id::bigint,
		d.device_name,
		d.active
	from public.almox_access_devices d
	where d.id::text = trim(p_device_id)
		and d.obra_id::bigint = p_obra_id
		and d.active = true
	limit 1;

	if not found then
		return query
		select false, null::text, p_obra_id, null::text, false;
	end if;
end;
$$;

grant execute on function public.check_almox_device_session(bigint, text) to anon;
grant execute on function public.check_almox_device_session(bigint, text) to authenticated;