-- Migrar o campo nota_fiscal de text para text[]
do $$
begin
  -- Verifica se a coluna existe e seu tipo atual
  if exists (
    select 1 
    from information_schema.columns 
    where table_name = 'demanda_itens' 
    and column_name = 'nota_fiscal'
    and data_type = 'text'
  ) then
    -- Primeiro, converte os dados existentes para array
    update demanda_itens 
    set nota_fiscal = array[nota_fiscal]::text[] 
    where nota_fiscal is not null 
    and nota_fiscal != '';

    -- Altera o tipo da coluna
    alter table demanda_itens 
    alter column nota_fiscal type text[] using nota_fiscal::text[];
  end if;
end $$; 