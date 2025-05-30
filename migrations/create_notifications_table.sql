-- Criar tabela de notificações para armazenar todas as notificações do sistema
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  obra_id BIGINT REFERENCES public.obras(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', etc.
  source TEXT DEFAULT NULL, -- 'demanda', 'pendencia', 'diario', etc.
  source_id BIGINT DEFAULT NULL, -- ID do objeto de origem (ex: demanda_id)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_obra_id ON public.notifications(obra_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_notifications_updated_at();

-- Políticas de segurança

-- Usuários só podem ver suas próprias notificações
CREATE POLICY "Usuários podem ver suas próprias notificações" 
  ON public.notifications 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Usuários só podem atualizar suas próprias notificações (para marcar como lidas)
CREATE POLICY "Usuários podem atualizar suas próprias notificações" 
  ON public.notifications 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Apenas sistema e admin podem inserir notificações
CREATE POLICY "Serviço pode inserir notificações" 
  ON public.notifications 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Função para limpar notificações antigas (opcional)
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS void AS $$
BEGIN
  -- Remover notificações lidas com mais de 30 dias
  DELETE FROM public.notifications
  WHERE read = true AND created_at < (NOW() - INTERVAL '30 days');
  
  -- Limitar notificações não lidas a 100 por usuário
  DELETE FROM public.notifications n
  WHERE n.id IN (
    SELECT id FROM public.notifications
    WHERE read = false
    ORDER BY created_at ASC
    OFFSET 100
  );
END;
$$ LANGUAGE plpgsql; 