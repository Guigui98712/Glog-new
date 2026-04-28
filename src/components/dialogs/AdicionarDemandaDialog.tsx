import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { buscarObra } from '@/lib/api';
import NotificationService from '@/services/NotificationService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';

interface DemandaItem {
  id: number;
  obra_id: number;
  titulo: string;
  categoria?: string | null;
  descricao?: string;
  status: 'demanda' | 'pedido' | 'entregue' | 'pago';
}

interface AdicionarDemandaDialogProps {
  obraId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDemandaAdicionada: () => void;
  categorias: string[];
  itemParaEditar?: DemandaItem;
}

export function AdicionarDemandaDialog({
  obraId,
  open,
  onOpenChange,
  onDemandaAdicionada,
  categorias,
  itemParaEditar
}: AdicionarDemandaDialogProps) {
  const [nomeLista, setNomeLista] = useState('');
  const [categoria, setCategoria] = useState('__sem_categoria__');
  const [itens, setItens] = useState('');
  const [loading, setLoading] = useState(false);

  const categoriasDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();

    categorias.forEach((nome) => {
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) {
        return;
      }
      mapa.set(nomeLimpo.toLowerCase(), nomeLimpo);
    });

    const categoriaAtual = itemParaEditar?.categoria?.trim();
    if (categoriaAtual) {
      mapa.set(categoriaAtual.toLowerCase(), categoriaAtual);
    }

    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categorias, itemParaEditar]);

  useEffect(() => {
    if (open) {
      setNomeLista(itemParaEditar?.titulo || '');
      setItens(itemParaEditar?.descricao || '');
      setCategoria(itemParaEditar?.categoria?.trim() || '__sem_categoria__');
      return;
    }

    setNomeLista('');
    setItens('');
    setCategoria('__sem_categoria__');
  }, [itemParaEditar, open]);

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

      const textoFinal = itens.trim();
      const tituloFinal = nomeLista.trim() || 'Lista de Demanda';
      const categoriaFinal = categoria === '__sem_categoria__' ? null : categoria;

      if (!textoFinal) {
        toast.error('Digite pelo menos um item para a lista');
        setLoading(false); 
        return;
      }

      if (itemParaEditar) {
        const { error: updateError } = await supabase
          .from('demanda_itens')
          .update({
            titulo: tituloFinal,
            descricao: textoFinal,
            categoria: categoriaFinal,
          })
          .eq('id', itemParaEditar.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('demanda_itens')
          .insert({
            obra_id: obraId,
            titulo: tituloFinal,
            descricao: textoFinal,
            categoria: categoriaFinal,
            status: 'demanda'
          });

        if (insertError) throw insertError;
      }

      if (!itemParaEditar) {
        const notificationService = NotificationService.getInstance();
        await notificationService.notificarNovaDemanda(
          obraId,
          textoFinal
        );

        await enviarNotificacaoLocalNovaDemanda(textoFinal);
      }

      toast.success(itemParaEditar ? 'Demanda atualizada com sucesso' : 'Lista de demanda adicionada com sucesso');
      onDemandaAdicionada();
      onOpenChange(false);
      setNomeLista('');
      setItens('');
      setCategoria('__sem_categoria__');
    } catch (error) {
      console.error('Erro ao salvar lista de demanda:', error);
      toast.error(itemParaEditar ? 'Erro ao atualizar lista de demanda' : 'Erro ao adicionar lista de demanda');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAndShare = async () => {
    try {
      setLoading(true);

      const textoFinal = itens.trim();
      const tituloFinal = nomeLista.trim() || 'Lista de Demanda';
      const categoriaFinal = categoria === '__sem_categoria__' ? null : categoria;

      if (!textoFinal) {
        toast.error('Digite pelo menos um item para a lista');
        setLoading(false); 
        return;
      }

      let obraNome = `Obra ${obraId}`;
      try {
        const obra = await buscarObra(obraId) as { nome?: string; obra_nome?: string } | null;
        obraNome = String(obra?.nome || obra?.obra_nome || obraNome);
      } catch (obraLookupError) {
        console.warn('[AdicionarDemandaDialog] Falha ao buscar nome da obra para compartilhamento:', obraLookupError);
      }

      const { error: insertError } = await supabase
        .from('demanda_itens')
        .insert({
          obra_id: obraId,
          titulo: tituloFinal,
          descricao: textoFinal,
          categoria: categoriaFinal,
          status: 'demanda'
        })
        .select();

      if (insertError) throw insertError;

      const notificationService = NotificationService.getInstance();
      await notificationService.notificarNovaDemanda(
        obraId,
        textoFinal
      );

      await enviarNotificacaoLocalNovaDemanda(textoFinal);

      // Compartilhar via WhatsApp
      await compartilharViaWhatsApp(obraNome, textoFinal);

      toast.success('Lista de demanda adicionada e compartilhada com sucesso');
      onDemandaAdicionada();
      onOpenChange(false);
      setNomeLista('');
      setItens('');
      setCategoria('__sem_categoria__');
    } catch (error) {
      console.error('Erro ao adicionar e compartilhar lista de demanda:', error);
      toast.error('Erro ao adicionar e compartilhar lista de demanda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{itemParaEditar ? 'Editar Lista de Demanda' : 'Adicionar Lista de Demanda'}</DialogTitle>
          <DialogDescription>
            {itemParaEditar ? 'Atualize a categoria e os itens da lista.' : 'Adicione os itens da lista de demanda, um por linha.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="demanda-nome">Nome da lista (opcional)</Label>
            <input
              id="demanda-nome"
              value={nomeLista}
              onChange={(e) => setNomeLista(e.target.value)}
              placeholder="Ex.: Elétrica bloco A (vazio = Lista de Demanda)"
              spellCheck={true}
              autoCorrect="on"
              autoCapitalize="sentences"
              autoComplete="on"
              inputMode="text"
              lang="pt-BR"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_categoria__">Sem categoria</SelectItem>
                {categoriasDisponiveis.map((nomeCategoria) => (
                  <SelectItem key={nomeCategoria} value={nomeCategoria}>
                    {nomeCategoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demanda-itens">Itens da lista (um por linha)</Label>
            <textarea
              id="demanda-itens"
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
            {loading ? (itemParaEditar ? 'Salvando...' : 'Adicionando...') : (itemParaEditar ? 'Salvar' : 'Adicionar')}
          </Button>
          {!itemParaEditar && (
            <Button
              onClick={handleSubmitAndShare}
              disabled={loading || !itens.trim()}
              type="button"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Adicionando...' : 'Adicionar e Compartilhar'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 