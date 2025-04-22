import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';
import { EditarPedidoDialog } from './EditarPedidoDialog';
import { NotificationService } from '@/services/NotificationService';

interface MoverParaPedidoDialogProps {
  item: DemandaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemMovido: () => void;
}

export function MoverParaPedidoDialog({
  item,
  open,
  onOpenChange,
  onItemMovido
}: MoverParaPedidoDialogProps) {
  const [valor, setValor] = useState('');
  const [pedidoCompleto, setPedidoCompleto] = useState(true);
  const [descricao, setDescricao] = useState(item.descricao || '');
  const [loading, setLoading] = useState(false);
  const [showEditarPedido, setShowEditarPedido] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!valor || isNaN(Number(valor))) {
        toast.error('Digite um valor válido');
        return;
      }

      // Buscar informações da obra
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome, responsavel_id')
        .eq('id', item.obra_id)
        .single();

      if (obraError) throw obraError;

      const { error } = await supabase
        .from('demanda_itens')
        .update({
          status: 'pedido',
          valor: Number(valor),
          pedido_completo: pedidoCompleto,
          descricao: pedidoCompleto ? item.descricao : descricao.trim(),
          data_pedido: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;

      // Enviar notificação
      if (obra.responsavel_id) {
        const notificationService = NotificationService.getInstance();
        await notificationService.sendNotification(
          obra.responsavel_id,
          'Demanda Movida para Pedido',
          `Um item foi movido para pedido na obra ${obra.nome}: ${item.titulo}`
        );
      }

      toast.success('Item movido para Pedido');
      onItemMovido();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao mover item:', error);
      toast.error('Erro ao mover item para Pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showEditarPedido} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mover para Pedido</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Lista Original</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={pedidoCompleto}
                className="min-h-[100px]"
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
            <div className="flex items-center space-x-2">
              <Switch
                id="pedido-completo"
                checked={pedidoCompleto}
                onCheckedChange={setPedidoCompleto}
              />
              <Label htmlFor="pedido-completo">Pedido Completo</Label>
            </div>
            {!pedidoCompleto && (
              <p className="text-sm text-muted-foreground">
                Edite a lista acima para incluir apenas os itens que foram realmente pedidos
              </p>
            )}
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
                disabled={loading || !valor || (!pedidoCompleto && !descricao.trim())}
              >
                {loading ? 'Movendo...' : 'Mover para Pedido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditarPedido && (
        <EditarPedidoDialog
          item={{
            ...item,
            valor: Number(valor)
          }}
          open={showEditarPedido}
          onOpenChange={(open) => {
            setShowEditarPedido(open);
            if (!open) onOpenChange(false);
          }}
          onPedidoEditado={onItemMovido}
        />
      )}
    </>
  );
} 