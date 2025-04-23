import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, ArrowRight, ArrowLeft as ArrowLeftIcon, X, Image as ImageIcon, FileText, FolderOpen, Trash2, Pencil, Camera as CameraIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';
import { AdicionarDemandaDialog } from '@/components/dialogs/AdicionarDemandaDialog';
import { MoverParaPedidoDialog } from '@/components/dialogs/MoverParaPedidoDialog';
import { MoverParaEntregueDialog } from '@/components/dialogs/MoverParaEntregueDialog';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { pdfStyles } from '@/styles/pdf-styles';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import NotificationService from '@/services/NotificationService';
import DemandaService from '@/services/DemandaService';
import ImageCacheService from '@/services/ImageCacheService';

interface DemandaObraProps {}

interface ImageUrlsState {
  [key: string]: string;
}

// Componente ImagemMiniatura movido para fora
interface ImagemMiniaturaProps {
  imagem: string;
  index: number;
  itemSelecionado: DemandaItem;
  onVisualizarImagem: () => void;
  getImageUrl: (path: string) => Promise<string>;
}

const ImagemMiniatura: React.FC<ImagemMiniaturaProps> = ({ 
  imagem, 
  index, 
  itemSelecionado, 
  onVisualizarImagem,
  getImageUrl 
}) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retries, setRetries] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    const loadImage = async () => {
      if (!imagem) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const imageUrl = await getImageUrl(imagem);
        
        if (isMounted) {
          setUrl(imageUrl);
          setLoading(false);
          setRetries(0);
        }
      } catch (error) {
        console.error('Erro ao carregar miniatura:', error);
        if (isMounted) {
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries), 8000);
            retryTimeout = setTimeout(() => {
              setRetries(prev => prev + 1);
            }, delay);
          } else {
            setError(true);
            setLoading(false);
          }
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [imagem, getImageUrl, retries]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          {retries > 0 && (
            <span className="text-xs text-gray-500">
              Tentativa {retries}/{maxRetries}
            </span>
          )}
        </div>
      );
    }

    if (error || !url) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-100 text-gray-400">
          <ImageIcon className="h-8 w-8 mb-1" />
          <span className="text-xs text-center">Sem imagem</span>
        </div>
      );
    }

    return (
      <img
        src={url}
        alt={`Nota Fiscal ${index + 1}`}
        className="w-full h-full object-contain"
        onError={() => {
          setError(true);
          setUrl('');
        }}
      />
    );
  };

  return (
    <div className="w-full h-full">
      {renderContent()}
    </div>
  );
};

