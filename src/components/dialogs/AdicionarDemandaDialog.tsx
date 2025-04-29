import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import NotificationService from '@/services/NotificationService';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { LocalNotifications } from '@capacitor/local-notifications';

interface DemandaItem {
  id: number;
  obra_id: number;
  titulo: string;
  descricao?: string;
  status: 'demanda' | 'pedido' | 'entregue' | 'pago';
}

interface AdicionarDemandaDialogProps {
  obraId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDemandaAdicionada: () => void;
  itemParaEditar?: DemandaItem;
}

export function AdicionarDemandaDialog({
  obraId,
  open,
  onOpenChange,
  onDemandaAdicionada,
  itemParaEditar
}: AdicionarDemandaDialogProps) {
  const [itens, setItens] = useState('');
  const [loading, setLoading] = useState(false);

  const enviarNotificacaoLocalNovaDemanda = async (titulo: string) => {
    try {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Nova Demanda Adicionada",
              body: `Uma nova lista de demanda foi adicionada: ${titulo.substring(0, 50)}...`,
              id: Math.floor(Math.random() * 10000) + 1,
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_notification',
              channelId: 'default',
            }
          ]
        });
      } else {
        console.warn('Permissão de notificação local negada.');
      }
    } catch (error) {
      console.error('Erro ao enviar notificação local de nova demanda:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const textoComQuebras = itens
        .replace(/<\/p>/g, '\n')         
        .replace(/<[^>]*>/g, '')       
        .replace(/\n+/g, '\n')         
        .trim();                      

      if (!textoComQuebras) {
        toast.error('Digite pelo menos um item para a lista');
        return;
      }

      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome, responsavel')
        .eq('id', obraId)
        .single();

      if (obraError) throw obraError;

      const { data: novaDemanda, error: insertError } = await supabase
        .from('demanda_itens')
        .insert({
          obra_id: obraId,
          titulo: 'Lista de Demanda',
          descricao: textoComQuebras,
          status: 'demanda'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const notificationService = NotificationService.getInstance();
      await notificationService.notificarNovaDemanda(
        obraId,
        textoComQuebras
      );

      await enviarNotificacaoLocalNovaDemanda(textoComQuebras);

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
            <RichTextEditor
              value={itens}
              onChange={setItens}
              placeholder="Digite os itens da lista, um em cada linha"
              minHeight="200px"
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