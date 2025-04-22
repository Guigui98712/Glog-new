import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { NotificationService } from '@/services/NotificationService';

interface AdicionarDemandaDialogProps {
  obraId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDemandaAdicionada: () => void;
}

export function AdicionarDemandaDialog({
  obraId,
  open,
  onOpenChange,
  onDemandaAdicionada
}: AdicionarDemandaDialogProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!titulo.trim()) {
        toast.error('Digite um título para a demanda');
        return;
      }

      // Buscar informações da obra
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome, responsavel_id')
        .eq('id', obraId)
        .single();

      if (obraError) throw obraError;

      // Inserir nova demanda
      const { error: insertError } = await supabase
        .from('demanda_itens')
        .insert({
          obra_id: obraId,
          titulo,
          descricao: descricao.trim(),
          status: 'demanda'
        });

      if (insertError) throw insertError;

      // Enviar notificação
      if (obra.responsavel_id) {
        const notificationService = NotificationService.getInstance();
        await notificationService.sendNotification(
          obra.responsavel_id,
          'Nova Demanda',
          `Uma nova demanda foi adicionada à obra ${obra.nome}: ${titulo}`
        );
      }

      toast.success('Demanda adicionada com sucesso');
      onDemandaAdicionada();
      onOpenChange(false);
      setTitulo('');
      setDescricao('');
    } catch (error) {
      console.error('Erro ao adicionar demanda:', error);
      toast.error('Erro ao adicionar demanda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Demanda</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título da demanda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite uma descrição para a demanda"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !titulo.trim()}
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 