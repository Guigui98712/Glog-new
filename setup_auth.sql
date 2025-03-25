-- Script para configurar autenticação no Supabase

-- Habilitar o esquema de autenticação
CREATE SCHEMA IF NOT EXISTS auth;

-- Configurar as políticas de segurança para as tabelas existentes
-- Isso permite que usuários autenticados acessem as tabelas

-- Obras
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.obras;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.obras
  FOR ALL USING (auth.role() = 'authenticated');

-- Diário de obra
ALTER TABLE public.diario_obra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.diario_obra;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.diario_obra
  FOR ALL USING (auth.role() = 'authenticated');

-- Relatórios
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.relatorios;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.relatorios
  FOR ALL USING (auth.role() = 'authenticated');

-- Orçamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.orcamentos;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.orcamentos
  FOR ALL USING (auth.role() = 'authenticated');

-- Etapas
ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.etapas;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.etapas
  FOR ALL USING (auth.role() = 'authenticated');

-- Funcionários
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.funcionarios;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.funcionarios
  FOR ALL USING (auth.role() = 'authenticated');

-- Presenças
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.presencas;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.presencas
  FOR ALL USING (auth.role() = 'authenticated');

-- Tabelas Trello
ALTER TABLE public.trello_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.trello_lists;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_lists
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.trello_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.trello_cards;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_cards
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.trello_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.trello_checklists;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_checklists
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.trello_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso a usuários autenticados" ON public.trello_checklist_items;
CREATE POLICY "Permitir acesso a usuários autenticados" ON public.trello_checklist_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Configurar a tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para a tabela de perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários vejam seus próprios perfis
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem ver seus próprios perfis" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Permitir que usuários atualizem seus próprios perfis
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seus próprios perfis" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Função para criar automaticamente um perfil quando um usuário se cadastra
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para chamar a função quando um usuário é criado
DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
CREATE TRIGGER create_profile_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_user(); 