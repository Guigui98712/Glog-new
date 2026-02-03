create extension if not exists pgcrypto;

create table if not exists almox_access_devices (
  id bigserial primary key,
  obra_id bigint not null references obras(id) on delete cascade,
  code_id bigint not null references almox_access_codes(id) on delete cascade,
  device_name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);

create index if not exists idx_almox_access_devices_obra_id on almox_access_devices(obra_id);
create index if not exists idx_almox_access_devices_code_id on almox_access_devices(code_id);
create unique index if not exists uq_almox_access_devices_obra_device on almox_access_devices(obra_id, device_name);

create or replace function register_almox_device(
  p_code text,
  p_device_name text,
  p_password text
)
returns almox_access_devices
language plpgsql
as $$
declare
  v_code record;
  v_device almox_access_devices;
begin
  select * into v_code
  from almox_access_codes
  where code = p_code
    and active = true
    and expires_at > now()
  limit 1;

  if v_code is null then
    raise exception 'Código inválido ou expirado';
  end if;

  insert into almox_access_devices (obra_id, code_id, device_name, password_hash)
  values (v_code.obra_id, v_code.id, p_device_name, crypt(p_password, gen_salt('bf')))
  returning * into v_device;

  return v_device;
end;
$$;

create or replace function verify_almox_device(
  p_obra_id bigint,
  p_device_name text,
  p_password text
)
returns almox_access_devices
language plpgsql
as $$
declare
  v_device almox_access_devices;
begin
  select * into v_device
  from almox_access_devices
  where obra_id = p_obra_id
    and device_name = p_device_name
    and active = true
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if v_device is null then
    raise exception 'Credenciais inválidas';
  end if;

  update almox_access_devices
  set last_seen = now()
  where id = v_device.id;

  return v_device;
end;
$$;
