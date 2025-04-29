import { useState, useEffect } from 'react';
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
import { Loader2, Camera as CameraIcon, X, Image as ImageIcon } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import NotificationService from '@/services/NotificationService';
import { Device } from '@capacitor/device';

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
  const [platform, setPlatform] = useState<string>('web');

  useEffect(() => {
    const detectPlatform = async () => {
      const info = await Device.getInfo();
      setPlatform(info.platform || 'web');
    };
    detectPlatform();
  }, []);

  const validarImagem = (file: File) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
    const tamanhoMaximo = 10 * 1024 * 1024; // 10MB
    
    if (!tiposPermitidos.includes(file.type.toLowerCase())) {
      toast.error('Tipo de arquivo não permitido. Use apenas imagens (JPG, PNG, WEBP, HEIC)');
      return false;
    }
    
    if (file.size > tamanhoMaximo) {
      toast.error('Imagem muito grande. Máximo 10MB');
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
          
          // Redimensionar se muito grande
          if (width > 1920) {
            height = Math.round((height * 1920) / width);
            width = 1920;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
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
        img.onerror = () => reject(new Error('Erro ao carregar imagem para compressão'));
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo para compressão'));
    });
  };

  const handleTirarFoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: true
      });

      if (!image.base64String) {
        throw new Error('Falha ao capturar imagem');
      }

      // Converter Base64 para File
      const response = await fetch(`data:image/jpeg;base64,${image.base64String}`);
      const blob = await response.blob();
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      const previewUrl = URL.createObjectURL(file);
      setImagens(prev => [...prev, { file, previewUrl }]);
      
      toast.success('Foto capturada com sucesso!');
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('cancelled')) {
        toast.info('Captura de foto cancelada.');
      } else {
        toast.error('Não foi possível acessar a câmera.');
      }
    }
  };

  const handleSelecionarFotoGaleria = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (!image.base64String) {
        throw new Error('Falha ao selecionar imagem');
      }

      // Determinar o tipo MIME
      const mimeType = image.format === 'png' ? 'image/png' : 'image/jpeg';
      const fileExtension = image.format === 'png' ? 'png' : 'jpg';

      // Converter Base64 para File
      const response = await fetch(`data:${mimeType};base64,${image.base64String}`);
      const blob = await response.blob();
      const file = new File([blob], `foto_galeria_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`, { type: mimeType });
      
      const previewUrl = URL.createObjectURL(file);
      setImagens(prev => [...prev, { file, previewUrl }]);
      
      toast.success('Foto selecionada com sucesso!');
    } catch (error) {
      console.error('Erro ao selecionar foto:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('cancelled')) {
        toast.info('Seleção de foto cancelada.');
      } else {
        toast.error('Não foi possível acessar a galeria.');
      }
    }
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

          notasFiscais.push(fileName);
        } catch (uploadError) {
          console.error('Erro no upload:', uploadError);
          toast.error(`Erro ao fazer upload da imagem ${imagem.file.name}`);
        }
      }

      const tempoEntrega = item.data_pedido 
        ? formatDistanceToNow(new Date(item.data_pedido), { locale: ptBR })
        : '';

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
              <Label>Imagens do Item (opcional)</Label>
              <div className="flex items-center space-x-4">
                {platform === 'web' ? (
                  // Opção para Web: Input de Arquivo
                  <div className="relative">
                    <Input
                      id="file-upload-input"
                      type="file"
                      multiple
                      accept="image/*,.heic,.heif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload-input')?.click()}
                      title="Selecionar arquivos do computador"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Selecionar Arquivos
                    </Button>
                  </div>
                ) : (
                  // Opção para Nativo: Botão Capacitor Camera
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelecionarFotoGaleria}
                    title="Selecionar fotos da galeria"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Selecionar da Galeria
                  </Button>
                )}

                {/* Botão Tirar Foto (Comum a todas as plataformas) */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTirarFoto}
                  title="Tirar foto"
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  <CameraIcon className="h-4 w-4" />
                </Button>

                {/* Botão Limpar Fotos (se houver fotos) */}
                {imagens.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImagens([])}
                  >
                    Limpar Fotos
                  </Button>
                )}
              </div>
              
              {/* Preview das imagens */}
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