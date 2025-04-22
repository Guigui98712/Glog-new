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
import { Camera } from '@capacitor/camera';

export function DemandaObra() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [imagemUrl, setImagemUrl] = useState('');
  const [itemParaEditar, setItemParaEditar] = useState<DemandaItem | null>(null);

  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      toast.error('ID da obra inválido');
      navigate('/obras');
      return;
    }
    carregarDados();
  }, [id, navigate]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar nome da obra
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', id)
        .single();

      if (obraError) throw obraError;
      setObraNome(obra.nome);

      // Carregar itens de demanda
      const { data: demandaItens, error: demandaError } = await supabase
        .from('demanda_itens')
        .select('*')
        .eq('obra_id', id)
        .order('created_at', { ascending: false });

      if (demandaError) throw demandaError;
      
      // Converter nota_fiscal para array se necessário
      const itensConvertidos = demandaItens.map(item => ({
        ...item,
        nota_fiscal: item.nota_fiscal 
          ? Array.isArray(item.nota_fiscal) 
            ? item.nota_fiscal 
            : [item.nota_fiscal]
          : []
      }));
      
      setItens(itensConvertidos);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados da demanda');
    } finally {
      setLoading(false);
    }
  };

  const handleMoverParaPago = async (item: DemandaItem) => {
    setSelectedItem(item);
    setShowMoverParaPagoDialog(true);
  };

  const handleConfirmMoverParaPago = async () => {
    if (!selectedItem) return;
    
    try {
      setLoading(true);
      const updatedItem = {
        ...selectedItem,
        status: 'pago',
        data_pagamento: new Date().toISOString(),
      };

      await supabase
        .from('demanda_itens')
        .update(updatedItem)
        .eq('id', selectedItem.id);

      setItens(itens.map(i => i.id === selectedItem.id ? updatedItem : i));
      toast.success('Item movido para pago com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao mover item para pago');
    } finally {
      setLoading(false);
      setShowMoverParaPagoDialog(false);
      setSelectedItem(null);
    }
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

  const getImageUrl = (imagePath: string) => {
    return supabase.storage.from('notas-fiscais').getPublicUrl(imagePath).data.publicUrl;
  };

  const handleVisualizarNotaFiscal = async (notaFiscalPath: string) => {
    try {
      console.log('Caminho original da imagem:', notaFiscalPath);
      
      let urlFinal = notaFiscalPath;
      
      if (!notaFiscalPath.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('notas-fiscais')
          .createSignedUrl(notaFiscalPath, 60);

        if (error) {
          console.error('Erro ao gerar URL assinada:', error);
          throw new Error('Erro ao gerar URL de acesso à imagem');
        }

        if (!data?.signedUrl) {
          throw new Error('URL não encontrada');
        }
        
        urlFinal = data.signedUrl;
      }
      
      setNotaFiscalUrl(urlFinal);
      setShowNotaFiscal(true);
      
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar a imagem');
    }
  };

  const handleGerarRelatorio = async () => {
    try {
      // Filtrar apenas os itens pagos
      const itensPagos = itens.filter(item => item.status === 'pago');
      
      if (itensPagos.length === 0) {
        toast.error('Não há itens pagos para gerar o relatório');
        return;
      }

      // Calcular valor total
      const valorTotal = itensPagos.reduce((total, item) => total + (item.valor || 0), 0);

      // Gerar o HTML do relatório
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
                  ${itensPagos.map(item => `
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
                      ${item.nota_fiscal && item.nota_fiscal.length > 0 ? `
                        <div class="nota-fiscal">
                          <div class="grid grid-cols-2 gap-4">
                            ${item.nota_fiscal.map((imagem, index) => `
                              <div class="relative aspect-square rounded-lg border border-gray-200 overflow-hidden">
                                <img
                                  src="${getImageUrl(imagem)}"
                                  alt="Nota Fiscal ${index + 1}"
                                  class="w-full h-full object-contain"
                                />
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
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
      
      // Escrever o conteúdo HTML na nova janela
      printWindow.document.write(html);
      printWindow.document.close();
      
      toast.success('Relatório gerado com sucesso! Os itens foram removidos da lista.');

      // Recarregar os dados para atualizar a lista
      await carregarDados();

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar o relatório');
    }
  };

  const handleImagemUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(filePath, file);

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
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    }
  };

  const handleTirarFoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'base64',
        source: 'CAMERA'
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

  const handleRemoverImagem = async (imagemPath: string) => {
    try {
      if (!itemParaEditar) return;

      // Remove do storage
      const { error: deleteError } = await supabase.storage
        .from('notas-fiscais')
        .remove([imagemPath]);

      if (deleteError) throw deleteError;

      // Atualiza o estado local
      const novasImagens = itemParaEditar.nota_fiscal?.filter(img => img !== imagemPath) || [];
      setItemParaEditar({
        ...itemParaEditar,
        nota_fiscal: novasImagens
      });

      toast.success('Imagem removida com sucesso');
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  // Função para renderizar a miniatura da imagem
  const renderImagemMiniatura = (imagem: string, index: number) => {
    return (
      <div key={index} className="relative group">
        <div className="relative w-16 h-16 rounded-lg border border-input overflow-hidden bg-gray-50">
          <img
            src={imagem.startsWith('http') ? imagem : getImageUrl(imagem)}
            alt={`Nota Fiscal ${index + 1}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://placehold.co/64x64?text=Erro';
            }}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-white/80 hover:bg-white"
              onClick={() => handleVisualizarNotaFiscal(imagem)}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

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
            onClick={() => navigate(`/demandas/${id}/relatorios`)}
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
                          <p key={index}>{linha.trim()}</p>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                        <p>Tempo de entrega: {item.tempo_entrega}</p>
                        {item.observacao_entrega && (
                          <p className="text-yellow-600">Obs: {item.observacao_entrega}</p>
                        )}
                        {item.nota_fiscal && item.nota_fiscal.length > 0 && (
                          <div className="mt-2">
                            <div className="text-sm text-muted-foreground mb-1">Notas Fiscais / Comprovantes:</div>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(item.nota_fiscal) 
                                ? item.nota_fiscal.map((imagem, index) => renderImagemMiniatura(imagem, index))
                                : renderImagemMiniatura(item.nota_fiscal, 0)
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
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
                        {item.nota_fiscal && item.nota_fiscal.length > 0 && (
                          <div className="mt-2">
                            <div className="text-sm text-muted-foreground mb-1">Notas Fiscais / Comprovantes:</div>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(item.nota_fiscal) 
                                ? item.nota_fiscal.map((imagem, index) => renderImagemMiniatura(imagem, index))
                                : renderImagemMiniatura(item.nota_fiscal, 0)
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
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
                    {item.nota_fiscal && item.nota_fiscal.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm text-muted-foreground mb-1">Notas Fiscais / Comprovantes:</div>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(item.nota_fiscal) 
                            ? item.nota_fiscal.map((imagem, index) => renderImagemMiniatura(imagem, index))
                            : renderImagemMiniatura(item.nota_fiscal, 0)
                          }
                        </div>
                      </div>
                    )}
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
      <Dialog open={showNotaFiscal} onOpenChange={setShowNotaFiscal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualizar Nota Fiscal</DialogTitle>
            <DialogDescription>
              Visualização em tamanho completo da nota fiscal ou comprovante
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {notaFiscalUrl && (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg shadow-lg bg-gray-100">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                  <img 
                    src={notaFiscalUrl} 
                    alt="Nota Fiscal" 
                    className="w-full h-full object-contain relative z-10"
                    style={{ maxHeight: '70vh', opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
                    onLoad={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.opacity = '1';
                      const spinner = target.parentElement?.querySelector('.animate-spin');
                      if (spinner) spinner.remove();
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      toast.error('Erro ao exibir a imagem');
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'text-red-500 text-center p-4';
                      errorDiv.textContent = 'Não foi possível carregar a imagem';
                      target.parentElement?.appendChild(errorDiv);
                    }}
                  />
                </div>
              </div>
            )}
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
                  {itemParaEditar.nota_fiscal && itemParaEditar.nota_fiscal.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {Array.isArray(itemParaEditar.nota_fiscal) 
                        ? itemParaEditar.nota_fiscal.map((imagem, index) => (
                            <div key={index} className="relative group">
                              <div className="relative aspect-square rounded-lg border border-input overflow-hidden bg-gray-50">
                                <img
                                  src={imagem.startsWith('http') ? imagem : getImageUrl(imagem)}
                                  alt={`Nota Fiscal ${index + 1}`}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://placehold.co/64x64?text=Erro';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white"
                                    onClick={() => handleVisualizarNotaFiscal(imagem)}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white text-destructive"
                                    onClick={() => handleRemoverImagem(imagem)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        : (
                            <div className="relative group">
                              <div className="relative aspect-square rounded-lg border border-input overflow-hidden bg-gray-50">
                                <img
                                  src={itemParaEditar.nota_fiscal.startsWith('http') 
                                    ? itemParaEditar.nota_fiscal 
                                    : getImageUrl(itemParaEditar.nota_fiscal)}
                                  alt="Nota Fiscal"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://placehold.co/64x64?text=Erro';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white"
                                    onClick={() => handleVisualizarNotaFiscal(itemParaEditar.nota_fiscal)}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-white/80 hover:bg-white text-destructive"
                                    onClick={() => handleRemoverImagem(itemParaEditar.nota_fiscal)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                      }
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