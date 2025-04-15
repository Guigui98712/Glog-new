import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
        toast.error('Adicione pelo menos um item à lista');
        return;
      }

      // Criar um único item de demanda com a lista completa
      const { error } = await supabase.from('demanda_itens').insert({
        obra_id: obraId,
        titulo: 'Lista de Demanda',
        descricao: itens.trim(),
        status: 'demanda',
        data_criacao: new Date().toISOString()
      });

      if (error) throw error;

      toast.success('Lista de demanda adicionada com sucesso!');
      setItens('');
      onDemandaAdicionada();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao adicionar lista:', error);
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
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Digite a lista de itens necessários
            </p>
            <Textarea
              value={itens}
              onChange={(e) => setItens(e.target.value)}
              placeholder="Ex:&#10;10 sacos de cimento&#10;5 metros de cabo 2.5mm&#10;2 disjuntores 25A"
              className="min-h-[200px]"
            />
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
        </div>
      </DialogContent>
    </Dialog>
  );
} 