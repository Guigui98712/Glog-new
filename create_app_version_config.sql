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

-- Exemplo inicial Android
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
values (
  'android',
  '1.0.24',
  '1.0.23',
  false,
  'https://play.google.com/store/apps/details?id=com.glog.app',
  'Nova versão disponível',
  'Atualize o GLog para receber melhorias e correções mais recentes.',
  '- Melhorias de responsividade para telas pequenas\n- Ajustes na produção e exportação\n- Correções gerais de estabilidade',
  true
)
on conflict do nothing;
