-- Corrige RPCs publicas do almoxarife para funcionarem com RLS ativa.
-- Causa: funcoes antigas eram invoker e falham para anon quando tabelas ficam restritas.

create extension if not exists pgcrypto;

create or replace function public.register_almox_device(
  p_code text,
  p_device_name text,
  p_password text
)
returns public.almox_access_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code record;
  v_device public.almox_access_devices;
begin
  select * into v_code
  from public.almox_access_codes
  where code = p_code
    and active = true
    and expires_at > now()
  limit 1;

  if v_code is null then
    raise exception 'Codigo invalido ou expirado';
  end if;

  insert into public.almox_access_devices (obra_id, code_id, device_name, password_hash)
  values (v_code.obra_id, v_code.id, p_device_name, crypt(p_password, gen_salt('bf')))
  returning * into v_device;

  return v_device;
end;
$$;

create or replace function public.verify_almox_device(
  p_obra_id bigint,
  p_device_name text,
  p_password text
)
returns public.almox_access_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.almox_access_devices;
begin
  select * into v_device
  from public.almox_access_devices
  where obra_id = p_obra_id
    and device_name = p_device_name
    and active = true
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if v_device is null then
    raise exception 'Credenciais invalidas';
  end if;

  update public.almox_access_devices
  set last_seen = now()
  where id = v_device.id;

  return v_device;
end;
$$;

grant execute on function public.register_almox_device(text, text, text) to anon;
grant execute on function public.register_almox_device(text, text, text) to authenticated;
grant execute on function public.verify_almox_device(bigint, text, text) to anon;
grant execute on function public.verify_almox_device(bigint, text, text) to authenticated;
