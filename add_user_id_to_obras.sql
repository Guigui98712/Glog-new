-- Script para adicionar o campo user_id à tabela obras e atualizar as políticas de segurança

-- Adicionar o campo user_id à tabela obras
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Atualizar as políticas de segurança para filtrar por usuário
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.obras;

-- Política para SELECT: usuários só podem ver suas próprias obras
CREATE POLICY "Usuários podem ver suas próprias obras" ON public.obras
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IS NULL -- Manter compatibilidade com obras existentes
  );

-- Política para INSERT: usuários só podem inserir obras com seu próprio user_id
CREATE POLICY "Usuários podem inserir suas próprias obras" ON public.obras
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Política para UPDATE: usuários só podem atualizar suas próprias obras
CREATE POLICY "Usuários podem atualizar suas próprias obras" ON public.obras
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    user_id IS NULL -- Manter compatibilidade com obras existentes
  );

-- Política para DELETE: usuários só podem excluir suas próprias obras
CREATE POLICY "Usuários podem excluir suas próprias obras" ON public.obras
  FOR DELETE USING (
    auth.uid() = user_id OR 
    user_id IS NULL -- Manter compatibilidade com obras existentes
  );

-- Atualizar obras existentes para associá-las ao primeiro usuário (opcional)
-- Descomente esta linha se quiser associar todas as obras existentes a um usuário específico
-- UPDATE public.obras SET user_id = 'ID_DO_PRIMEIRO_USUARIO' WHERE user_id IS NULL; 