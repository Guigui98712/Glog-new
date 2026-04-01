-- Rate limit para envio/reenvio de codigo de recuperacao de senha
-- Janela padrao: 50 segundos por email

create extension if not exists pgcrypto;

create table if not exists public.password_recovery_rate_limit (
  email_hash text primary key,
  last_requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.password_recovery_rate_limit enable row level security;

-- Bloqueia acesso direto da tabela pelo client

drop policy if exists no_direct_select_password_recovery_rl on public.password_recovery_rate_limit;
create policy no_direct_select_password_recovery_rl
on public.password_recovery_rate_limit
for select
to anon, authenticated
using (false);

drop policy if exists no_direct_insert_password_recovery_rl on public.password_recovery_rate_limit;
create policy no_direct_insert_password_recovery_rl
on public.password_recovery_rate_limit
for insert
to anon, authenticated
with check (false);

drop policy if exists no_direct_update_password_recovery_rl on public.password_recovery_rate_limit;
create policy no_direct_update_password_recovery_rl
on public.password_recovery_rate_limit
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_direct_delete_password_recovery_rl on public.password_recovery_rate_limit;
create policy no_direct_delete_password_recovery_rl
on public.password_recovery_rate_limit
for delete
to anon, authenticated
using (false);

create or replace function public.check_password_recovery_resend(
  p_email text,
  p_cooldown_seconds int default 50
)
returns table (
  allowed boolean,
  wait_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_last timestamptz;
  v_email_hash text;
  v_remaining int;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return query select false, p_cooldown_seconds;
    return;
  end if;

  v_email_hash := encode(digest(lower(trim(p_email)), 'sha256'), 'hex');

  select rl.last_requested_at
    into v_last
  from public.password_recovery_rate_limit rl
  where rl.email_hash = v_email_hash;

  if v_last is null then
    insert into public.password_recovery_rate_limit (email_hash, last_requested_at)
    values (v_email_hash, v_now)
    on conflict (email_hash) do update
      set last_requested_at = excluded.last_requested_at;

    return query select true, 0;
    return;
  end if;

  v_remaining := ceil(p_cooldown_seconds - extract(epoch from (v_now - v_last)));

  if v_remaining <= 0 then
    update public.password_recovery_rate_limit
       set last_requested_at = v_now
     where email_hash = v_email_hash;

    return query select true, 0;
  else
    return query select false, v_remaining;
  end if;
end;
$$;

revoke all on function public.check_password_recovery_resend(text, int) from public;
grant execute on function public.check_password_recovery_resend(text, int) to anon, authenticated;

create or replace function public.cleanup_password_recovery_rate_limit(
  p_older_than interval default interval '30 days'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.password_recovery_rate_limit
   where last_requested_at < now() - p_older_than;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
