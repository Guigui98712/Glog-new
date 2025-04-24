import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { Loader2, Camera, X } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import NotificationService from '@/services/NotificationService';

interface MoverParaEntregueDialogProps {
  item: DemandaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemMovido: () => void;
}

interface ImagemPreview {
  file: File;
  previewUrl: string;
}

export function MoverParaEntregueDialog({
  item,
  open,
  onOpenChange,
  onItemMovido
}: MoverParaEntregueDialogProps) {
  const [tudoOk, setTudoOk] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [imagens, setImagens] = useState<ImagemPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImagemAtual, setPreviewImagemAtual] = useState<string | null>(null);

  const validarImagem = (file: File) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
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
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (validarImagem(file)) {
          const previewUrl = URL.createObjectURL(file);
          setImagens(prev => [...prev, { file, previewUrl }]);
        }
      });
    }
    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const removerImagem = (index: number) => {
    setImagens(prev => {
      const novasImagens = [...prev];
      URL.revokeObjectURL(novasImagens[index].previewUrl);
      novasImagens.splice(index, 1);
      return novasImagens;
    });
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

      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome, responsavel')
        .eq('id', item.obra_id)
        .single();

      if (obraError) throw obraError;

      // Array para armazenar os nomes dos arquivos
      let notasFiscais: string[] = [];

      // Se já existem notas fiscais, mantê-las
      if (item.nota_fiscal) {
        notasFiscais = Array.isArray(item.nota_fiscal) 
          ? [...item.nota_fiscal] 
          : [item.nota_fiscal];
      }

      // Upload de todas as novas imagens
      for (const imagem of imagens) {
        try {
          const imagemComprimida = await comprimirImagem(imagem.file);
          const fileExt = 'jpg';
          const fileName = `${item.id}_${Date.now()}_${notasFiscais.length}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('notas-fiscais')
            .upload(fileName, imagemComprimida, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (uploadError) throw uploadError;

          // Adiciona apenas o nome do arquivo ao array
          notasFiscais.push(fileName);
        } catch (uploadError) {
          console.error('Erro no upload:', uploadError);
          toast.error(`Erro ao fazer upload da imagem ${imagem.file.name}`);
        }
      }

      const tempoEntrega = item.data_pedido 
        ? formatDistanceToNow(new Date(item.data_pedido), { locale: ptBR })
        : '';

      // Garante que notasFiscais seja sempre um array
      const { error: updateError } = await supabase
        .from('demanda_itens')
        .update({
          status: 'entregue',
          observacao_entrega: observacao || null,
          nota_fiscal: notasFiscais,
          data_entrega: new Date().toISOString(),
          tempo_entrega: tempoEntrega,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      const notificationService = NotificationService.getInstance();
      await notificationService.notificarDemandaParaEntregue(
        item.obra_id,
        item.descricao
      );

      toast.success('Item movido para entregue com sucesso');
      onItemMovido();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro completo da operação:', error);
      toast.error('Erro ao mover item para entregue');
    } finally {
      setLoading(false);
    }
  };

  const tirarFoto = async () => {
    try {
      await CapacitorCamera.requestPermissions();

      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (!image.base64String) {
        throw new Error('Falha ao capturar imagem');
      }

      const byteCharacters = atob(image.base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      const previewUrl = URL.createObjectURL(file);
      setImagens(prev => [...prev, { file, previewUrl }]);
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      toast.error('Erro ao tirar foto');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover para Entregue</DialogTitle>
            <DialogDescription>
              Confirme a entrega do item e adicione informações adicionais se necessário.
            </DialogDescription>
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
              <Label htmlFor="nota-fiscal">Imagens do Item (opcional)</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  id="nota-fiscal"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full"
                  multiple
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={tirarFoto}
                  title="Tirar foto"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              
              {imagens.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {imagens.map((imagem, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={imagem.previewUrl} 
                        alt={`Imagem ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => {
                          setPreviewImagemAtual(imagem.previewUrl);
                          setShowPreview(true);
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removerImagem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
          {previewImagemAtual && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={previewImagemAtual} 
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