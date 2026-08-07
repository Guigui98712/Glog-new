-- Configuracao de versao do app para alerta/forca de atualizacao
create table if not exists public.app_version_config (
  id bigserial primary key,
  platform text not null check (platform in ('android', 'ios', 'web', 'all')),
  latest_version text not null,
  min_supported_version text null,
  force_update boolean not null default false,
  store_url text null,
  title text null,
  message text null,
  release_notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_version_config_one_active_per_platform
  on public.app_version_config (platform)
  where is_active = true;

alter table public.app_version_config enable row level security;

drop policy if exists "Leitura publica versao app" on public.app_version_config;
create policy "Leitura publica versao app"
  on public.app_version_config
  for select
  using (true);

-- Configuração Android padrão
update public.app_version_config
set
  latest_version = '1.0.32',
  min_supported_version = '1.0.31',
  force_update = false,
  store_url = 'https://play.google.com/store/apps/details?id=com.glog.app',
  title = 'Nova versão disponível',
  message = 'Atualize o GLog para receber melhorias e correções mais recentes.',
  release_notes = '- Atualização da base do app para a versão 1.0.32\n- Sincronização com a versão web mais recente\n- Correções gerais de estabilidade',
  is_active = true,
  updated_at = now()
where platform = 'android' and is_active = true;

insert into public.app_version_config (
  platform,
  latest_version,
  min_supported_version,
  force_update,
  store_url,
  title,
  message,
  release_notes,
  is_active
)
select
  'android',
  '1.0.32',
  '1.0.31',
  false,
  'https://play.google.com/store/apps/details?id=com.glog.app',
  'Nova versão disponível',
  'Atualize o GLog para receber melhorias e correções mais recentes.',
  '- Atualização da base do app para a versão 1.0.32\n- Sincronização com a versão web mais recente\n- Correções gerais de estabilidade',
  true
where not exists (
  select 1
  from public.app_version_config
  where platform = 'android' and is_active = true
);
