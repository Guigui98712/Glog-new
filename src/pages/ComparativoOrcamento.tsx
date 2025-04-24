import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, SplitSquareHorizontal, Save, Check } from "lucide-react";
import type { Orcamento } from "@/types/orcamento";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useToast } from "@/components/ui/use-toast";

// Interface para o comparativo salvo
interface ComparativoSalvo {
  id: string;
  data: string;
  orcamentoId: number;
  orcamentoNome: string;
  empresas: any[];
  obraId: number;
}

const ComparativoOrcamento = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const orcamentosSalvos = JSON.parse(
      localStorage.getItem("orcamentos") || "[]"
    );
    const orcamentoEncontrado = orcamentosSalvos.find(
      (orc: Orcamento) => orc.id === Number(id)
    );

    if (orcamentoEncontrado) {
      setOrcamento(orcamentoEncontrado);
      
      // Verificar se este comparativo já foi salvo
      const comparativosSalvos = JSON.parse(
        localStorage.getItem("comparativos") || "[]"
      );
      const comparativoExistente = comparativosSalvos.find(
        (comp: ComparativoSalvo) => comp.orcamentoId === Number(id)
      );
      
      if (comparativoExistente) {
        setSalvo(true);
      }
    }
  }, [id]);

  if (!orcamento) {
    return <div>Carregando...</div>;
  }

  const calcularTotalPlanilha = (planilhaData: any[]) => {
    if (!planilhaData || !Array.isArray(planilhaData)) {
      return 0;
    }
    
    return planilhaData.reduce((total: number, row: any) => {
      if (!row || typeof row !== 'object') {
        return total;
      }
      
      const valorNumerico = Object.values(row).find(
        (value) => typeof value === "number"
      );
      return total + (valorNumerico || 0);
    }, 0);
  };

  const empresasComTotaisAtualizados = orcamento.empresas.map(empresa => ({
    ...empresa,
    valor: empresa.planilhaData ? calcularTotalPlanilha(empresa.planilhaData) : empresa.valor
  }));

  const dadosGrafico = empresasComTotaisAtualizados.map((empresa) => ({
    name: empresa.nome || 'Sem nome',
    valor: empresa.valor || 0,
  }));

  const menorValor = empresasComTotaisAtualizados.length > 0 
    ? Math.min(...empresasComTotaisAtualizados.map((emp) => emp.valor || 0))
    : 0;

  const empresasComPlanilha = empresasComTotaisAtualizados.filter(
    (emp) => emp.planilhaData && Array.isArray(emp.planilhaData) && emp.planilhaData.length > 0
  );

  // Função para normalizar uma string para comparação
  const normalizeString = (str: string | null | undefined) => {
    if (str === null || str === undefined) {
      return '';
    }
    return String(str).toLowerCase().trim();
  };

  // Função para comparar se duas linhas são iguais baseado apenas nos itens (desconsiderando valores)
  const linhasSaoIguais = (linha1: any, linha2: any) => {
    if (!linha1 || !linha2 || typeof linha1 !== 'object' || typeof linha2 !== 'object') {
      return false;
    }
    
    // Pega a primeira chave que geralmente é a descrição do item
    const keys1 = Object.keys(linha1);
    const keys2 = Object.keys(linha2);
    
    if (keys1.length === 0 || keys2.length === 0) {
      return false;
    }
    
    const descricaoKey1 = keys1[0];
    const descricaoKey2 = keys2[0];
    
    return normalizeString(linha1[descricaoKey1]) === normalizeString(linha2[descricaoKey2]);
  };

  // Função para salvar o comparativo
  const salvarComparativo = () => {
    try {
      // Obter comparativos salvos
      const comparativosSalvos = JSON.parse(
        localStorage.getItem("comparativos") || "[]"
      );
      
      // Verificar se já existe um comparativo para este orçamento
      const comparativoExistente = comparativosSalvos.findIndex(
        (comp: ComparativoSalvo) => comp.orcamentoId === Number(id)
      );
      
      // Criar o novo comparativo
      const novoComparativo: ComparativoSalvo = {
        id: Date.now().toString(),
        data: new Date().toISOString(),
        orcamentoId: Number(id),
        orcamentoNome: orcamento.nome,
        empresas: empresasComTotaisAtualizados,
        obraId: orcamento.obraId
      };
      
      // Adicionar ou atualizar o comparativo
      if (comparativoExistente >= 0) {
        comparativosSalvos[comparativoExistente] = novoComparativo;
      } else {
        comparativosSalvos.push(novoComparativo);
      }
      
      // Salvar no localStorage
      localStorage.setItem("comparativos", JSON.stringify(comparativosSalvos));
      
      // Atualizar estado
      setSalvo(true);
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Comparativo salvo",
        description: "O comparativo foi salvo com sucesso e pode ser acessado posteriormente.",
      });
    } catch (error) {
      console.error("Erro ao salvar comparativo:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o comparativo. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/orcamentos?obraId=${orcamento.obraId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">{orcamento.nome}</h1>
        </div>
        
        <Button 
          onClick={salvarComparativo} 
          disabled={salvo}
          variant={salvo ? "outline" : "default"}
        >
          {salvo ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Salvo
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Comparativo
            </>
          )}
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Gráfico Comparativo</h2>
        <div className="h-[400px] -mx-4 sm:mx-0">
          {dadosGrafico.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGrafico}
                margin={{
                  top: 20,
                  right: 20,
                  left: 20,
                  bottom: 60
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{
                    fontSize: 12
                  }}
                />
                <YAxis
                  width={80}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px'
                  }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: '20px'
                  }}
                />
                <Bar
                  dataKey="valor"
                  fill="#3b82f6"
                  name="Valor do Orçamento"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Não há dados suficientes para exibir o gráfico</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {empresasComTotaisAtualizados.map((empresa, index) => (
          <Card
            key={index}
            className={`p-6 ${
              empresa.valor === menorValor ? "border-2 border-green-500" : ""
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{empresa.nome}</h3>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  R$ {empresa.valor.toLocaleString()}
                </p>
              </div>
              {empresa.valor === menorValor && (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  Menor valor
                </span>
              )}
            </div>

            {empresa.observacoes && (
              <div className="mt-4">
                <h4 className="font-medium text-sm text-gray-600 mb-1">
                  Observações
                </h4>
                <p className="text-gray-600">{empresa.observacoes}</p>
              </div>
            )}

            {empresa.planilhaUrl && (
              <div className="mt-4">
                <Button variant="outline" className="w-full" disabled>
                  <SplitSquareHorizontal className="h-4 w-4 mr-2" />
                  {empresa.planilhaUrl}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {empresasComPlanilha.length >= 2 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Comparativo de Planilhas
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {empresasComPlanilha.slice(0, 2).map((empresa, index) => {
              const outraEmpresa = empresasComPlanilha[index === 0 ? 1 : 0];
              
              // Verificar se a planilha tem dados
              if (!empresa.planilhaData || !empresa.planilhaData.length || !outraEmpresa.planilhaData || !outraEmpresa.planilhaData.length) {
                return (
                  <div key={index} className="p-4 border rounded">
                    <p>Dados da planilha não disponíveis para {empresa.nome}</p>
                  </div>
                );
              }
              
              return (
                <div key={index} className="overflow-x-auto">
                  <h3 className="font-semibold mb-2">{empresa.nome}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(empresa.planilhaData[0] || {}).map(
                          (header, i) => (
                            <TableHead key={i}>{header}</TableHead>
                          )
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresa.planilhaData.map((row: any, rowIndex: number) => {
                        if (!row || typeof row !== 'object') {
                          return null;
                        }
                        
                        const keys = Object.keys(row);
                        if (!keys.length) {
                          return null;
                        }
                        
                        const descricaoKey = keys[0];
                        const itemEncontrado = outraEmpresa.planilhaData.find(
                          (outraLinha: any) => linhasSaoIguais(row, outraLinha)
                        );
                        
                        return (
                          <TableRow 
                            key={rowIndex}
                            className={!itemEncontrado ? "bg-yellow-100" : ""}
                          >
                            {Object.entries(row).map(([key, value]: [string, any], i: number) => (
                              <TableCell key={i}>
                                {typeof value === "number"
                                  ? value.toLocaleString()
                                  : value}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-blue-50">
                        <TableCell colSpan={Object.keys(empresa.planilhaData[0] || {}).length - 1}>
                          Total
                        </TableCell>
                        <TableCell className="font-bold">
                          R$ {empresa.valor.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ComparativoOrcamento;

