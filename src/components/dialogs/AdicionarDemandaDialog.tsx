import { useState, useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import NotificationService from '@/services/NotificationService';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';

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
  const [useSimpleTextarea, setUseSimpleTextarea] = useState(true);
  
  const textareaId = useId();
  const richTextLabelId = useId();

  const enviarNotificacaoLocalNovaDemanda = async (titulo: string) => {
    try {
      console.log('[AdicionarDemandaDialog] Tentando enviar notificação local.');
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
        console.log('[AdicionarDemandaDialog] Notificação local agendada.');
      } else {
        console.warn('[AdicionarDemandaDialog] Permissão de notificação local negada.');
        toast.warning("Permissão para notificações locais negada.");
      }
    } catch (error) {
      console.error('[AdicionarDemandaDialog] Erro ao enviar notificação local:', error);
      toast.error("Erro ao tentar enviar notificação local.");
    }
  };

  const compartilharViaWhatsApp = async (obraNome: string, textoFinal: string) => {
    try {
      // Formatar a mensagem para WhatsApp
      const itensFormatados = textoFinal.split('\n').filter(item => item.trim()).map(item => `• ${item.trim()}`).join('\n');
      
      const mensagem = `🏗️ *Nova Demanda Adicionada*

📋 *Obra:* ${obraNome}
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}
⏰ *Hora:* ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

📝 *Itens da Demanda:*
${itensFormatados}

---
Enviado via GLog App`;

      // Detectar plataforma
      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        // No mobile, usar o Share API do Capacitor
        await Share.share({
          title: 'Nova Demanda Adicionada',
          text: mensagem.replace(/\*\*/g, ''), // Remover markdown para compatibilidade
          dialogTitle: 'Compartilhar via WhatsApp'
        });
      } else {
        // Na web, abrir WhatsApp Web
        const mensagemCodificada = encodeURIComponent(mensagem);
        const whatsappUrl = `https://wa.me/?text=${mensagemCodificada}`;
        window.open(whatsappUrl, '_blank');
      }

      toast.success('Compartilhamento iniciado!');
    } catch (error) {
      console.error('Erro ao compartilhar via WhatsApp:', error);
      toast.error('Erro ao compartilhar via WhatsApp');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      let textoFinal = '';
      if (useSimpleTextarea) {
        textoFinal = itens.trim();
      } else {
        textoFinal = itens
          .replace(/<\/p>/g, '\n')         
          .replace(/<[^>]*>/g, '')       
          .replace(/\n+/g, '\n')         
          .trim();
      }

      if (!textoFinal) {
        toast.error('Digite pelo menos um item para a lista');
        setLoading(false); 
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
          descricao: textoFinal,
          status: 'demanda'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const notificationService = NotificationService.getInstance();
      await notificationService.notificarNovaDemanda(
        obraId,
        textoFinal
      );

      await enviarNotificacaoLocalNovaDemanda(textoFinal);

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

  const handleSubmitAndShare = async () => {
    try {
      setLoading(true);

      let textoFinal = '';
      if (useSimpleTextarea) {
        textoFinal = itens.trim();
      } else {
        textoFinal = itens
          .replace(/<\/p>/g, '\n')         
          .replace(/<[^>]*>/g, '')       
          .replace(/\n+/g, '\n')         
          .trim();
      }

      if (!textoFinal) {
        toast.error('Digite pelo menos um item para a lista');
        setLoading(false); 
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
          descricao: textoFinal,
          status: 'demanda'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const notificationService = NotificationService.getInstance();
      await notificationService.notificarNovaDemanda(
        obraId,
        textoFinal
      );

      await enviarNotificacaoLocalNovaDemanda(textoFinal);

      // Compartilhar via WhatsApp
      await compartilharViaWhatsApp(obra.nome, textoFinal);

      toast.success('Lista de demanda adicionada e compartilhada com sucesso');
      onDemandaAdicionada();
      onOpenChange(false);
      setItens('');
    } catch (error) {
      console.error('Erro ao adicionar e compartilhar lista de demanda:', error);
      toast.error('Erro ao adicionar e compartilhar lista de demanda');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditor = () => {
    setUseSimpleTextarea(!useSimpleTextarea);
    setItens('');
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
            <div className="flex justify-between items-center">
              {useSimpleTextarea ? (
                <Label htmlFor={textareaId}>Itens da lista (um por linha)</Label>
              ) : (
                <Label id={richTextLabelId}>Itens da lista (um por linha)</Label>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleEditor} 
                type="button"
                className="text-xs"
              >
                {useSimpleTextarea ? "Usar editor rico" : "Usar textarea simples"}
              </Button>
            </div>
            
            {useSimpleTextarea ? (
              <textarea
                id={textareaId}
                value={itens}
                onChange={(e) => setItens(e.target.value)}
                placeholder="Digite os itens da lista, um em cada linha"
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="sentences"
                autoComplete="on"
                inputMode="text"
                lang="pt-BR"
                className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <div aria-labelledby={richTextLabelId}>
                <RichTextEditor
                  value={itens}
                  onChange={setItens}
                  placeholder="Digite os itens da lista, um em cada linha"
                  minHeight="200px"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !itens.trim()}
            type="button"
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </Button>
          <Button
            onClick={handleSubmitAndShare}
            disabled={loading || !itens.trim()}
            type="button"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Adicionando...' : 'Adicionar e Compartilhar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 