import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, ArrowRight, ArrowLeft as ArrowLeftIcon, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';
import { AdicionarDemandaDialog } from '@/components/dialogs/AdicionarDemandaDialog';
import { MoverParaPedidoDialog } from '@/components/dialogs/MoverParaPedidoDialog';
import { MoverParaEntregueDialog } from '@/components/dialogs/MoverParaEntregueDialog';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DemandaObra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [obraNome, setObraNome] = useState('');
  const [itens, setItens] = useState<DemandaItem[]>([]);
  const [showAdicionarDialog, setShowAdicionarDialog] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<DemandaItem | null>(null);
  const [showMoverParaPedidoDialog, setShowMoverParaPedidoDialog] = useState(false);
  const [showMoverParaEntregueDialog, setShowMoverParaEntregueDialog] = useState(false);
  const [showNotaFiscal, setShowNotaFiscal] = useState(false);
  const [notaFiscalUrl, setNotaFiscalUrl] = useState('');

  useEffect(() => {
    if (id) {
      carregarDados();
    }
  }, [id]);

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
      setItens(demandaItens);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados da demanda');
    } finally {
      setLoading(false);
    }
  };

  const handleMoverParaPago = async (item: DemandaItem) => {
    try {
      const { error } = await supabase
        .from('demanda_itens')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          tempo_entrega: item.tempo_entrega
        })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Item movido para Pago');
      carregarDados();
    } catch (error) {
      console.error('Erro ao mover item:', error);
      toast.error('Erro ao mover item para Pago');
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

  const handleExcluirDemanda = async (itemId: number) => {
    try {
      const { error } = await supabase
        .from('demanda_itens')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Item excluído com sucesso');
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      toast.error('Erro ao excluir item');
    }
  };

  const itensPorStatus = {
    demanda: itens.filter(item => item.status === 'demanda'),
    pedido: itens.filter(item => item.status === 'pedido'),
    entregue: itens.filter(item => item.status === 'entregue'),
    pago: itens.filter(item => item.status === 'pago')
  };

  const handleVisualizarNotaFiscal = async (notaFiscalPath: string) => {
    try {
      console.log('Caminho original da imagem:', notaFiscalPath);
      
      let urlFinal = notaFiscalPath;
      
      // Verifica se o caminho não é uma URL completa
      if (!notaFiscalPath.startsWith('http')) {
        // Se não for URL completa, obtém a URL pública do bucket
        const { data, error } = await supabase.storage
          .from('notas-fiscais')
          .createSignedUrl(notaFiscalPath, 60); // URL assinada válida por 60 segundos

        if (error) {
          console.error('Erro ao gerar URL assinada:', error);
          throw new Error('Erro ao gerar URL de acesso à imagem');
        }

        if (!data?.signedUrl) {
          throw new Error('URL não encontrada');
        }
        
        urlFinal = data.signedUrl;
      }
      
      console.log('URL final da imagem:', urlFinal);
      
      // Primeiro verifica se o arquivo existe usando um HEAD request
      try {
        const response = await fetch(urlFinal, { method: 'HEAD' });
        if (!response.ok) {
          console.error('Erro na verificação HEAD:', response.status, response.statusText);
          throw new Error(`Arquivo não encontrado (${response.status})`);
        }
      } catch (headError) {
        console.error('Erro ao verificar existência do arquivo:', headError);
        throw new Error('Não foi possível verificar se a imagem existe');
      }
      
      // Se chegou até aqui, a imagem existe e pode ser carregada
      setNotaFiscalUrl(urlFinal);
      setShowNotaFiscal(true);
      
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar a imagem');
    }
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
            <div className="space-y-2">
              {itensPorStatus.demanda.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm relative"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => handleExcluirDemanda(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <h3 className="font-medium pr-8">{item.titulo}</h3>
                  {item.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.descricao}
                    </p>
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
            <div className="space-y-2">
              {itensPorStatus.pedido.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  <h3 className="font-medium">{item.titulo}</h3>
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                    <p>Status: {item.pedido_completo ? 'Completo' : 'Parcial'}</p>
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
              ))}
            </div>
          </div>

          {/* Seção Entregue */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Entregue</h2>
            <div className="space-y-2">
              {itensPorStatus.entregue.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  <h3 className="font-medium">{item.titulo}</h3>
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                    <p>Tempo de entrega: {item.tempo_entrega}</p>
                    {item.observacao_entrega && (
                      <p className="text-yellow-600">Obs: {item.observacao_entrega}</p>
                    )}
                    {item.nota_fiscal && (
                      <button
                        onClick={() => handleVisualizarNotaFiscal(item.nota_fiscal)}
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Ver imagem
                      </button>
                    )}
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
                      onClick={() => handleMoverParaPago(item)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Pago */}
          <div className="bg-card rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Pago</h2>
            <div className="space-y-2">
              {itensPorStatus.pago.map((item) => (
                <div
                  key={item.id}
                  className="bg-background p-3 rounded-md shadow-sm"
                >
                  <h3 className="font-medium">{item.titulo}</h3>
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Valor: R$ {item.valor?.toFixed(2)}</p>
                    <p>Pago em: {format(new Date(item.data_pagamento!), 'dd/MM/yyyy')}</p>
                    {item.tempo_entrega && (
                      <p>Tempo de entrega: {item.tempo_entrega}</p>
                    )}
                    {item.nota_fiscal && (
                      <button
                        onClick={() => handleVisualizarNotaFiscal(item.nota_fiscal)}
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Ver imagem
                      </button>
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
            <DialogTitle>Visualizar Imagem</DialogTitle>
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
                    alt="Imagem do item" 
                    className="w-full h-full object-contain relative z-10"
                    style={{ maxHeight: '70vh' }}
                    onLoad={(e) => {
                      // Remove o spinner quando a imagem carregar
                      const target = e.target as HTMLImageElement;
                      target.style.opacity = '1';
                      const spinner = target.parentElement?.querySelector('.animate-spin');
                      if (spinner) {
                        spinner.remove();
                      }
                    }}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem no modal');
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      toast.error('Erro ao exibir a imagem');
                      // Adiciona mensagem de erro no lugar da imagem
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'text-red-500 text-center p-4';
                      errorDiv.textContent = 'Não foi possível carregar a imagem';
                      target.parentElement?.appendChild(errorDiv);
                    }}
                    style={{
                      maxHeight: '70vh',
                      opacity: 0,
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(notaFiscalUrl, '_blank')}
                  >
                    Abrir em nova aba
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        const link = document.createElement('a');
                        link.href = notaFiscalUrl;
                        link.download = 'imagem.jpg';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } catch (error) {
                        console.error('Erro ao baixar imagem:', error);
                        toast.error('Erro ao baixar a imagem');
                      }
                    }}
                  >
                    Baixar imagem
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 