import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import NotificationService from '@/services/NotificationService';

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
  const [itens, setItens] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!itens.trim()) {
        toast.error('Digite pelo menos um item para a lista');
        return;
      }

      // Buscar informações da obra
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome, responsavel')
        .eq('id', obraId)
        .single();

      if (obraError) throw obraError;

      // Inserir nova demanda
      const { data: novaDemanda, error: insertError } = await supabase
        .from('demanda_itens')
        .insert({
          obra_id: obraId,
          titulo: 'Lista de Demanda',
          descricao: itens.trim(),
          status: 'demanda'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Enviar notificação
      const notificationService = NotificationService.getInstance();
      await notificationService.notificarNovaDemanda(
        obraId,
        itens.trim()
      );

      toast.success('Lista de demanda adicionada com sucesso');
      onDemandaAdicionada();
      onOpenChange(false);
      setItens('');
    } catch (error) {
      console.error('Erro ao adicionar lista de demanda:', error);
      toast.error('Erro ao adicionar lista de demanda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Lista de Demanda</DialogTitle>
          <DialogDescription>
            Adicione os itens da lista de demanda, um por linha.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="itens">Itens da lista (um por linha)</Label>
            <Textarea
              id="itens"
              value={itens}
              onChange={(e) => setItens(e.target.value)}
              placeholder="Digite os itens da lista, um em cada linha"
              className="min-h-[200px]"
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
            disabled={loading || !itens.trim()}
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 