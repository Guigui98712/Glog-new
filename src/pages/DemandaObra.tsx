import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, ArrowRight, ArrowLeft as ArrowLeftIcon, X, Image as ImageIcon, FileText, FolderOpen, Trash2, Pencil, Camera as CameraIcon, Share as ShareIcon, FileSpreadsheet, Check, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaCategoria, DemandaItem } from '@/types/demanda';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Device } from '@capacitor/device';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';

interface ImageUrlsState {
  [key: string]: string;
}

interface DemandaCategoriaRow {
  id: number;
  obra_id: number;
  nome: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

const MARCADOR_RELATORIO_MENSAL = 'DEMANDA_MENSAL_EXCEL';
const CATEGORIA_VAZIA = '__sem_categoria__';
const CATEGORIA_SEM_NOME = 'Sem categoria';

const obterNomeCategoria = (categoria?: string | null) => {
  const nome = (categoria || '').trim();
  return nome || CATEGORIA_SEM_NOME;
};

const agruparItensPorCategoria = <T extends { categoria?: string | null; valor?: number | null }>(lista: T[]) => {
  const grupos = new Map<string, T[]>();

  lista.forEach((item) => {
    const categoria = obterNomeCategoria(item.categoria);
    const grupoAtual = grupos.get(categoria) || [];
    grupoAtual.push(item);
    grupos.set(categoria, grupoAtual);
  });

  return Array.from(grupos.entries())
    .map(([categoria, itens]) => ({
      categoria,
      itens,
      total: itens.reduce((acc, item) => acc + Number(item.valor ?? 0), 0),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
};

interface HistoricoPagoItem {
  id: number;
  obra_id: number;
  demanda_item_id: number | null;
  titulo: string;
  categoria: string | null;
  descricao: string | null;
  valor: number | null;
  data_pedido: string | null;
  data_entrega: string | null;
  data_pagamento: string | null;
  tempo_entrega: string | null;
  observacao_entrega: string | null;
  nota_fiscal: string[] | null;
  origem: string;
  entrou_em_pago_em: string;
  created_at: string;
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

const DemandaObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const demandaService = DemandaService.getInstance();
  const imageCacheService = ImageCacheService.getInstance();
  
  const [loading, setLoading] = useState(true);
  const [obraNome, setObraNome] = useState('');
  const [itens, setItens] = useState<DemandaItem[]>([]);
  const [categorias, setCategorias] = useState<DemandaCategoria[]>([]);
  const [showAdicionarDialog, setShowAdicionarDialog] = useState(false);
  const [showEditarDialog, setShowEditarDialog] = useState(false);
  const [showGerenciarCategorias, setShowGerenciarCategorias] = useState(false);
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
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editandoCategoria, setEditandoCategoria] = useState<{ id: number; nome: string } | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editCategoria, setEditCategoria] = useState(CATEGORIA_VAZIA);
  const [showConfirmarRelatorioDialog, setShowConfirmarRelatorioDialog] = useState(false);
  const [incluirDatasRelatorio, setIncluirDatasRelatorio] = useState(false);
  const notificationService = NotificationService.getInstance();
  const [imageUrls, setImageUrls] = useState<ImageUrlsState>({});

  const categoriasAtivas = categorias
    .filter((categoria) => categoria.ativo)
    .map((categoria) => categoria.nome)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const categoriasEdicao = Array.from(
    new Map(
      [...categoriasAtivas, itemParaEditar?.categoria || '']
        .map((nome) => nome.trim())
        .filter(Boolean)
        .map((nome) => [nome.toLowerCase(), nome])
    ).values()
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  useEffect(() => {
    if (!showEditarDialog || !itemParaEditar) {
      return;
    }

    setEditTitulo(itemParaEditar.titulo || '');
    setEditDescricao(itemParaEditar.descricao || '');
    setEditValor(itemParaEditar.valor !== undefined && itemParaEditar.valor !== null ? String(itemParaEditar.valor) : '');
    setEditCategoria(itemParaEditar.categoria?.trim() || CATEGORIA_VAZIA);
  }, [itemParaEditar, showEditarDialog]);

  const carregarCategorias = useCallback(async () => {
    if (!id || isNaN(Number(id))) {
      return;
    }

    const { data, error } = await supabase
      .from('demanda_categorias')
      .select('id, obra_id, nome, ativo, created_at, updated_at')
      .eq('obra_id', Number(id))
      .order('nome', { ascending: true });

    if (error) {
      console.error('[DEBUG] DemandaObra - Erro ao carregar categorias:', error);
      throw error;
    }

    setCategorias(
      (data as DemandaCategoriaRow[] | null || []).map((categoria) => ({
        id: categoria.id,
        obra_id: categoria.obra_id,
        nome: categoria.nome,
        ativo: categoria.ativo !== false,
        created_at: categoria.created_at,
        updated_at: categoria.updated_at,
      }))
    );
  }, [id]);

  const carregarDados = useCallback(async () => {
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
  }, [demandaService, id]);

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
    const carregarPaginaInicial = async () => {
      await carregarDados();

      try {
        await carregarCategorias();
      } catch (error) {
        console.error('[DEBUG] DemandaObra - Falha ao carregar categorias:', error);
        setCategorias([]);
      }
    };

    void carregarPaginaInicial();
  }, [carregarCategorias, carregarDados, id, navigate]);

  const handleAdicionarCategoria = async () => {
    const nome = novaCategoria.trim();

    if (!nome || !id) {
      return;
    }

    const categoriaAtiva = categorias.find(
      (categoria) => categoria.ativo && categoria.nome.toLowerCase() === nome.toLowerCase()
    );
    if (categoriaAtiva) {
      toast.error('Categoria já cadastrada');
      return;
    }

    const categoriaInativa = categorias.find(
      (categoria) => !categoria.ativo && categoria.nome.toLowerCase() === nome.toLowerCase()
    );

    if (categoriaInativa) {
      const { data, error } = await supabase
        .from('demanda_categorias')
        .update({ nome, ativo: true })
        .eq('id', categoriaInativa.id)
        .eq('obra_id', Number(id))
        .select('id, obra_id, nome, ativo, created_at, updated_at')
        .single();

      if (error || !data) {
        toast.error('Erro ao reativar categoria');
        return;
      }

      setCategorias((prev) =>
        prev.map((categoria) =>
          categoria.id === data.id
            ? {
                id: data.id,
                obra_id: data.obra_id,
                nome: data.nome,
                ativo: data.ativo !== false,
                created_at: data.created_at,
                updated_at: data.updated_at,
              }
            : categoria
        )
      );
      setNovaCategoria('');
      return;
    }

    const { data, error } = await supabase
      .from('demanda_categorias')
      .insert({ obra_id: Number(id), nome, ativo: true })
      .select('id, obra_id, nome, ativo, created_at, updated_at')
      .single();

    if (error || !data) {
      toast.error('Erro ao salvar categoria');
      return;
    }

    setCategorias((prev) => [
      ...prev,
      {
        id: data.id,
        obra_id: data.obra_id,
        nome: data.nome,
        ativo: data.ativo !== false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    ]);
    setNovaCategoria('');
  };

  const handleExcluirCategoria = async (categoriaId: number) => {
    if (!id) {
      return;
    }

    const { error } = await supabase
      .from('demanda_categorias')
      .update({ ativo: false })
      .eq('id', categoriaId)
      .eq('obra_id', Number(id));

    if (error) {
      toast.error('Erro ao remover categoria');
      return;
    }

    setCategorias((prev) => prev.map((categoria) => (
      categoria.id === categoriaId ? { ...categoria, ativo: false } : categoria
    )));
  };

  const handleReativarCategoria = async (categoriaId: number) => {
    if (!id) {
      return;
    }

    const { data, error } = await supabase
      .from('demanda_categorias')
      .update({ ativo: true })
      .eq('id', categoriaId)
      .eq('obra_id', Number(id))
      .select('id, obra_id, nome, ativo, created_at, updated_at')
      .single();

    if (error || !data) {
      toast.error('Erro ao reativar categoria');
      return;
    }

    setCategorias((prev) => prev.map((categoria) => (
      categoria.id === data.id
        ? {
            id: data.id,
            obra_id: data.obra_id,
            nome: data.nome,
            ativo: data.ativo !== false,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
        : categoria
    )));
  };

  const handleSalvarEdicaoCategoria = async () => {
    if (!editandoCategoria || !id) {
      return;
    }

    const nome = editandoCategoria.nome.trim();
    if (!nome) {
      return;
    }

    const jaExiste = categorias.some(
      (categoria) => categoria.id !== editandoCategoria.id && categoria.ativo && categoria.nome.toLowerCase() === nome.toLowerCase()
    );
    if (jaExiste) {
      toast.error('Já existe uma categoria com esse nome');
      return;
    }

    const { data, error } = await supabase
      .from('demanda_categorias')
      .update({ nome })
      .eq('id', editandoCategoria.id)
      .eq('obra_id', Number(id))
      .select('id, obra_id, nome, ativo, created_at, updated_at')
      .single();

    if (error || !data) {
      toast.error('Erro ao editar categoria');
      return;
    }

    setCategorias((prev) => prev.map((categoria) => (
      categoria.id === data.id
        ? {
            id: data.id,
            obra_id: data.obra_id,
            nome: data.nome,
            ativo: data.ativo !== false,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
        : categoria
    )));
    setEditandoCategoria(null);
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

  const compartilharViaWhatsApp = async (item: DemandaItem) => {
    try {
      // Formatar a mensagem para WhatsApp
      const itensFormatados = item.descricao?.split('\n').filter(item => item.trim()).map(item => `• ${item.trim()}`).join('\n') || '';
      
      const mensagem = `🏗️ *Demanda Atualizada*

📋 *Obra:* ${obraNome}
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}
⏰ *Hora:* ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
📊 *Status:* ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}

📝 *Itens da Demanda:*
${itensFormatados}

${item.valor ? `💰 *Valor:* R$ ${item.valor.toFixed(2)}` : ''}

---
Enviado via GLog App`;

      // Detectar plataforma
      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        // No mobile, usar o Share API do Capacitor
        await Share.share({
          title: 'Demanda Atualizada',
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

  const itensPorStatus = {
    demanda: itens.filter(item => item.status === 'demanda'),
    pedido: itens.filter(item => item.status === 'pedido'),
    entregue: itens.filter(item => item.status === 'entregue'),
    pago: itens.filter(item => item.status === 'pago')
  };

  const getImageUrl = useCallback(async (path: string): Promise<string> => {
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
  }, []);

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

  const converterArrayBufferParaBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  };

  const carregarUltimaGeracaoMensal = async () => {
    if (!id) {
      return null;
    }

    const { data, error } = await supabase
      .from('relatorios')
      .select('created_at')
      .eq('obra_id', Number(id))
      .eq('tipo', 'demanda')
      .ilike('conteudo', `%${MARCADOR_RELATORIO_MENSAL}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erro ao buscar último relatório mensal:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return new Date(data[0].created_at);
  };

  const obterDataValida = (valor?: string) => {
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  };

  const registrarHistoricoPagoItens = async (itensParaHistorico: DemandaItem[], origem: 'movido_para_pago' | 'gerado_relatorio_pdf') => {
    if (!id || itensParaHistorico.length === 0) {
      return;
    }

    const payload = itensParaHistorico.map((item) => {
      const dataPagamento = item.data_pagamento || new Date().toISOString();
      return {
        obra_id: Number(id),
        demanda_item_id: item.id,
        titulo: item.titulo,
        categoria: item.categoria || null,
        descricao: item.descricao || null,
        valor: item.valor ?? null,
        data_pedido: item.data_pedido || null,
        data_entrega: item.data_entrega || null,
        data_pagamento: dataPagamento,
        tempo_entrega: item.tempo_entrega || null,
        observacao_entrega: item.observacao_entrega || null,
        nota_fiscal: Array.isArray(item.nota_fiscal) ? item.nota_fiscal : [],
        origem,
        entrou_em_pago_em: dataPagamento,
      };
    });

    const { error } = await supabase
      .from('demanda_itens_historico_pago')
      .upsert(payload, { onConflict: 'demanda_item_id,data_pagamento' });

    if (error) {
      throw new Error(`Erro ao registrar histórico de itens pagos: ${error.message}`);
    }
  };

  const carregarHistoricoPagoParaMensal = async (ultimaGeracao: Date | null) => {
    if (!id) {
      return [] as HistoricoPagoItem[];
    }

    let query = supabase
      .from('demanda_itens_historico_pago')
      .select('id, obra_id, demanda_item_id, titulo, categoria, descricao, valor, data_pedido, data_entrega, data_pagamento, tempo_entrega, observacao_entrega, nota_fiscal, origem, entrou_em_pago_em, created_at')
      .eq('obra_id', Number(id))
      .order('entrou_em_pago_em', { ascending: true });

    if (ultimaGeracao) {
      query = query.gt('entrou_em_pago_em', ultimaGeracao.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao carregar histórico mensal: ${error.message}`);
    }

    return (data || []) as HistoricoPagoItem[];
  };

  const gerarRelatorioMensalExcel = async () => {
    if (!id) {
      return;
    }

    try {
      const ultimaGeracao = await carregarUltimaGeracaoMensal();

      // Garante captura dos itens atualmente em pago antes de qualquer remoção futura.
      const itensPagosAtuais = itens.filter((item) => item.status === 'pago');
      await registrarHistoricoPagoItens(itensPagosAtuais, 'movido_para_pago');

      const historicoMensal = await carregarHistoricoPagoParaMensal(ultimaGeracao);

      if (historicoMensal.length === 0) {
        toast.error('Não há itens para o relatório mensal desde a última geração.');
        return;
      }

      const itensOrdenados = [...historicoMensal].sort((a, b) => {
        const dataA = obterDataValida(a.entrou_em_pago_em) || obterDataValida(a.created_at) || new Date(0);
        const dataB = obterDataValida(b.entrou_em_pago_em) || obterDataValida(b.created_at) || new Date(0);
        return dataA.getTime() - dataB.getTime();
      });
      const itensAgrupados = agruparItensPorCategoria(itensOrdenados);

      const valorTotal = itensOrdenados.reduce((acc, item) => acc + Number(item.valor ?? 0), 0);
      const agora = new Date();
      const inicioPeriodo = ultimaGeracao || (obterDataValida(itensOrdenados[0]?.entrou_em_pago_em) || obterDataValida(itensOrdenados[0]?.created_at) || agora);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GLog';
      workbook.created = agora;

      const worksheet = workbook.addWorksheet('Relatorio Mensal');

      worksheet.columns = [
        { key: 'categoria', width: 22 },
        { key: 'nome', width: 28 },
        { key: 'descricao', width: 44 },
        { key: 'valor', width: 14 },
        { key: 'observacoes', width: 30 },
      ];

      worksheet.getCell('A1').value = `Relatório de demandas - ${obraNome}`;
      worksheet.mergeCells('A1:E1');
      worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      worksheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(1).height = 24;

      worksheet.getCell('A2').value = `Período: ${format(inicioPeriodo, 'dd/MM/yyyy')} até ${format(agora, 'dd/MM/yyyy')}`;
      worksheet.mergeCells('A2:E2');
      worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF4B5563' } };
      worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.addRow([]);

      const headerRow = worksheet.getRow(4);
      headerRow.values = ['Categoria', 'Nome', 'Descricao', 'Valor (R$)', 'Observacoes'];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle' };
      headerRow.height = 22;

      ['A4', 'B4', 'C4', 'D4', 'E4'].forEach((cellRef) => {
        worksheet.getCell(cellRef).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' },
        };
      });

      itensAgrupados.forEach((grupo, indexGrupo) => {
        const rowCategoria = worksheet.addRow({
          categoria: grupo.categoria,
          nome: `Subtotal da categoria`,
          valor: grupo.total,
        });
        rowCategoria.font = { bold: true, color: { argb: 'FF0F172A' } };
        rowCategoria.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });

        grupo.itens.forEach((item) => {
          const row = worksheet.addRow({
            categoria: grupo.categoria,
            nome: item.titulo || 'Lista de Demanda',
            descricao: item.descricao || item.titulo || '',
            valor: Number(item.valor ?? 0),
            observacoes: item.observacao_entrega || '',
          });

          const isPar = row.number % 2 === 0;
          const bgColor = isPar ? 'FFF8FAFC' : 'FFFFFFFF';
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
          });
        });

        if (indexGrupo < itensAgrupados.length - 1) {
          worksheet.addRow({});
        }
      });

      const linhaTotais = worksheet.addRow({
        categoria: 'TOTAL GERAL',
        valor: valorTotal,
      });
      linhaTotais.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      linhaTotais.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF0F172A' } },
          bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF0F172A' } },
        };
      });

      const firstDataRow = 5;
      for (let i = firstDataRow; i <= worksheet.rowCount; i += 1) {
        worksheet.getCell(`D${i}`).numFmt = 'R$ #,##0.00';
        worksheet.getCell(`D${i}`).alignment = { horizontal: 'right', vertical: 'middle' };
        worksheet.getCell(`E${i}`).alignment = { horizontal: 'left', vertical: 'middle' };
      }

      const bordaClara = {
        top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
      };

      // Bordas em toda a área útil da tabela (cabeçalho, período, títulos e linhas).
      ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'].forEach((cellRef) => {
        worksheet.getCell(cellRef).border = bordaClara;
      });

      for (let row = 4; row <= worksheet.rowCount; row += 1) {
        ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
          worksheet.getCell(`${col}${row}`).border = bordaClara;
        });
      }

      worksheet.views = [{ state: 'frozen', ySplit: 4 }];
      worksheet.autoFilter = 'A4:E4';

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `relatorio_mensal_demanda_${obraNome.replace(/\s+/g, '_').toLowerCase()}_${format(agora, 'MM-yyyy')}.xlsx`;

      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        const base64 = converterArrayBufferParaBase64(buffer as ArrayBuffer);

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `Relatorio Mensal - ${obraNome}`,
          text: `Relatorio mensal de demandas (${format(inicioPeriodo, 'dd/MM/yyyy')} a ${format(agora, 'dd/MM/yyyy')})`,
          url: result.uri,
          dialogTitle: 'Compartilhar relatorio mensal',
        });
      } else {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }

      const resumoHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Resumo Relatório Mensal</title>
        </head>
        <body>
          <!-- ${MARCADOR_RELATORIO_MENSAL} -->
          <h1>Relatório Mensal de Demandas (Excel)</h1>
          <p>Obra: ${obraNome}</p>
          <p>Período: ${format(inicioPeriodo, 'dd/MM/yyyy')} até ${format(agora, 'dd/MM/yyyy')}</p>
          <p>Itens incluídos: ${itensOrdenados.length}</p>
          <p>Valor total: R$ ${valorTotal.toFixed(2)}</p>
          <p>Categorias incluídas: ${itensAgrupados.length}</p>
          <p>Gerado em: ${format(agora, 'dd/MM/yyyy HH:mm')}</p>
        </body>
        </html>
      `;

      const { error: saveError } = await supabase
        .from('relatorios')
        .insert({
          obra_id: Number(id),
          data_inicio: format(inicioPeriodo, 'yyyy-MM-dd'),
          data_fim: format(agora, 'yyyy-MM-dd'),
          tipo: 'demanda',
          conteudo: resumoHtml,
        });

      if (saveError) {
        console.error('Erro ao salvar marco do relatório mensal:', saveError);
        toast.warning('Excel gerado, mas não foi possível salvar o marco da geração mensal.');
      } else {
        toast.success(`Relatório mensal gerado com ${itensOrdenados.length} item(ns).`);
      }
    } catch (error) {
      console.error('Erro ao gerar relatório mensal:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao gerar relatório mensal: ${message}`);
    }
  };

  const executarGeracaoRelatorio = async () => {
    try {
      const itensPagos = itens.filter(item => item.status === 'pago');
      
      if (itensPagos.length === 0) {
        toast.error('Não há itens pagos para gerar o relatório');
        return;
      }

      // Registra no histórico antes de remover itens pagos do quadro.
      await registrarHistoricoPagoItens(itensPagos, 'gerado_relatorio_pdf');

      const valorTotal = itensPagos.reduce((total, item) => total + (item.valor || 0), 0);
      const itensAgrupados = agruparItensPorCategoria(itensPagos);

      const itensHtmlPorCategoria = await Promise.all(itensAgrupados.map(async (grupo) => {
        const cards = await Promise.all(grupo.itens.map(async item => {
          const notasFiscaisHtml = await renderNotasFiscais(item.nota_fiscal);
          const valorStr = item.valor ? `R$ ${item.valor.toFixed(2)}` : 'N/A';

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
              <div class="category-badge">${grupo.categoria}</div>
              <div class="card-title">${item.titulo}</div>
              ${item.descricao ? `<div class="card-description">${item.descricao.replace(/\n/g, '<br>')}</div>` : ''}
              <div class="info-grid">
                ${dataPedidoHtml}
                ${dataEntregaHtml}
                <div class="info-item">
                  <div class="info-label">Categoria</div>
                  <div class="info-value">${grupo.categoria}</div>
                </div>
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

        return `
          <div class="category-section">
            <div class="category-header">
              <h2>${grupo.categoria}</h2>
              <span>Total da categoria: R$ ${grupo.total.toFixed(2)}</span>
            </div>
            <div class="items-container">
              ${cards.join('')}
            </div>
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
            .category-section { margin-bottom: 24px; }
            .category-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #cbd5e1; }
            .category-header h2 { margin: 0; font-size: 1.1em; }
            .category-header span { font-size: 0.95em; font-weight: bold; color: #0f766e; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background-color: #fff; page-break-inside: avoid; }
            .category-badge { display: inline-block; padding: 4px 8px; margin-bottom: 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 0.78em; font-weight: bold; text-transform: uppercase; }
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
                ${itensHtmlPorCategoria.join('')}
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

  const gerarResumoCategoriasPdf = async () => {
    try {
      const itensComValor = itens.filter((item) => Number(item.valor ?? 0) > 0);
      const categoriasBase = categorias.map((categoria) => categoria.nome);
      const gruposMap = new Map<string, { categoria: string; itens: DemandaItem[]; total: number }>();

      categoriasBase.forEach((categoria) => {
        gruposMap.set(categoria, { categoria, itens: [], total: 0 });
      });

      agruparItensPorCategoria(itensComValor).forEach((grupo) => {
        gruposMap.set(grupo.categoria, {
          categoria: grupo.categoria,
          itens: grupo.itens,
          total: grupo.total,
        });
      });

      const grupos = Array.from(gruposMap.values()).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
      const totalGeral = grupos.reduce((acc, grupo) => acc + grupo.total, 0);

      if (grupos.length === 0) {
        toast.error('Não há categorias para gerar o resumo.');
        return;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 14;
      const maxWidth = pageWidth - marginX * 2;
      let currentY = 18;

      const adicionarNovaPaginaSeNecessario = (alturaNecessaria: number) => {
        if (currentY + alturaNecessaria <= pageHeight - 15) {
          return;
        }

        pdf.addPage();
        currentY = 18;
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('Resumo de gastos por categoria', marginX, currentY);
      currentY += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Obra: ${obraNome}`, marginX, currentY);
      currentY += 5;
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, marginX, currentY);
      currentY += 8;

      grupos.forEach((grupo) => {
        adicionarNovaPaginaSeNecessario(16);
        pdf.setDrawColor(203, 213, 225);
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(marginX, currentY - 4, maxWidth, 10, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(grupo.categoria, marginX + 3, currentY + 2);
        pdf.text(`R$ ${grupo.total.toFixed(2)}`, pageWidth - marginX - 3, currentY + 2, { align: 'right' });
        currentY += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);

        if (grupo.itens.length === 0) {
          pdf.text('Nenhum item com valor registrado nesta categoria.', marginX + 3, currentY + 2);
          currentY += 7;
          return;
        }

        grupo.itens.forEach((item) => {
          const linhas = pdf.splitTextToSize(
            `${item.titulo} - ${item.descricao || 'Sem descrição'} - R$ ${Number(item.valor ?? 0).toFixed(2)}`,
            maxWidth - 6
          );
          adicionarNovaPaginaSeNecessario(linhas.length * 4 + 3);
          pdf.text(linhas, marginX + 3, currentY + 2);
          currentY += linhas.length * 4 + 2;
        });

        currentY += 3;
      });

      adicionarNovaPaginaSeNecessario(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(`Total geral: R$ ${totalGeral.toFixed(2)}`, pageWidth - marginX, currentY + 4, { align: 'right' });

      const fileName = `resumo_categorias_${obraNome.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`;
      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `Resumo por categoria - ${obraNome}`,
          text: `Resumo de gastos por categoria da obra ${obraNome}.`,
          url: result.uri,
          dialogTitle: 'Compartilhar resumo por categoria',
        });
      } else {
        pdf.save(fileName);
      }

      toast.success('Resumo de gastos por categoria gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar resumo por categoria:', error);
      toast.error('Erro ao gerar resumo por categoria.');
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

  const loadImageUrlsForItem = useCallback(async (item: DemandaItem) => {
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
  }, [getImageUrl, imageUrls]);

  // Otimização: Carregar URLs apenas quando o itemParaEditar muda ou quando itens são carregados
  useEffect(() => {
    if (itemParaEditar && itemParaEditar.nota_fiscal) {
      loadImageUrlsForItem(itemParaEditar);
    }
  }, [itemParaEditar, loadImageUrlsForItem]);

  useEffect(() => {
    itens.forEach(item => {
      if(item.nota_fiscal) {
         loadImageUrlsForItem(item);
      }
    });
  }, [itens, loadImageUrlsForItem]); // Dependência nos itens carregados

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
              onClick={() => {
                setItemParaEditar(null);
                setShowAdicionarDialog(true);
              }}
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <Plus className="h-4 w-4" />
              <span className="xs:inline">Nova Demanda</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGerenciarCategorias(true)}
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <Tags className="h-4 w-4" />
              <span className="xs:inline">Categorias</span>
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
              onClick={gerarRelatorioMensalExcel}
              className="flex items-center gap-2 grow sm:grow-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="xs:inline">Relatório Mensal (Excel)</span>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:bg-green-100"
                          onClick={() => compartilharViaWhatsApp(item)}
                          title="Compartilhar via WhatsApp"
                        >
                          <ShareIcon className="h-4 w-4" />
                        </Button>
                        {status !== 'demanda' || item.status === 'demanda' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setItemParaEditar({ ...item, nota_fiscal: item.nota_fiscal || [] });
                              if (item.status === 'demanda') {
                                setShowAdicionarDialog(true);
                                return;
                              }
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
                    <div className="flex-grow pr-24">
                      <h3 className="font-medium break-words">{item.titulo}</h3>
                      {item.categoria && (
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-600 mt-1">
                          Categoria: {item.categoria}
                        </p>
                      )}
                      {item.descricao && (
                        item.status === 'demanda' ? (
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
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                    {status === 'entregue' && item.status !== 'demanda' && (
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
        onOpenChange={(open) => {
          setShowAdicionarDialog(open);
          if (!open) {
            setItemParaEditar(null);
          }
        }}
        onDemandaAdicionada={carregarDados}
        categorias={categoriasAtivas}
        itemParaEditar={itemParaEditar?.status === 'demanda' ? itemParaEditar : undefined}
      />

      <Dialog open={showGerenciarCategorias} onOpenChange={setShowGerenciarCategorias}>
        <DialogContent className="w-[95vw] max-w-lg h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nome da categoria"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdicionarCategoria(); }}
              />
              <Button className="w-full sm:w-auto" type="button" onClick={handleAdicionarCategoria}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <Button variant="outline" type="button" onClick={gerarResumoCategoriasPdf}>
              <FileText className="h-4 w-4 mr-2" />
              Resumo por categoria
            </Button>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
              ) : (
                categorias.map((categoria) => (
                  editandoCategoria?.id === categoria.id ? (
                    <div key={categoria.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoCategoria.nome}
                        onChange={(e) => setEditandoCategoria({ ...editandoCategoria, nome: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSalvarEdicaoCategoria();
                          if (e.key === 'Escape') setEditandoCategoria(null);
                        }}
                        className="h-8"
                      />
                      <Button variant="ghost" size="icon" onClick={handleSalvarEdicaoCategoria}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoCategoria(null)}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div key={categoria.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                      <span className="break-words">
                        {categoria.nome}
                        {!categoria.ativo && <span className="ml-2 text-xs text-amber-600">(inativa)</span>}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoCategoria({ id: categoria.id, nome: categoria.nome })}
                          disabled={!categoria.ativo}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        {categoria.ativo ? (
                          <Button variant="ghost" size="icon" onClick={() => handleExcluirCategoria(categoria.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleReativarCategoria(categoria.id)}>
                            Reativar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              {itemParaEditar?.status === 'demanda' 
                ? 'Faça as alterações necessárias nos itens da lista.' 
                : 'Edite os detalhes do item.'}
            </DialogDescription>
          </DialogHeader>
          {itemParaEditar && (
            <div className="grid gap-4 py-4">
              {itemParaEditar.status !== 'demanda' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="edit-titulo" className="text-sm font-medium">
                    Título:
                  </label>
                  <input
                    id="edit-titulo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    spellCheck={true}
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    autoComplete="on"
                    inputMode="text"
                    lang="pt-BR"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Categoria:
                </label>
                <Select value={editCategoria} onValueChange={setEditCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORIA_VAZIA}>Sem categoria</SelectItem>
                    {categoriasEdicao.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-descricao" className="text-sm font-medium">
                  {itemParaEditar.status === 'demanda' ? 'Itens da lista (um por linha):' : 'Descrição:'}
                </label>
                <textarea
                  id="edit-descricao"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={itemParaEditar.status === 'demanda' ? 'Digite os itens...' : 'Digite a descrição...'}
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  rows={itemParaEditar.status === 'demanda' ? 5 : 3} 
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  autoComplete="on"
                  inputMode="text"
                  lang="pt-BR"
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
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
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
                const itemAtualizado = {
                  ...itemParaEditar,
                  titulo: editTitulo || itemParaEditar.titulo,
                  descricao: editDescricao,
                  categoria: editCategoria === CATEGORIA_VAZIA ? null : editCategoria,
                  valor: editValor ? parseFloat(editValor) : itemParaEditar.valor 
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