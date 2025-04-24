import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Eye, Trash } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
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

const ComparativosSalvos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [comparativos, setComparativos] = useState<ComparativoSalvo[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [comparativoParaExcluir, setComparativoParaExcluir] = useState<string | null>(null);

  useEffect(() => {
    carregarComparativos();
  }, []);

  const carregarComparativos = () => {
    try {
      const comparativosSalvos = JSON.parse(
        localStorage.getItem("comparativos") || "[]"
      );
      setComparativos(comparativosSalvos);
    } catch (error) {
      console.error("Erro ao carregar comparativos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os comparativos salvos.",
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

      const comparativosFiltrados = comparativos.filter(
        comp => comp.id !== comparativoParaExcluir
      );
      
      localStorage.setItem("comparativos", JSON.stringify(comparativosFiltrados));
      setComparativos(comparativosFiltrados);
      
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/orcamentos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Comparativos Salvos</h1>
        </div>
      </div>

      {comparativos.length === 0 ? (
        <Card className="p-6 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhum comparativo salvo</h2>
          <p className="text-gray-500 mb-4">
            Você ainda não salvou nenhum comparativo de orçamentos.
          </p>
          <Button onClick={() => navigate("/orcamentos")}>
            Ir para Orçamentos
          </Button>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Seus Comparativos</h2>
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
              {comparativos.map((comparativo) => {
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

export default ComparativosSalvos; 