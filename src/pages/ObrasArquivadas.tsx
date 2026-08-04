import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArchiveRestore, MoreVertical, Image, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  desarquivarObra,
  listarObrasArquivadas,
  listarRegistrosDiario,
  type Obra,
} from "@/lib/api";
import { RegistroDiario } from "@/types/obra";

interface ObraArquivadaComProgresso extends Obra {
  progressoCalculado?: number;
}

const ObrasArquivadas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<ObraArquivadaComProgresso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarObrasArquivadas();
  }, []);

  const calcularProgresso = (registros: RegistroDiario[]) => {
    try {
      const todasEtapas = [
        "Servicos Preliminares", "Terraplenagem", "Fundacao", "Alvenaria", "Estrutura",
        "Passagens Eletricas", "Passagens Hidraulicas", "Laje", "Cobertura",
        "Instalacoes Eletricas", "Instalacoes Hidraulicas", "Reboco", "Regularizacao",
        "Revestimento", "Gesso", "Marmoraria", "Pintura", "Esquadrias", "Limpeza Bruta",
        "Marcenaria", "Metais", "Limpeza Final"
      ];

      const etapasStatus: { [key: string]: "pendente" | "em_andamento" | "concluida" } = {};
      todasEtapas.forEach((etapa) => {
        etapasStatus[etapa] = "pendente";
      });

      registros.forEach((registro) => {
        registro.etapas_iniciadas?.forEach((etapa) => {
          if (etapasStatus[etapa] !== "concluida") {
            etapasStatus[etapa] = "em_andamento";
          }
        });

        registro.etapas_concluidas?.forEach((etapa) => {
          etapasStatus[etapa] = "concluida";
        });
      });

      const etapasConcluidas = Object.values(etapasStatus).filter((status) => status === "concluida").length;
      return Math.round((etapasConcluidas / todasEtapas.length) * 100);
    } catch (error) {
      console.error("Erro ao calcular progresso:", error);
      return 0;
    }
  };

  const carregarObrasArquivadas = async () => {
    try {
      setLoading(true);
      const data = await listarObrasArquivadas();

      const obrasComProgresso = await Promise.all(
        (data || []).map(async (obra) => {
          try {
            const registros = await listarRegistrosDiario(obra.id);
            const progresso = calcularProgresso(registros);
            return { ...obra, progressoCalculado: progresso };
          } catch (error) {
            console.error(`Erro ao carregar registros da obra ${obra.id}:`, error);
            return { ...obra, progressoCalculado: obra.progresso };
          }
        })
      );

      setObras(obrasComProgresso);
    } catch (error) {
      console.error("Erro ao carregar obras arquivadas:", error);
      toast({
        title: "Erro ao carregar arquivadas",
        description: "Nao foi possivel carregar as obras arquivadas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDesarquivar = async (obraId: number, nomeObra: string) => {
    try {
      await desarquivarObra(obraId);
      await carregarObrasArquivadas();
      toast({
        title: "Obra desarquivada",
        description: `A obra \"${nomeObra}\" voltou para a lista principal.`,
      });
    } catch (error) {
      console.error("Erro ao desarquivar obra:", error);
      toast({
        title: "Erro ao desarquivar",
        description: "Nao foi possivel desarquivar a obra.",
        variant: "destructive",
      });
    }
  };

  const handleVerDetalhes = (obraId: number) => {
    navigate(`/obras/${obraId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Carregando obras arquivadas...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Obras Arquivadas</h1>
        <Button variant="outline" onClick={() => navigate('/obras')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Obras
        </Button>
      </div>

      {obras.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Nenhuma obra arquivada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {obras.map((obra) => (
            <Card key={obra.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  {obra.logo_url ? (
                    <div className="w-12 h-12 mr-3 rounded-md overflow-hidden">
                      <img
                        src={obra.logo_url}
                        alt={`Logo da obra ${obra.nome}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 mr-3 bg-gray-100 rounded-md flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold">{obra.nome}</h2>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleVerDetalhes(obra.id)}>
                      Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDesarquivar(obra.id, obra.nome)}>
                      <ArchiveRestore className="w-4 h-4 mr-2" />
                      Desarquivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Endereco:</span> {obra.endereco}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Progresso:</span> {obra.progressoCalculado || obra.progresso}%
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span>{" "}
                  {obra.status === "em_andamento" ? "Em andamento" :
                    obra.status === "concluido" ? "Concluido" :
                    obra.status === "pendente" ? "Pendente" :
                    String(obra.status)}
                </p>
                <div className="mt-2">
                  <Progress value={obra.progressoCalculado || obra.progresso} className="h-2" />
                </div>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDesarquivar(obra.id, obra.nome)}
                >
                  <ArchiveRestore className="h-4 w-4 mr-2" /> Desarquivar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ObrasArquivadas;
