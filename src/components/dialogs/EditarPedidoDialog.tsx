import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';

interface EditarPedidoDialogProps {
  item: DemandaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPedidoEditado: () => void;
}

export function EditarPedidoDialog({
  item,
  open,
  onOpenChange,
  onPedidoEditado
}: EditarPedidoDialogProps) {
  const [descricao, setDescricao] = useState(item.descricao || '');
  const [valor, setValor] = useState(item.valor?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!valor || isNaN(Number(valor))) {
        toast.error('Digite um valor válido');
        return;
      }

      const { error } = await supabase
        .from('demanda_itens')
        .update({
          descricao: descricao.trim(),
          valor: Number(valor),
          pedido_completo: false,
          data_pedido: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Pedido atualizado com sucesso');
      onPedidoEditado();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      toast.error('Erro ao atualizar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Pedido Parcial</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Lista de Itens do Pedido</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Atualize a lista com os itens que foram realmente pedidos..."
              className="min-h-[200px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor">Valor do Pedido</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
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
              disabled={loading || !valor || !descricao.trim()}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 