-- Habilitar o bucket de arquivos com políticas de segurança adequadas

-- Criar o bucket de arquivos se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('arquivos', 'arquivos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de segurança para o bucket 'arquivos'

-- Política para permitir leitura de arquivos a usuários autenticados
CREATE POLICY "Usuários autenticados podem visualizar arquivos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'arquivos');

-- Política para permitir que usuários autenticados façam upload de arquivos
CREATE POLICY "Usuários autenticados podem fazer upload de arquivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'arquivos');

-- Política para permitir que usuários autenticados atualizem seus próprios arquivos
CREATE POLICY "Usuários autenticados podem atualizar seus próprios arquivos"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner)
WITH CHECK (bucket_id = 'arquivos');

-- Política para permitir que usuários autenticados excluam seus próprios arquivos
CREATE POLICY "Usuários autenticados podem excluir seus próprios arquivos"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner AND bucket_id = 'arquivos'); 