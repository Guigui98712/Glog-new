-- Configurar o bucket para armazenamento de imagens
update storage.buckets
set public = true
where id = 'notas-fiscais';

-- Política para permitir upload de imagens por usuários autenticados
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Usuários autenticados podem fazer upload de imagens') then
    create policy "Usuários autenticados podem fazer upload de imagens"
    on storage.objects for insert
    with check (
      bucket_id = 'notas-fiscais' 
      and auth.role() = 'authenticated'
    );
  end if;
end $$;

-- Política para permitir atualização de imagens por usuários autenticados
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Usuários autenticados podem atualizar imagens') then
    create policy "Usuários autenticados podem atualizar imagens"
    on storage.objects for update
    using (
      bucket_id = 'notas-fiscais' 
      and auth.role() = 'authenticated'
    );
  end if;
end $$;

-- Política para permitir exclusão de imagens por usuários autenticados
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Usuários autenticados podem excluir imagens') then
    create policy "Usuários autenticados podem excluir imagens"
    on storage.objects for delete
    using (
      bucket_id = 'notas-fiscais' 
      and auth.role() = 'authenticated'
    );
  end if;
end $$;

-- Política para permitir leitura pública das imagens
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Qualquer pessoa pode visualizar imagens') then
    create policy "Qualquer pessoa pode visualizar imagens"
    on storage.objects for select
    using (bucket_id = 'notas-fiscais');
  end if;
end $$;

-- Configurar MIME types permitidos
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Permitir apenas imagens') then
    create policy "Permitir apenas imagens"
    on storage.objects for insert
    with check (
      bucket_id = 'notas-fiscais' 
      and (storage.foldername(name))[1] != '.' -- impedir arquivos ocultos
      and (
        lower(substring(name from '\.([^\.]+)$')) in (
          'jpg', 'jpeg', 'png', 'webp'
        )
      )
    );
  end if;
end $$;

-- Configurar tamanho máximo do arquivo (5MB)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Limitar tamanho do arquivo') then
    create policy "Limitar tamanho do arquivo"
    on storage.objects for insert
    with check (
      bucket_id = 'notas-fiscais' 
      and (metadata->>'size')::bigint <= 5242880
    );
  end if;
end $$; 