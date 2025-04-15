import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface MoverParaEntregueDialogProps {
  item: DemandaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemMovido: () => void;
}

export function MoverParaEntregueDialog({
  item,
  open,
  onOpenChange,
  onItemMovido
}: MoverParaEntregueDialogProps) {
  const [tudoOk, setTudoOk] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [notaFiscal, setNotaFiscal] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const validarImagem = (file: File) => {
    // Tipos de imagem permitidos
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    // Tamanho máximo (5MB)
    const tamanhoMaximo = 5 * 1024 * 1024;
    
    if (!tiposPermitidos.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use apenas imagens (JPG, PNG ou WEBP)');
      return false;
    }
    
    if (file.size > tamanhoMaximo) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return false;
    }
    
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!validarImagem(file)) {
        e.target.value = '';
        return;
      }
      
      setNotaFiscal(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const comprimirImagem = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Se a imagem for maior que 1920px, redimensiona mantendo a proporção
          if (width > 1920) {
            height = Math.round((height * 1920) / width);
            width = 1920;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const novoArquivo = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(novoArquivo);
              } else {
                reject(new Error('Erro ao comprimir imagem'));
              }
            },
            'image/jpeg',
            0.8
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!tudoOk && !observacao) {
        toast.error('Adicione uma observação quando houver problemas');
        return;
      }

      let notaFiscalUrl = '';
      if (notaFiscal) {
        try {
          // Comprimir imagem antes do upload
          const imagemComprimida = await comprimirImagem(notaFiscal);
          
          const fileExt = 'jpg'; // Sempre salvamos como JPG após a compressão
          const fileName = `${item.id}_${Date.now()}.${fileExt}`;
          
          console.log('Iniciando upload da imagem:', fileName);
          
          const { error: uploadError, data } = await supabase.storage
            .from('notas-fiscais')
            .upload(fileName, imagemComprimida, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error('Erro detalhado do upload:', uploadError);
            throw uploadError;
          }

          console.log('Upload realizado com sucesso:', data);

          const { data: { publicUrl } } = supabase.storage
            .from('notas-fiscais')
            .getPublicUrl(fileName);

          console.log('URL pública gerada:', publicUrl);
          notaFiscalUrl = publicUrl;
          
        } catch (uploadError) {
          console.error('Erro detalhado no upload:', uploadError);
          toast.error('Erro ao fazer upload da imagem. Tente novamente.');
          return;
        }
      }

      console.log('Atualizando item com URL:', notaFiscalUrl);

      const tempoEntrega = item.data_pedido 
        ? formatDistanceToNow(new Date(item.data_pedido), { locale: ptBR })
        : '';

      const { error: updateError } = await supabase
        .from('demanda_itens')
        .update({
          status: 'entregue',
          observacao_entrega: observacao || null,
          nota_fiscal: notaFiscalUrl || null,
          data_entrega: new Date().toISOString(),
          tempo_entrega: tempoEntrega,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) {
        console.error('Erro detalhado ao atualizar item:', updateError);
        throw updateError;
      }

      toast.success('Item movido para Entregue');
      onItemMovido();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro completo da operação:', error);
      toast.error('Erro ao mover item para Entregue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover para Entregue</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {item.data_pedido && (
              <div className="text-sm text-muted-foreground">
                Tempo desde o pedido: {formatDistanceToNow(new Date(item.data_pedido), { locale: ptBR })}
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="tudo-ok"
                checked={tudoOk}
                onCheckedChange={setTudoOk}
              />
              <Label htmlFor="tudo-ok">Tudo ok com o item?</Label>
            </div>

            {!tudoOk && (
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Descreva o problema..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nota-fiscal">Imagem do Item (opcional)</Label>
              <input
                type="file"
                id="nota-fiscal"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full"
              />
              {previewUrl && (
                <div className="mt-2">
                  <img 
                    src={previewUrl} 
                    alt="Preview da imagem" 
                    className="max-h-40 rounded-lg cursor-pointer"
                    onClick={() => setShowPreview(true)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSubmit}
              disabled={loading || (!tudoOk && !observacao)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualização da Imagem</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={previewUrl} 
                alt="Preview da imagem" 
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 