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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Device } from '@capacitor/device';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [showConfirmarRelatorioDialog, setShowConfirmarRelatorioDialog] = useState(false);
  const [incluirDatasRelatorio, setIncluirDatasRelatorio] = useState(true);
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
      const { data } = await supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(realPath);

      if (!data?.publicUrl) {
        console.error('URL pública não encontrada ou inválida para:', realPath);
        throw new Error('URL pública não encontrada ou inválida');
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
      try {
        const imageUrl = await getImageUrl(imagem);
        return `
          <div class="relative aspect-square rounded-lg border border-gray-200 overflow-hidden">
            <img
              src="${imageUrl}"
              alt="Nota Fiscal ${index + 1}"
              class="w-full h-full object-contain"
              onerror="this.onerror=null; this.src='https://placehold.co/400x400?text=Erro+Imagem';"
            />
          </div>
        `;
      } catch (error) {
        console.error(`Erro ao renderizar imagem ${index}:`, error);
        return `
          <div class="relative aspect-square rounded-lg border border-red-200 overflow-hidden flex items-center justify-center bg-gray-100">
            <span class="text-xs text-red-500 text-center">Erro ao carregar imagem ${index + 1}</span>
          </div>
        `;
      }
    }));

    return `
      <div class="nota-fiscal">
        <div class="grid grid-cols-2 gap-4">
          ${imageElements.join('')}
        </div>
      </div>
    `;
  };

  const executarGeracaoRelatorio = async () => {
    try {
      const itensPagos = itens.filter(item => item.status === 'pago');
      
      if (itensPagos.length === 0) {
        toast.error('Não há itens pagos para gerar o relatório');
        return;
      }

      const valorTotal = itensPagos.reduce((total, item) => total + (item.valor || 0), 0);

      const itensHtml = await Promise.all(itensPagos.map(async item => {
        const notasFiscaisHtml = await renderNotasFiscais(item.nota_fiscal);
        const valorStr = item.valor ? `R$ ${item.valor.toFixed(2)}` : 'N/A';
        
        // Formatação condicional das datas e tempo
        const dataPedidoHtml = incluirDatasRelatorio && item.data_pedido ? `
          <div class="info-item">
            <div class="info-label">Data do Pedido</div>
            <div class="info-value">${format(new Date(item.data_pedido), 'dd/MM/yyyy')}</div>
          </div>` : '';
        const dataEntregaHtml = incluirDatasRelatorio && item.data_entrega ? `
          <div class="info-item">
            <div class="info-label">Data de Entrega</div>
            <div class="info-value">${format(new Date(item.data_entrega), 'dd/MM/yyyy')}</div>
          </div>` : '';
        const tempoEntregaHtml = incluirDatasRelatorio && item.tempo_entrega ? `
          <div class="info-item">
            <div class="info-label">Tempo de Entrega</div>
            <div class="info-value">${item.tempo_entrega}</div>
          </div>` : '';

        return `
          <div class="card">
            <div class="card-title">${item.titulo}</div>
            ${item.descricao ? `<div class="card-description">${item.descricao.replace(/\n/g, '<br>')}</div>` : ''} 
            <div class="info-grid">
              ${dataPedidoHtml}
              ${dataEntregaHtml}
              <div class="info-item">
                <div class="info-label">Valor</div>
                <div class="info-value">${valorStr}</div>
              </div>
              ${tempoEntregaHtml}
            </div>
            ${notasFiscaisHtml}
          </div>
        `;
      }));

      const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório de Demandas - ${obraNome}</title>
          <style>
            ${pdfStyles}
            body { font-family: sans-serif; }
            .container { padding: 20px; max-width: 800px; margin: auto; }
            .header, .footer { text-align: center; margin-bottom: 20px; }
            .header h1 { margin-bottom: 5px; }
            .header p { margin: 2px 0; font-size: 0.9em; color: #555; }
            .content { border-top: 1px solid #eee; padding-top: 20px; }
            .info-block h3 { border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fff; page-break-inside: avoid; }
            .card-title { font-size: 1.1em; font-weight: bold; margin-bottom: 10px; }
            .card-description { font-size: 0.9em; margin-bottom: 10px; white-space: pre-wrap; word-wrap: break-word; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px; font-size: 0.9em; }
            .info-item { background-color: #f9f9f9; padding: 8px; border-radius: 4px; }
            .info-label { font-size: 0.8em; color: #666; margin-bottom: 2px; }
            .nota-fiscal { margin-top: 10px; border-top: 1px dashed #eee; padding-top: 10px; }
            .nota-fiscal .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; }
            .nota-fiscal img { max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #eee; display: block; }
            .valor-total { font-size: 1.2em; font-weight: bold; color: #15803d; text-align: right; margin-top: 20px; padding-top: 10px; border-top: 2px solid #eee; }
            .footer p { font-size: 0.8em; color: #777; }
          </style>
        </head>
        <body>
          <div class="container" id="pdf-content">
            <div class="header">
              <h1>Relatório de Demandas</h1>
              <p class="obra-info">Obra: ${obraNome}</p>
              <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
            </div>

            <div class="content">
              <div class="info-block">
                <div class="items-container">
                  ${itensHtml.join('')}
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
        </body>
        </html>
      `;

      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        console.log('Gerando PDF para plataforma móvel...');

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '800px';
        container.innerHTML = htmlCompleto;
        document.body.appendChild(container);

        const contentToCapture = container.querySelector('#pdf-content') as HTMLElement;
        if (!contentToCapture) {
          throw new Error('Elemento #pdf-content não encontrado para captura.');
        }

        try {
          const canvas = await html2canvas(contentToCapture, {
             scale: 2,
             useCORS: true,
             logging: true
          });

          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgData = canvas.toDataURL('image/png');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const ratio = canvasHeight / canvasWidth;
          const imgHeight = pdfWidth * ratio;
          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;

          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
          }

          const pdfBase64 = pdf.output('datauristring').split(',')[1];

          const fileName = `relatorio_${obraNome.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
          console.log('Salvando arquivo:', fileName);

          const result = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
          });
          console.log('Arquivo salvo em:', result.uri);

          await Share.share({
            title: `Relatório de Demandas - ${obraNome}`,
            text: `Segue o relatório de demandas da obra ${obraNome}.`,
            url: result.uri,
            dialogTitle: 'Compartilhar Relatório',
          });

          console.log('Compartilhamento iniciado.');

        } catch (shareError) {
           console.error('Erro ao gerar ou compartilhar PDF no mobile:', shareError);
           toast.error('Erro ao compartilhar o relatório PDF.');
        } finally {
           if (document.body.contains(container)) {
              document.body.removeChild(container);
           }
        }

      } else {
        console.log('Gerando PDF para plataforma web...');
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.warning('Não foi possível abrir a janela de visualização. Verifique o bloqueador de pop-ups.');
        } else {
          printWindow.document.write(htmlCompleto);
          printWindow.document.close();
          printWindow.focus();
        }
      }

      const { error: saveError } = await supabase
        .from('relatorios')
        .insert({
           obra_id: Number(id),
           data_inicio: format(new Date(), 'yyyy-MM-dd'),
           data_fim: format(new Date(), 'yyyy-MM-dd'),
           tipo: 'demanda',
           conteudo: htmlCompleto
         });
      if (saveError) {
         console.error('Erro ao salvar relatório:', saveError);
         throw new Error(`Erro ao salvar o relatório: ${saveError.message}`);
      }

      const idsParaExcluir = itensPagos.map(item => item.id);
      const { error: deleteError } = await supabase
        .from('demanda_itens')
        .delete()
        .in('id', idsParaExcluir);
      if (deleteError) {
         console.error('Erro ao excluir itens:', deleteError);
         toast.error(`Relatório salvo/compartilhado, mas erro ao excluir itens: ${deleteError.message}`);
      } else {
         toast.success('Relatório gerado/compartilhado e itens pagos removidos com sucesso!');
      }

      await carregarDados();

    } catch (error) {
      console.error('Erro geral ao gerar relatório:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao gerar o relatório: ${errorMessage}`);
    }
  };

  const handleGerarRelatorio = () => {
    const itensPagos = itens.filter(item => item.status === 'pago');
    if (itensPagos.length === 0) {
      toast.error('Não há itens pagos para gerar o relatório');
      return;
    }
    setShowConfirmarRelatorioDialog(true);
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

      if (!itemParaEditar) {
        toast.error("Erro interno: Item para editar não está definido.");
        return null;
      }

      // Usa o serviço de demanda para upload
      const filePath = await demandaService.uploadImagem(blob as File, itemParaEditar); // Passa apenas 2 argumentos

      // Atualiza o estado local imediatamente para feedback visual
      setItemParaEditar(prev => {
        if (!prev) return null;
        const novasImagens = [...(prev.nota_fiscal || []), filePath];
        return { ...prev, nota_fiscal: novasImagens };
      });

      await carregarDados(); // Recarrega para garantir consistência, se necessário
      toast.success('Foto adicionada com sucesso!');

      return filePath;
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao capturar e salvar imagem: ${msg}`);
      return null;
    }
  };

  // Substituir a função renderImagemMiniatura pelo novo componente
  const renderImagemMiniatura = (imagem: string, index: number, item: DemandaItem) => {
    if (!imagem) return null;
    
    return (
      <ImagemMiniatura
        key={`${item.id}-${index}`}
        imagem={imagem}
        index={index}
        itemSelecionado={item} // Passa o item correto
        onVisualizarImagem={() => handleVisualizarImagem(item)} // Passa o item correto
        getImageUrl={getImageUrl}
      />
    );
  };

  const loadImageUrlsForItem = async (item: DemandaItem) => {
    const urls: ImageUrlsState = {};
    if (Array.isArray(item.nota_fiscal)) {
      for (const path of item.nota_fiscal) {
        if (path && !imageUrls[path]) { // Carrega apenas se não tiver URL cacheada
          try {
            urls[path] = await getImageUrl(path);
          } catch (error) {
            console.error(`Falha ao carregar URL para ${path}:`, error);
            urls[path] = ''; // Define como vazia em caso de erro para evitar recargas
          }
        }
      }
    }
    // Atualiza o estado de forma imutável
    setImageUrls(prevUrls => ({ ...prevUrls, ...urls }));
  };

  // Otimização: Carregar URLs apenas quando o itemParaEditar muda ou quando itens são carregados
  useEffect(() => {
    if (itemParaEditar && itemParaEditar.nota_fiscal) {
      loadImageUrlsForItem(itemParaEditar);
    }
  }, [itemParaEditar]);

  useEffect(() => {
    itens.forEach(item => {
      if(item.nota_fiscal) {
         loadImageUrlsForItem(item);
      }
    });
  }, [itens]); // Dependência nos itens carregados

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-shrink-0 mr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/obras/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">Demanda: {obraNome}</h1>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAdicionarDialog(true)}
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <Plus className="h-4 w-4" />
              <span className="xs:inline">Nova Demanda</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGerarRelatorio} 
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <FileText className="h-4 w-4" />
              <span className="xs:inline">Gerar Relatório</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/obras/${id}/demanda/relatorios`)}
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="xs:inline">Ver Relatórios</span>
            </Button>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-end">
            <Checkbox 
              id="incluir-datas" 
              checked={incluirDatasRelatorio}
              onCheckedChange={(checked) => setIncluirDatasRelatorio(Boolean(checked))}
            />
            <Label htmlFor="incluir-datas" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Adicionar datas
            </Label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(itensPorStatus).map(([status, items]) => (
            <div key={status} className="bg-card rounded-lg shadow p-4 min-h-[200px] flex flex-col">
              <h2 className="text-lg font-semibold mb-4 capitalize flex-shrink-0">{status}</h2>
              <div className="flex flex-col gap-3 overflow-y-auto flex-grow">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-background p-3 rounded-md shadow-sm relative flex flex-col flex-shrink-0"
                  >
                    {status !== 'pago' && (
                      <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
                        {status !== 'demanda' || item.titulo === 'Lista de Demanda' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setItemParaEditar({ ...item, nota_fiscal: item.nota_fiscal || [] });
                              setShowEditarDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleExcluir(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex-grow pr-12">
                      <h3 className="font-medium break-words">{item.titulo}</h3>
                      {item.descricao && (
                        item.titulo === 'Lista de Demanda' ? (
                          <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                            {item.descricao.split('\n').map((linha, index) => (
                              <p key={index} className="py-1 break-words">{linha.trim()}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {item.descricao}
                          </p>
                        )
                      )}
                      <div className="text-sm text-muted-foreground mt-1">
                        { (status === 'pedido' || status === 'entregue' || status === 'pago') && item.valor && <p>Valor: R$ {item.valor.toFixed(2)}</p> }
                        { status === 'pedido' && item.data_pedido && <p>Pedido em: {format(new Date(item.data_pedido), 'dd/MM/yyyy')}</p> }
                        { status === 'entregue' && item.data_entrega && <p>Entregue em: {format(new Date(item.data_entrega), 'dd/MM/yyyy')}</p> }
                        { status === 'entregue' && item.tempo_entrega && <p>Tempo: {item.tempo_entrega}</p> }
                        { status === 'entregue' && item.observacao_entrega && <p className="text-yellow-600">Obs: {item.observacao_entrega}</p> }
                        { status === 'pago' && item.data_pagamento && <p>Pago em: {format(new Date(item.data_pagamento), 'dd/MM/yyyy')}</p> }
                      </div>
                      {(status === 'entregue' || status === 'pago') && item.nota_fiscal && item.nota_fiscal.length > 0 && (
                        <div className="mt-2">
                          <div className="grid grid-cols-3 gap-2">
                            {item.nota_fiscal.map((imagem: string, index: number) => (
                              <div key={`${item.id}-${status}-img-${index}`} className="relative group aspect-square">
                                <div className="relative w-full h-full rounded-lg border border-input overflow-hidden bg-gray-50">
                                  {renderImagemMiniatura(imagem, index, item)}
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 bg-white/80 hover:bg-white text-primary rounded-full"
                                      onClick={() => handleVisualizarImagem(item)}
                                      title="Visualizar"
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
                                    {status === 'entregue' && item.titulo !== 'Lista de Demanda' && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 bg-white/80 hover:bg-white text-destructive rounded-full"
                                        onClick={() => handleRemoverImagem(item, index)}
                                        title="Remover Imagem"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(status === 'entregue' || status === 'pago') && (!item.nota_fiscal || item.nota_fiscal.length === 0) && (
                         <div className="flex items-center justify-center w-full h-16 bg-gray-100 rounded-lg text-xs text-gray-400 mt-2">
                           Sem imagem
                        </div>
                      )}
                    </div>
                    {/* Botões de Navegação (Inferior) - Reestruturados */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-border flex-shrink-0">
                      {/* Botão Voltar (Esquerda) */}
                      <div>
                        {status !== 'demanda' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVoltar(item)}
                            className="px-2"
                            title="Voltar"
                          >
                            <ArrowLeftIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Botão Avançar (Direita) */}
                      <div>
                        {status === 'demanda' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setItemSelecionado(item); setShowMoverParaPedidoDialog(true); }}
                            className="px-2" 
                            title="Mover para Pedido"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {status === 'pedido' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setItemSelecionado(item); setShowMoverParaEntregueDialog(true); }}
                            className="px-2"
                            title="Mover para Entregue"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {status === 'entregue' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => { setSelectedItem(item); setShowMoverParaPagoDialog(true); }}
                            className="px-3 flex items-center gap-1" 
                            title="Mover para Pago"
                          >
                            <span className="hidden xs:inline">Pago</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p>
                )}
              </div>
            </div>
          ))}
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

      <Dialog open={showEditarDialog} onOpenChange={(open) => { if (!open) setItemParaEditar(null); setShowEditarDialog(open); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>
              {itemParaEditar?.titulo === 'Lista de Demanda' 
                ? 'Faça as alterações necessárias nos itens da lista.' 
                : 'Edite os detalhes do item.'}
            </DialogDescription>
          </DialogHeader>
          {itemParaEditar && (
            <div className="grid gap-4 py-4">
              {itemParaEditar.titulo !== 'Lista de Demanda' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="edit-titulo" className="text-sm font-medium">
                    Título:
                  </label>
                  <input
                    id="edit-titulo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={itemParaEditar.titulo}
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-descricao" className="text-sm font-medium">
                  {itemParaEditar.titulo === 'Lista de Demanda' ? 'Itens da lista (um por linha):' : 'Descrição:'}
                </label>
                <textarea
                  id="edit-descricao"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={itemParaEditar.titulo === 'Lista de Demanda' ? 'Digite os itens...' : 'Digite a descrição...'}
                  defaultValue={itemParaEditar.descricao || ''}
                  rows={itemParaEditar.titulo === 'Lista de Demanda' ? 5 : 3} 
                />
              </div>
              {(itemParaEditar.status === 'pedido' || itemParaEditar.status === 'entregue') && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="edit-valor" className="text-sm font-medium">
                    Valor (R$):
                  </label>
                  <input
                    id="edit-valor"
                    type="number"
                    step="0.01"
                    min="0"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="0,00"
                    defaultValue={itemParaEditar.valor || ''}
                  />
                </div>
              )}
              {/* Reinserir seção de Notas Fiscais para status 'entregue' */}
              {itemParaEditar.status === 'entregue' && (
                <div className="flex flex-col gap-4 pt-4 border-t border-border">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">
                      Notas Fiscais / Comprovantes
                    </label>
                    {itemParaEditar.nota_fiscal && itemParaEditar.nota_fiscal.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {itemParaEditar.nota_fiscal.map((imagem: string, index: number) => (
                          <div key={`${itemParaEditar.id}-edit-img-${index}`} className="relative group aspect-square">
                            <div className="relative w-full h-full rounded-lg border border-input overflow-hidden bg-gray-50">
                              {renderImagemMiniatura(imagem, index, itemParaEditar)}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 bg-white/80 hover:bg-white text-primary rounded-full"
                                  onClick={() => handleVisualizarImagem(itemParaEditar)}
                                  title="Visualizar"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 bg-white/80 hover:bg-white text-destructive rounded-full"
                                  onClick={() => handleRemoverImagem(itemParaEditar, index)}
                                  title="Remover Imagem"
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
                    <div className="flex gap-2 flex-wrap"> {/* Adicionado flex-wrap */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm" /* Tamanho consistente */
                        onClick={handleTirarFoto}
                      >
                        <CameraIcon className="h-4 w-4 mr-2" />
                        Tirar Foto
                      </Button>
                      <div className="relative">
                        <input
                          type="file"
                          id="upload-edit"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImagemUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm" /* Tamanho consistente */
                          onClick={() => document.getElementById('upload-edit')?.click()}
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditarDialog(false); setItemParaEditar(null); }}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (itemParaEditar) {
                const tituloInput = document.getElementById('edit-titulo') as HTMLInputElement;
                const descricaoTextarea = document.getElementById('edit-descricao') as HTMLTextAreaElement;
                const valorInput = document.getElementById('edit-valor') as HTMLInputElement;
                
                const itemAtualizado = {
                  ...itemParaEditar,
                  titulo: tituloInput ? tituloInput.value : itemParaEditar.titulo, 
                  descricao: descricaoTextarea.value,
                  valor: valorInput ? parseFloat(valorInput.value) : itemParaEditar.valor 
                };
                
                handleEditarItemLista(itemAtualizado);
                setItemParaEditar(null); 
              }
            }}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmarRelatorioDialog} onOpenChange={setShowConfirmarRelatorioDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Geração de Relatório</AlertDialogTitle>
            <AlertDialogDescription>
              Ao gerar o relatório, todos os itens atualmente na coluna "Pago" serão incluídos e 
              <strong className="text-destructive">removidos permanentemente</strong> desta lista. 
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmarRelatorioDialog(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowConfirmarRelatorioDialog(false);
                await executarGeracaoRelatorio();
              }}
            >
              Confirmar e Gerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default DemandaObra; 