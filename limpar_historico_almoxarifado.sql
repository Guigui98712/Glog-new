  -- Zera TODO o almoxarifado (todas as obras):
  -- - itens e movimentacoes
  -- - ferramentas e historico de ferramentas
  -- - codigos e dispositivos de acesso
  --
  -- ATENCAO: remove todos os dados de almoxarifado e reinicia IDs.

  begin;

  -- Resumo antes da limpeza
  select
    (select count(*) from public.almox_items) as itens,
    (select count(*) from public.almox_movements) as movimentos,
    (select count(*) from public.almox_tools) as ferramentas,
    (select count(*) from public.almox_tools_history) as ferramentas_historico,
    (select count(*) from public.almox_access_codes) as codigos_acesso,
    (select count(*) from public.almox_access_devices) as dispositivos_acesso;

  truncate table
    public.almox_access_devices,
    public.almox_access_codes,
    public.almox_movements,
    public.almox_tools_history,
    public.almox_tools,
    public.almox_items
  restart identity;

  -- Confirmacao apos limpeza
  select
    (select count(*) from public.almox_items) as itens,
    (select count(*) from public.almox_movements) as movimentos,
    (select count(*) from public.almox_tools) as ferramentas,
    (select count(*) from public.almox_tools_history) as ferramentas_historico,
    (select count(*) from public.almox_access_codes) as codigos_acesso,
    (select count(*) from public.almox_access_devices) as dispositivos_acesso;

  commit;
