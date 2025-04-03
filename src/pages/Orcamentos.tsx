import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pen, Trash, BarChart, Eye } from "lucide-react";
import type { Obra } from "@/types/obra";
import type { Orcamento } from "@/types/orcamento";
import { useToast } from "@/components/ui/use-toast";
import { listarObras, listarOrcamentos, excluirOrcamento } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Interface para o comparativo salvo
interface ComparativoSalvo {
  id: string;
  data: string;
  orcamentoId: number;
  orcamentoNome: string;
  empresas: any[];
  obraId: number;
}

const Orcamentos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [obraId, setObraId] = useState<string>("");
  const [obras, setObras] = useState<Obra[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [comparativosSalvos, setComparativosSalvos] = useState<ComparativoSalvo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [comparativoParaExcluir, setComparativoParaExcluir] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
    
    // Verificar se há um obraId nos parâmetros da URL
    const obraIdParam = searchParams.get('obraId');
    if (obraIdParam) {
      setObraId(obraIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (obraId) {
      carregarOrcamentosPorObra(Number(obraId));
      carregarComparativosSalvos(Number(obraId));
    }
  }, [obraId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const obrasData = await listarObras();
      setObras(obrasData);
      
      // Se não tiver obra selecionada, não carrega orçamentos ainda
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
      setObras([]);
      setLoading(false);
    }
  };

  const carregarOrcamentosPorObra = async (id: number) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const orcamentosData = await listarOrcamentos(id);
      setOrcamentos(orcamentosData || []);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarComparativosSalvos = (obraId: number) => {
    try {
      const todosComparativos = JSON.parse(
        localStorage.getItem("comparativos") || "[]"
      );
      
      // Filtrar apenas os comparativos da obra selecionada
      const comparativosDaObra = todosComparativos.filter(
        (comp: ComparativoSalvo) => comp.obraId === obraId
      );
      
      setComparativosSalvos(comparativosDaObra);
    } catch (error) {
      console.error("Erro ao carregar comparativos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os comparativos salvos.",
        variant: "destructive"
      });
    }
  };

  const handleNovoOrcamento = () => {
    if (!obraId) {
      toast({
        title: "Erro",
        description: "Selecione uma obra primeiro",
        variant: "destructive",
      });
      return;
    }
    navigate(`/orcamentos/novo/${obraId}`);
  };

  const handleVerOrcamento = (orcamentoId: number) => {
    if (!obraId) {
      toast({
        title: "Erro",
        description: "Selecione uma obra primeiro",
        variant: "destructive",
      });
      return;
    }
    navigate(`/orcamentos/${orcamentoId}`);
  };

  const handleEditarOrcamento = (event: React.MouseEvent, orcamentoId: number) => {
    event.stopPropagation();
    if (!obraId) {
      toast({
        title: "Erro",
        description: "Selecione uma obra primeiro",
        variant: "destructive",
      });
      return;
    }
    navigate(`/orcamentos/editar/${orcamentoId}`, { 
      state: { obraId: Number(obraId) } 
    });
  };

  const handleExcluirOrcamento = async (event: React.MouseEvent, orcamentoId: number) => {
    event.stopPropagation();
    try {
      await excluirOrcamento(orcamentoId);
      
      // Recarregar apenas os orçamentos da obra atual
      if (obraId) {
        await carregarOrcamentosPorObra(Number(obraId));
      }
      
      toast({
        title: "Sucesso",
        description: "Orçamento excluído com sucesso",
      });
    } catch (error) {
      console.error('Erro ao excluir orçamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento",
        variant: "destructive"
      });
    }
  };

  const confirmarExclusao = (id: string) => {
    setComparativoParaExcluir(id);
    setDialogAberto(true);
  };

  const excluirComparativo = () => {
    try {
      if (!comparativoParaExcluir) return;

      const todosComparativos = JSON.parse(
        localStorage.getItem("comparativos") || "[]"
      );
      
      const comparativosFiltrados = todosComparativos.filter(
        (comp: ComparativoSalvo) => comp.id !== comparativoParaExcluir
      );
      
      localStorage.setItem("comparativos", JSON.stringify(comparativosFiltrados));
      
      // Atualizar apenas os comparativos da obra atual
      if (obraId) {
        carregarComparativosSalvos(Number(obraId));
      }
      
      toast({
        title: "Comparativo excluído",
        description: "O comparativo foi excluído com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir comparativo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o comparativo.",
        variant: "destructive"
      });
    } finally {
      setDialogAberto(false);
      setComparativoParaExcluir(null);
    }
  };

  const visualizarComparativo = (orcamentoId: number) => {
    navigate(`/orcamentos/${orcamentoId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slideIn p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Orçamentos</h1>
      </div>

      <div className="w-full max-w-md">
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma obra" />
          </SelectTrigger>
          <SelectContent>
            {obras.map((obra) => (
              <SelectItem key={obra.id} value={String(obra.id)}>
                {obra.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!obraId ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Selecione uma obra para visualizar os orçamentos e comparativos</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Seção de Comparativos Salvos */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Comparativos Salvos</h2>
            </div>
            
            {comparativosSalvos.length > 0 ? (
              <Card className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orçamento</TableHead>
                      <TableHead>Data de Criação</TableHead>
                      <TableHead>Empresas</TableHead>
                      <TableHead>Menor Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativosSalvos.map((comparativo) => {
                      const dataFormatada = format(
                        parseISO(comparativo.data),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      );
                      
                      const menorValor = Math.min(
                        ...comparativo.empresas.map((emp) => emp.valor || 0)
                      );
                      
                      const empresaComMenorValor = comparativo.empresas.find(
                        (emp) => emp.valor === menorValor
                      );

                      return (
                        <TableRow key={comparativo.id}>
                          <TableCell className="font-medium">
                            {comparativo.orcamentoNome}
                          </TableCell>
                          <TableCell>{dataFormatada}</TableCell>
                          <TableCell>
                            {comparativo.empresas.map((emp) => emp.nome).join(", ")}
                          </TableCell>
                          <TableCell>
                            {empresaComMenorValor ? (
                              <div>
                                <span className="font-semibold">{empresaComMenorValor.nome}</span>
                                <br />
                                <span className="text-green-600">
                                  R$ {menorValor.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => visualizarComparativo(comparativo.orcamentoId)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => confirmarExclusao(comparativo.id)}
                              >
                                <Trash className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <BarChart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Nenhum comparativo salvo</h2>
                <p className="text-gray-500 mb-4">
                  Você ainda não salvou nenhum comparativo de orçamentos para esta obra.
                </p>
              </Card>
            )}
          </div>

          {/* Seção de Orçamentos */}
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleNovoOrcamento} className="bg-primary hover:bg-primary-dark">
                <Plus className="w-4 h-4 mr-2" />
                Novo Orçamento
              </Button>
            </div>
            
            {orcamentos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orcamentos.map((orcamento) => (
                  <Card
                    key={orcamento.id}
                    className="p-6 hover:shadow-lg transition-shadow cursor-pointer relative"
                    onClick={() => handleVerOrcamento(orcamento.id)}
                  >
                    <div className="absolute top-4 right-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleEditarOrcamento(e, orcamento.id)}>
                            <Pen className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => handleExcluirOrcamento(e, orcamento.id)}
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{orcamento.nome}</h3>
                      <p className="text-sm text-gray-500 mt-1">{orcamento.descricao}</p>
                      <div className="mt-4">
                        <p className="text-sm font-medium">Valor Total: R$ {orcamento.valor_total}</p>
                        <p className="text-sm text-gray-500">Status: {orcamento.status}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este comparativo? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluirComparativo}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orcamentos;
