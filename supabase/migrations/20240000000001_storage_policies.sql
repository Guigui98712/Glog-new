-- Políticas para o bucket 'projetos'

-- Política para permitir upload de arquivos
create policy "Permitir upload de projetos para usuários autenticados"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'projetos' AND
  (storage.extension(name) = 'dwg' OR 
   storage.extension(name) = 'rvt' OR 
   storage.extension(name) = 'pdf')
);

-- Política para permitir download/select de arquivos
create policy "Permitir visualização de projetos para usuários autenticados"
on storage.objects for select
to authenticated
using (bucket_id = 'projetos');

-- Política para permitir exclusão de arquivos
create policy "Permitir exclusão de projetos para usuários autenticados"
on storage.objects for delete
to authenticated
using (bucket_id = 'projetos'); 