const DemandaObra: React.FC<DemandaObraProps> = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const demandaService = DemandaService.getInstance();
  const imageCacheService = ImageCacheService.getInstance();
  
  const [loading, setLoading] = useState(true);
  const [obraNome, setObraNome] = useState('');
  const [itens, setItens] = useState<DemandaItem[]>([]);
  const [showAdicionarDialog, setShowAdicionarDialog] = useState(false);
  const [showEditarDialog, setShowEditarDialog] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<DemandaItem | null>(null);
  const [showMoverParaPedidoDialog, setShowMoverParaPedidoDialog] = useState(false);
  const [showMoverParaEntregueDialog, setShowMoverParaEntregueDialog] = useState(false);
  const [showNotaFiscal, setShowNotaFiscal] = useState(false);
  const [notaFiscalUrl, setNotaFiscalUrl] = useState('');
  const [showMoverParaPagoDialog, setShowMoverParaPagoDialog] = useState(false);
  const [showExcluirDialog, setShowExcluirDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DemandaItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showRelatoriosDialog, setShowRelatoriosDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImagemDialog, setShowImagemDialog] = useState(false);
  const [imagemUrl, setImagemUrl] = useState<string[]>([]);
  const [itemParaEditar, setItemParaEditar] = useState<DemandaItem | null>(null);
  const notificationService = NotificationService.getInstance();
  const [imageUrls, setImageUrls] = useState<ImageUrlsState>({});

  useEffect(() => {
    console.log('[DEBUG] DemandaObra - useEffect iniciado');
    console.log('[DEBUG] DemandaObra - ID recebido:', id);
    
    if (!id || isNaN(Number(id))) {
      console.log('[DEBUG] DemandaObra - ID inválido');
      toast.error('ID da obra inválido');
      navigate('/obras');
      return;
    }
    
    console.log('[DEBUG] DemandaObra - Iniciando carregamento de dados');
    carregarDados();
  }, [id, navigate]);

  const carregarDados = async () => {
    console.log('[DEBUG] DemandaObra - carregarDados iniciado');
    try {
      setLoading(true);
      console.log('[DEBUG] DemandaObra - Chamando demandaService.carregarDemandas');
      const { items, obraNome: nome } = await demandaService.carregarDemandas(Number(id));
      console.log('[DEBUG] DemandaObra - Dados recebidos:', { items, nome });
      setItens(items);
      setObraNome(nome);
      setLoading(false);
    } catch (error) {
      console.error('[DEBUG] DemandaObra - Erro ao carregar dados:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao carregar dados da demanda');
      }
      setItens([]);
      setLoading(false);
    }
  };

  const handleMoverParaEntregue = async (item: DemandaItem) => {
    try {
      setItemSelecionado(item);
      setShowMoverParaEntregueDialog(true);
    } catch (error) {
      console.error('Erro ao mover item para entregue:', error);
      toast.error('Erro ao mover item para entregue');
    }
  };

  const handleConfirmMoverParaEntregue = async () => {
    if (!itemSelecionado) return;
    
    try {
      await demandaService.atualizarStatus(itemSelecionado, 'entregue');
      await carregarDados();
      setShowMoverParaEntregueDialog(false);
    } catch (error) {
      console.error('Erro ao confirmar movimentação:', error);
      toast.error('Erro ao mover item para entregue');
    }
  };

  const handleVisualizarImagem = async (item: DemandaItem) => {
    try {
      console.log('Visualizando imagem do item:', item);
      if (!item.nota_fiscal || !item.nota_fiscal.length) {
        toast.error('Nenhuma imagem disponível');
        return;
      }

      console.log('Notas fiscais disponíveis:', item.nota_fiscal);
      
      // Carrega todas as URLs das imagens
      const urls = await Promise.all(
        item.nota_fiscal.map(async (path) => {
          try {
            const url = await imageCacheService.getImageUrl(path);
            console.log('URL obtida para', path, ':', url);
            return url;
          } catch (error) {
            console.error('Erro ao obter URL para', path, ':', error);
            throw error;
          }
        })
      );

      setImagemUrl(urls);
      setShowImagemDialog(true);
    } catch (error) {
      console.error('Erro ao carregar imagem(ns):', error);
      toast.error('Erro ao carregar imagem(ns) da nota fiscal');
    }
  };

  const handleImagemUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!itemParaEditar) {
      toast.error('Nenhum item selecionado para edição');
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      console.log('Iniciando upload de imagem...');
      const file = files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas arquivos de imagem');
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }

      console.log('Arquivo selecionado:', file.name);
      
      const result = await demandaService.uploadImagem(file, itemParaEditar);
      console.log('Resultado do upload:', result);
      
      // Atualiza o estado local
      setItemParaEditar(prev => {
        if (!prev) return null;
        const novasImagens = [...(prev.nota_fiscal || []), result];
        return {
          ...prev,
          nota_fiscal: novasImagens
        };
      });
      
      await carregarDados();
      toast.success('Imagem adicionada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem');
    }
  };

  const handleRemoverImagem = async (item: DemandaItem, index: number) => {
    try {
      await demandaService.removerImagem(item, index);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  const handleMoverParaPago = async (item: DemandaItem) => {
    try {
      const { error } = await supabase
        .from('demanda_itens')
        .update({ status: 'pago' })
        .eq('id', item.id);

      if (error) throw error;

      await carregarDados();
      toast.success('Item movido para pago com sucesso!');
      setShowMoverParaPagoDialog(false);
    } catch (error) {
      console.error('Erro ao mover item para pago:', error);
      toast.error('Erro ao mover item para pago');
    }
  };

  const handleConfirmMoverParaPago = async () => {
    if (!selectedItem) return;
    await handleMoverParaPago(selectedItem);
  };

  const handleVoltar = async (item: DemandaItem) => {
    try {
      let novoStatus: 'demanda' | 'pedido' | 'entregue';
      
      switch (item.status) {
        case 'pedido':
          novoStatus = 'demanda';
          break;
        case 'entregue':
          novoStatus = 'pedido';
          break;
        case 'pago':
          novoStatus = 'entregue';
          break;
        default:
          return;
      }

      const { error } = await supabase
        .from('demanda_itens')
        .update({ status: novoStatus })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(`Item movido para ${novoStatus}`);
      carregarDados();
    } catch (error) {
      console.error('Erro ao mover item:', error);
      toast.error('Erro ao mover item');
    }
  };

  const handleExcluir = async (item: DemandaItem) => {
    setSelectedItem(item);
    setShowExcluirDialog(true);
  };

  const handleEditarItemLista = async (item: DemandaItem) => {
    try {
      // Remove o id e created_at antes de atualizar
      const { id, created_at, ...itemParaAtualizar } = item;

      // Garante que nota_fiscal seja um array
      if (itemParaAtualizar.nota_fiscal && !Array.isArray(itemParaAtualizar.nota_fiscal)) {
        itemParaAtualizar.nota_fiscal = [itemParaAtualizar.nota_fiscal];
      }

      const { error } = await supabase
        .from('demanda_itens')
        .update(itemParaAtualizar)
        .eq('id', id);

      if (error) throw error;

      setItens(itens.map(i => i.id === id ? item : i));
      toast.success('Lista atualizada com sucesso');
      setShowEditarDialog(false);
    } catch (error) {
      console.error('Erro ao atualizar lista:', error);
      toast.error('Erro ao atualizar lista');
    }
  };

  const handleExcluirItemLista = async (item: DemandaItem, index: number) => {
    try {
      const linhas = item.descricao.split('\n');
      linhas.splice(index, 1);
      const novaDescricao = linhas.join('\n');

      // Se não houver mais itens na lista, exclui o item completo
      if (linhas.length === 0) {
        const { error } = await supabase
          .from('demanda_itens')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        setItens(itens.filter(i => i.id !== item.id));
        toast.success('Item excluído com sucesso');
        return;
      }

      const itemAtualizado = {
        ...item,
        descricao: novaDescricao
      };

      const { error } = await supabase
        .from('demanda_itens')
        .update(itemAtualizado)
        .eq('id', item.id);

      if (error) throw error;

      setItens(itens.map(i => i.id === item.id ? itemAtualizado : i));
      toast.success('Item excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      toast.error('Erro ao excluir item');
    }
  };

  const handleConfirmExcluir = async () => {
    if (!selectedItem) return;
    
    try {
      setLoading(true);
      await supabase
        .from('demanda_itens')
        .delete()
        .eq('id', selectedItem.id);

      setItens(itens.filter(i => i.id !== selectedItem.id));
      toast.success('Item excluído com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir item');
    } finally {
      setLoading(false);
      setShowExcluirDialog(false);
      setSelectedItem(null);
    }
  };

  const itensPorStatus = {
    demanda: itens.filter(item => item.status === 'demanda'),
    pedido: itens.filter(item => item.status === 'pedido'),
    entregue: itens.filter(item => item.status === 'entregue'),
    pago: itens.filter(item => item.status === 'pago')
  };

  const getImageUrl = async (path: string): Promise<string> => {
    if (!path) {
      console.error('Caminho da imagem não fornecido');
      throw new Error('Caminho da imagem não fornecido');
    }
    
    // Se o path for uma string que parece um array JSON, tenta fazer o parse
    let realPath = path;
    try {
      if (typeof path === 'string' && (path.startsWith('[') || path.includes(','))) {
        const parsed = JSON.parse(path);
        realPath = Array.isArray(parsed) ? parsed[0] : path;
      }
    } catch (e) {
      console.warn('Erro ao fazer parse do caminho da imagem:', e);
    }
    
    console.log('Obtendo URL para:', realPath);
    try {
      const { data, error } = await supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(realPath);

      if (error) {
        console.error('Erro do Supabase:', error);
        throw error;
      }
      
      if (!data?.publicUrl) {
        console.error('URL pública não encontrada para:', realPath);
        throw new Error('URL pública não encontrada');
      }

      console.log('URL pública obtida:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao obter URL da imagem:', error);
      throw error;
    }
  };

  const renderNotasFiscais = async (notas: string | string[] | null | undefined) => {
    if (!notas) return '';
    
    const notasArray = Array.isArray(notas) ? notas : [notas];
    
    if (notasArray.length === 0) return '';

    const imageElements = await Promise.all(notasArray.map(async (imagem, index) => {
      const imageUrl = await getImageUrl(imagem);
      return `
        <div class="relative aspect-square rounded-lg border border-gray-200 overflow-hidden">
          <img
            src="${imageUrl}"
            alt="Nota Fiscal ${index + 1}"
            class="w-full h-full object-contain"
            onerror="this.onerror=null; this.src='https://placehold.co/400x400?text=Imagem+não+encontrada';"
          />
        </div>
      `;
    }));

    return `
      <div class="nota-fiscal">
        <div class="grid grid-cols-2 gap-4">
          ${imageElements.join('')}
        </div>
      </div>
    `;
  };

  const handleGerarRelatorio = async () => {
    try {
      const itensPagos = itens.filter(item => item.status === 'pago');
      
      if (itensPagos.length === 0) {
        toast.error('Não há itens pagos para gerar o relatório');
        return;
      }

      const valorTotal = itensPagos.reduce((total, item) => total + (item.valor || 0), 0);

      // Gerar HTML do relatório
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório de Demandas Pagas - ${obraNome}</title>
          <style>
            ${pdfStyles}
            .valor-total {
              font-size: 1.2em;
              font-weight: bold;
              color: #15803d;
              text-align: right;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #eee;
            }
            .nota-fiscal {
              margin-top: 10px;
              max-width: 100%;
              border: 1px solid #eee;
              border-radius: 4px;
              padding: 10px;
            }
            .nota-fiscal img {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
            }
            .card-description {
              font-weight: bold;
              font-size: 1.1em;
              margin: 10px 0;
              white-space: pre-line;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 10px;
              margin-top: 15px;
            }
            .info-item {
              padding: 8px;
              border: 1px solid #eee;
              border-radius: 4px;
            }
            .info-label {
              font-size: 0.8em;
              color: #666;
              margin-bottom: 2px;
            }
            .info-value {
              font-size: 0.9em;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Relatório de Demandas Pagas</h1>
              <p class="obra-info">Obra: ${obraNome}</p>
              <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
            </div>

            <div class="content">
              <div class="info-block">
                <h3>Itens Pagos</h3>
                <div class="items-container">
                  ${await Promise.all(itensPagos.map(async item => `
                    <div class="card">
                      <div class="card-title">${item.titulo}</div>
                      ${item.descricao ? `<div class="card-description">${item.descricao}</div>` : ''}
                      <div class="info-grid">
                        <div class="info-item">
                          <div class="info-label">Data do Pedido</div>
                          <div class="info-value">${format(new Date(item.data_pedido!), 'dd/MM/yyyy')}</div>
                        </div>
                        <div class="info-item">
                          <div class="info-label">Data de Entrega</div>
                          <div class="info-value">${format(new Date(item.data_entrega!), 'dd/MM/yyyy')}</div>
                        </div>
                        <div class="info-item">
                          <div class="info-label">Valor</div>
                          <div class="info-value">R$ ${item.valor?.toFixed(2)}</div>
                        </div>
                        ${item.tempo_entrega ? `
                          <div class="info-item">
                            <div class="info-label">Tempo de Entrega</div>
                            <div class="info-value">${item.tempo_entrega}</div>
                          </div>
                        ` : ''}
                      </div>
                      ${await renderNotasFiscais(item.nota_fiscal)}
                    </div>
                  `)).join('')}
                </div>
                <div class="valor-total">
                  Valor Total: R$ ${valorTotal.toFixed(2)}
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Relatório gerado em ${format(new Date(), 'dd/MM/yyyy')}</p>
              <p>${obraNome} - Todos os direitos reservados</p>
            </div>
          </div>
          <script>
            // Adiciona tratamento de erro para todas as imagens
            document.addEventListener('DOMContentLoaded', function() {
              const images = document.getElementsByTagName('img');
              for(let img of images) {
                img.onerror = function() {
                  this.onerror = null;
                  this.src = 'https://placehold.co/400x400?text=Imagem+não+encontrada';
                }
              }
            });
          </script>
        </body>
        </html>
      `;

      // Salvar o relatório no banco de dados
      const { error: saveError } = await supabase
        .from('relatorios')
        .insert({
          obra_id: Number(id),
          data_inicio: format(new Date(), 'yyyy-MM-dd'),
          data_fim: format(new Date(), 'yyyy-MM-dd'),
          tipo: 'demanda',
          conteudo: html
        });

      if (saveError) {
        console.error('Erro ao salvar relatório:', saveError);
        throw new Error('Erro ao salvar o relatório');
      }

      // Excluir os itens pagos que foram incluídos no relatório
      const idsParaExcluir = itensPagos.map(item => item.id);
      const { error: deleteError } = await supabase
        .from('demanda_itens')
        .delete()
        .in('id', idsParaExcluir);

      if (deleteError) {
        console.error('Erro ao excluir itens:', deleteError);
        throw new Error('Erro ao excluir os itens do relatório');
      }

      // Criar uma nova janela para o PDF
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        throw new Error('Não foi possível abrir uma nova janela. Verifique se o bloqueador de pop-ups está desativado.');
      }
      
      printWindow.document.write(html);
      printWindow.document.close();
      
      toast.success('Relatório gerado com sucesso! Os itens foram removidos da lista.');

      await carregarDados();

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar o relatório');
    }
  };

  const handleTirarFoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (!image.base64String) {
        throw new Error('Imagem não capturada');
      }

      const response = await fetch(`data:image/jpeg;base64,${image.base64String}`);
      const blob = await response.blob();

      const fileName = `${Date.now()}.jpeg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      if (itemParaEditar) {
        const novasImagens = [...(itemParaEditar.nota_fiscal || []), filePath];
        setItemParaEditar({
          ...itemParaEditar,
          nota_fiscal: novasImagens
        });
      }

      return filePath;
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      toast.error('Erro ao capturar imagem');
      return null;
    }
  };

  // Substituir a função renderImagemMiniatura pelo novo componente
  const renderImagemMiniatura = (imagem: string, index: number) => {
    if (!imagem) return null;
    
    return (
      <ImagemMiniatura
        key={index}
        imagem={imagem}
        index={index}
        itemSelecionado={itemSelecionado!}
        onVisualizarImagem={() => handleVisualizarImagem(itemSelecionado!)}
        getImageUrl={getImageUrl}
      />
    );
  };

  const loadImageUrlsForItem = async (item: DemandaItem) => {
    const urls: ImageUrlsState = {};
    if (Array.isArray(item.nota_fiscal)) {
      for (const path of item.nota_fiscal) {
        urls[path] = await getImageUrl(path);
      }
    }
    setImageUrls(urls);
  };

  useEffect(() => {
    if (itemParaEditar) {
      loadImageUrlsForItem(itemParaEditar);
    }
  }, [itemParaEditar?.nota_fiscal]);

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/obras/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Demanda: {obraNome}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAdicionarDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Demanda
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGerarRelatorio}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Gerar Relatório
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/obras/${id}/demanda/relatorios`)}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Ver Relatórios
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Seção Demanda */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Demanda</h2>
            <div className="flex flex-col gap-2">
              {itensPorStatus.demanda.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm relative"
                >
                  {item.titulo === 'Lista de Demanda' ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium pr-8">{item.titulo}</h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setItemParaEditar({
                                ...item,
                                nota_fiscal: item.nota_fiscal || []
                              });
                              setShowEditarDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => handleExcluir(item)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.descricao.split('\n').map((linha, index) => (
                          <p key={index} className="py-1">{linha.trim()}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDeleteDialog(true);
                        }}
                        className="absolute top-2 right-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <h3 className="font-medium pr-8">{item.titulo}</h3>
                      {item.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.descricao}
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setItemSelecionado(item);
                        setShowMoverParaPedidoDialog(true);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Pedido */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Pedido</h2>
            <div className="flex flex-col gap-2">
              {itensPorStatus.pedido.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  {item.titulo === 'Lista de Demanda' ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{item.titulo}</h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setItemParaEditar({
                                ...item,
                                nota_fiscal: item.nota_fiscal || []
                              });
                              setShowEditarDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => handleExcluir(item)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.descricao.split('\n').map((linha, index) => (
                          <p key={index} className="py-1">{linha.trim()}</p>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                        <p>Pedido em: {format(new Date(item.data_pedido!), 'dd/MM/yyyy')}</p>
                      </div>
                      <div className="flex justify-between mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoltar(item)}
                        >
                          <ArrowLeftIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setItemSelecionado(item);
                            setShowMoverParaEntregueDialog(true);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium">{item.titulo}</h3>
                      {item.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.descricao}
                        </p>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                        <p>Pedido em: {format(new Date(item.data_pedido!), 'dd/MM/yyyy')}</p>
                      </div>
                      <div className="flex justify-between mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoltar(item)}
                        >
                          <ArrowLeftIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setItemSelecionado(item);
                            setShowMoverParaEntregueDialog(true);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Seção Entregue */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Entregue</h2>
            <div className="flex flex-col gap-2">
              {itensPorStatus.entregue.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{item.titulo}</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setItemParaEditar({
                            ...item,
                            nota_fiscal: item.nota_fiscal || []
                          });
                          setShowEditarDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleExcluir(item)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  {item.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.descricao}
                    </p>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                    <p>Tempo de entrega: {item.tempo_entrega}</p>
                    {item.observacao_entrega && (
                      <p className="text-yellow-600">Obs: {item.observacao_entrega}</p>
                    )}
                    <div className="mt-2">
                      {item.nota_fiscal && Array.isArray(item.nota_fiscal) && item.nota_fiscal.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {item.nota_fiscal.map((imagem: string, index: number) => (
                            <div key={index} className="relative group">
                              <div className="relative aspect-square w-full rounded-lg border border-input overflow-hidden bg-gray-50">
                                <ImagemMiniatura
                                  imagem={imagem}
                                  index={index}
                                  itemSelecionado={item}
                                  onVisualizarImagem={() => handleVisualizarImagem(item)}
                                  getImageUrl={getImageUrl}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white"
                                    onClick={() => handleVisualizarImagem(item)}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white text-destructive"
                                    onClick={() => handleRemoverImagem(item, index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full h-16 bg-gray-100 rounded-lg">
                          <div className="flex flex-col items-center text-gray-400">
                            <ImageIcon className="h-6 w-6 mb-1" />
                            <span className="text-xs">Sem imagem</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVoltar(item)}
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowMoverParaPagoDialog(true);
                      }}
                    >
                      Mover para pago
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Pago */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Pago</h2>
            <div className="flex flex-col gap-2">
              {itensPorStatus.pago.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  <h3 className="font-medium">{item.titulo}</h3>
                  {item.descricao && (
                    item.titulo === 'Lista de Demanda' ? (
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.descricao.split('\n').map((linha, index) => (
                          <p key={index}>{linha.trim()}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.descricao}
                      </p>
                    )
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                    <p>Pago em: {format(new Date(item.data_pagamento!), 'dd/MM/yyyy')}</p>
                    {item.tempo_entrega && (
                      <p>Tempo de entrega: {item.tempo_entrega}</p>
                    )}
                    {item.nota_fiscal && Array.isArray(item.nota_fiscal) && item.nota_fiscal.map((imagem, index) => (
                      renderImagemMiniatura(imagem, index)
                    ))}
                  </div>
                  <div className="flex justify-start mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVoltar(item)}
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AdicionarDemandaDialog
        obraId={Number(id)}
        open={showAdicionarDialog}
        onOpenChange={setShowAdicionarDialog}
        onDemandaAdicionada={carregarDados}
      />

      {itemSelecionado && (
        <>
          <MoverParaPedidoDialog
            item={itemSelecionado}
            open={showMoverParaPedidoDialog}
            onOpenChange={setShowMoverParaPedidoDialog}
            onItemMovido={carregarDados}
          />

          <MoverParaEntregueDialog
            item={itemSelecionado}
            open={showMoverParaEntregueDialog}
            onOpenChange={setShowMoverParaEntregueDialog}
            onItemMovido={carregarDados}
          />
        </>
      )}

      {/* Modal de Visualização da Imagem */}
      <Dialog open={showImagemDialog} onOpenChange={setShowImagemDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
            <DialogTitle>Visualizar Nota Fiscal</DialogTitle>
            <DialogDescription>
              Visualização em tamanho completo da nota fiscal ou comprovante
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            {imagemUrl.map((url, index) => (
              <div key={index} className="w-full flex flex-col items-center">
                <div className="relative w-full bg-gray-100 rounded-lg shadow-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                  <img 
                    src={url} 
                    alt={`Nota Fiscal ${index + 1}`} 
                    className="relative z-10 w-full h-auto object-contain"
                    style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
                    onLoad={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.opacity = '1';
                      const spinner = target.parentElement?.querySelector('.animate-spin');
                      if (spinner) spinner.remove();
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'text-red-500 text-center p-4';
                      errorDiv.textContent = 'Não foi possível carregar a imagem';
                      target.parentElement?.appendChild(errorDiv);
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground mt-2">
                  Imagem {index + 1} de {imagemUrl.length}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMoverParaPagoDialog} onOpenChange={setShowMoverParaPagoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente marcar este item como pago?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMoverParaPago}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExcluirDialog} onOpenChange={setShowExcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExcluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedItem) {
                handleExcluir(selectedItem);
              }
              setShowDeleteDialog(false);
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditarDialog} onOpenChange={setShowEditarDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Lista de Demanda</DialogTitle>
            <DialogDescription>
              Faça as alterações necessárias nos itens da lista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="itens" className="text-sm font-medium">
                Itens da lista (um por linha):
              </label>
              <textarea
                id="itens"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Digite os itens da lista..."
                defaultValue={itemParaEditar?.descricao || ''}
                rows={5}
              />
            </div>
            {(itemParaEditar?.status === 'pedido' || itemParaEditar?.status === 'entregue') && (
              <div className="flex flex-col gap-2">
                <label htmlFor="valor" className="text-sm font-medium">
                  Valor (R$):
                </label>
                <input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="0,00"
                  defaultValue={itemParaEditar?.valor || ''}
                />
              </div>
            )}
            {itemParaEditar?.status === 'entregue' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Notas Fiscais / Comprovantes
                  </label>
                  {itemParaEditar.nota_fiscal && itemParaEditar.nota_fiscal.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {itemParaEditar.nota_fiscal.map((imagem: string, index: number) => (
                        <div key={index} className="relative group">
                          <div className="relative aspect-square w-full rounded-lg border border-input overflow-hidden bg-gray-50">
                            <ImagemMiniatura
                              imagem={imagem}
                              index={index}
                              itemSelecionado={itemParaEditar}
                              onVisualizarImagem={() => handleVisualizarImagem(itemParaEditar)}
                              getImageUrl={getImageUrl}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-white/80 hover:bg-white"
                                onClick={() => handleVisualizarImagem(itemParaEditar)}
                              >
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-white/80 hover:bg-white text-destructive"
                                onClick={() => handleRemoverImagem(itemParaEditar, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mb-2">
                      Nenhuma imagem anexada
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTirarFoto}
                    >
                      <CameraIcon className="h-4 w-4 mr-2" />
                      Tirar Foto
                    </Button>
                    <div className="relative">
                      <input
                        type="file"
                        id="upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImagemUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('upload')?.click()}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditarDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (itemParaEditar) {
                const textarea = document.getElementById('itens') as HTMLTextAreaElement;
                const valorInput = document.getElementById('valor') as HTMLInputElement;
                
                const itemAtualizado = {
                  ...itemParaEditar,
                  descricao: textarea.value,
                  valor: valorInput && valorInput.value ? parseFloat(valorInput.value) : itemParaEditar.valor
                };
                
                handleEditarItemLista(itemAtualizado);
              }
            }}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DemandaObra; 