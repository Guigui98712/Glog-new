import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, Upload, Image, Search, Building, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { 
  listarObras, 
  criarObra, 
  atualizarObra, 
  excluirObraSegura, 
  uploadFoto,
  listarRegistrosDiario,
  type Obra,
  type ObraParaEnvio
} from "@/lib/api";
import { RegistroDiario } from "@/types/obra";
import { LocalNotifications } from '@capacitor/local-notifications';

// Interface estendida para incluir o progresso calculado
interface ObraComProgresso extends Obra {
  progressoCalculado?: number;
}

// Função para capitalizar a primeira letra de cada frase
const capitalizarPrimeiraLetra = (texto: string) => {
  if (!texto) return texto;
  const frases = texto.split(/([.!?]\s+)/).filter(Boolean);
  return frases.map((frase, index) => {
    if (index % 2 === 0) { // É uma frase
      return frase.charAt(0).toUpperCase() + frase.slice(1);
    }
    return frase; // É um separador (.!? )
  }).join('');
};

const Obras = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<ObraComProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const [novaObra, setNovaObra] = useState({
    nome: "",
    endereco: "",
    custo_previsto: 0,
    cliente: "",
    responsavel: "",
    data_previsao_fim: ""
  });

  const [obraEmEdicao, setObraEmEdicao] = useState<Obra | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [logoEditFile, setLogoEditFile] = useState<File | null>(null);
  const [logoEditPreview, setLogoEditPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    carregarObras();
  }, []);

  const carregarObras = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DEBUG] Carregando obras...');

      const data = await listarObras();
      console.log('[DEBUG] Obras carregadas:', data);
      
      if (data && Array.isArray(data)) {
        console.log('[DEBUG] Atualizando estado com', data.length, 'obras');
        
        // Carregar os registros do diário para cada obra para calcular o progresso real
        const obrasComProgresso = await Promise.all(
          data.map(async (obra) => {
            try {
              const registros = await listarRegistrosDiario(obra.id);
              const progresso = calcularProgresso(registros);
              return { ...obra, progressoCalculado: progresso };
            } catch (error) {
              console.error(`[DEBUG] Erro ao carregar registros da obra ${obra.id}:`, error);
              return { ...obra, progressoCalculado: obra.progresso };
            }
          })
        );
        
        setObras(obrasComProgresso);
      } else {
        console.log('[DEBUG] Nenhuma obra encontrada ou formato inválido:', data);
        setObras([]);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar obras:', error);
      setError('Não foi possível carregar as obras. Por favor, tente novamente.');
      toast({
        title: "Erro ao carregar obras",
        description: "Não foi possível carregar a lista de obras. Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para calcular o progresso baseado nos registros do diário
  const calcularProgresso = (registros: RegistroDiario[]) => {
    try {
      const todasEtapas = [
        'Serviços Preliminares', 'Terraplenagem', 'Fundação', 'Alvenaria', 'Estrutura',
        'Passagens Elétricas', 'Passagens Hidráulicas', 'Laje', 'Cobertura',
        'Instalações Elétricas', 'Instalações Hidráulicas', 'Reboco', 'Regularização',
        'Revestimento', 'Gesso', 'Marmoraria', 'Pintura', 'Esquadrias', 'Limpeza Bruta',
        'Marcenaria', 'Metais', 'Limpeza Final'
      ];

      const etapasStatus: { [key: string]: 'pendente' | 'em_andamento' | 'concluida' } = {};
      todasEtapas.forEach(etapa => {
        etapasStatus[etapa] = 'pendente';
      });

      registros.forEach(registro => {
        registro.etapas_iniciadas?.forEach(etapa => {
          if (etapasStatus[etapa] !== 'concluida') {
            etapasStatus[etapa] = 'em_andamento';
          }
        });

        registro.etapas_concluidas?.forEach(etapa => {
          etapasStatus[etapa] = 'concluida';
        });
      });

      const etapasConcluidas = Object.values(etapasStatus).filter(status => status === 'concluida').length;
      return Math.round((etapasConcluidas / todasEtapas.length) * 100);
    } catch (error) {
      console.error('Erro ao calcular progresso:', error);
      return 0;
    }
  };

  const handleVerDetalhes = (obraId: number) => {
    navigate(`/obras/${obraId}`);
  };

  const handleNovaObra = async () => {
    if (!novaObra.nome || !novaObra.endereco || !novaObra.custo_previsto) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios: nome, endereço e custo previsto.",
        variant: "destructive"
      });
      return;
    }

    try {
      const novaObraData: ObraParaEnvio = {
        nome: novaObra.nome,
        endereco: novaObra.endereco,
        custo_previsto: novaObra.custo_previsto,
        custo_real: 0,
        progresso: 0,
        status: 'em_andamento' as const,
        cliente: novaObra.cliente || null,
        responsavel: novaObra.responsavel || null,
        logo_url: null,
        data_inicio: null,
        data_previsao_fim: novaObra.data_previsao_fim ? `${novaObra.data_previsao_fim}-01` : null,
        user_id: null, // Será preenchido automaticamente pelo backend
        trello_board_id: null
      };

      console.log('[DEBUG] Enviando dados para criação da obra:', novaObraData);

      const obraCriada = await criarObra(novaObraData);

      // Forçar recarregamento completo das obras
      const obrasAtualizadas = await listarObras();
      console.log('[DEBUG] Obras recarregadas após criação:', obrasAtualizadas);
      setObras(obrasAtualizadas || []);
      
      setNovaObra({ 
        nome: "", 
        endereco: "", 
        custo_previsto: 0, 
        cliente: "", 
        responsavel: "", 
        data_previsao_fim: ""
      });
      setShowDialog(false);
      
      toast({
        title: "Obra criada com sucesso! 🏗️",
        description: `A obra "${novaObra.nome}" foi criada e já está disponível no sistema.`
      });
    } catch (error) {
      console.error('Erro ao criar obra:', error);
      toast({
        title: "Erro ao criar obra",
        description: "Não foi possível criar a obra. Verifique os dados e tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEditarObra = (obra: Obra) => {
    setObraEmEdicao(obra);
    setLogoEditPreview(obra.logo_url);
    setShowEditDialog(true);
  };

  const handleSalvarEdicao = async () => {
    console.log('[DEBUG] Função handleSalvarEdicao chamada');
    if (!obraEmEdicao) {
      console.log('[DEBUG] obraEmEdicao é null ou undefined');
      return;
    }

    console.log('[DEBUG] Dados da obra em edição:', obraEmEdicao);

    try {
      setUploadingLogo(true);
      console.log('[DEBUG] Iniciando upload do logo (se houver)');
      
      // Upload do logo se existir
      let logoUrl = obraEmEdicao.logo_url;
      if (logoEditFile) {
        console.log('[DEBUG] Enviando novo logo');
        const resultado = await uploadFoto(logoEditFile);
        logoUrl = resultado;
        console.log('[DEBUG] Logo enviado com sucesso:', logoUrl);
      }
      
      console.log('[DEBUG] Enviando dados para atualização da obra');
      const dadosAtualizacao: Partial<ObraParaEnvio> = {
        nome: obraEmEdicao.nome,
        endereco: obraEmEdicao.endereco,
        custo_previsto: obraEmEdicao.custo_previsto,
        custo_real: obraEmEdicao.custo_real,
        progresso: obraEmEdicao.progresso,
        status: obraEmEdicao.status,
        cliente: obraEmEdicao.cliente,
        responsavel: obraEmEdicao.responsavel,
        logo_url: logoUrl,
        data_inicio: obraEmEdicao.data_inicio,
        data_previsao_fim: obraEmEdicao.data_previsao_fim ? 
          (obraEmEdicao.data_previsao_fim.length === 7 ? `${obraEmEdicao.data_previsao_fim}-01` : obraEmEdicao.data_previsao_fim) : 
          null
      };
      console.log('[DEBUG] Dados de atualização:', dadosAtualizacao);
      
      const obraAtualizada = await atualizarObra(obraEmEdicao.id, dadosAtualizacao);
      console.log('[DEBUG] Obra atualizada com sucesso:', obraAtualizada);

      // Forçar recarregamento completo das obras
      const obrasAtualizadas = await listarObras();
      console.log('[DEBUG] Obras recarregadas após atualização:', obrasAtualizadas);
      setObras(obrasAtualizadas || []);
      
      setObraEmEdicao(null);
      setLogoEditFile(null);
      setLogoEditPreview(null);
      setShowEditDialog(false);
      
      toast({
        title: "Obra atualizada! ✅",
        description: `As informações da obra "${obraEmEdicao.nome}" foram atualizadas com sucesso.`
      });
    } catch (error) {
      console.error('[DEBUG] Erro ao atualizar obra:', error);
      toast({
        title: "Erro na atualização",
        description: "Não foi possível atualizar as informações da obra. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleExcluirObra = async (obraId: number) => {
    try {
      console.log('[DEBUG] Iniciando exclusão da obra:', obraId);
      
      // Mostrar toast de carregamento
      toast({
        title: "Excluindo obra...",
        description: "Aguarde enquanto excluímos a obra e seus registros relacionados.",
      });
      
      await excluirObraSegura(obraId);
      await carregarObras();
      
      toast({
        title: "Obra excluída! 🗑️",
        description: "A obra e todos os seus registros foram removidos permanentemente do sistema."
      });
    } catch (error: any) {
      console.error('Erro ao excluir obra:', error);
      
      // Mensagem de erro mais detalhada
      let mensagemErro = "Não foi possível excluir a obra.";
      
      if (error.message) {
        if (error.message.includes('foreign key constraint')) {
          mensagemErro = "Esta obra possui registros relacionados que não puderam ser excluídos automaticamente.";
        } else {
          mensagemErro = `Erro: ${error.message}`;
        }
      }
      
      toast({
        title: "Erro ao excluir",
        description: mensagemErro,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Carregando obras...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Minhas Obras</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Obra
          </Button>
        </div>
      </div>

      {obras.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Nenhuma obra cadastrada</p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Primeira Obra
          </Button>
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
                    <DropdownMenuItem onClick={() => handleEditarObra(obra)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExcluirObra(obra.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Endereço:</span> {obra.endereco}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Progresso:</span> {obra.progressoCalculado || obra.progresso}%
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span>{" "}
                  {obra.status === 'em_andamento' ? 'Em andamento' : 
                   obra.status === 'concluido' ? 'Concluído' : 
                   obra.status === 'pendente' ? 'Pendente' : 
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
                  onClick={() => handleVerDetalhes(obra.id)}
                >
                  Ver Detalhes
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para edição de obra */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Obra</DialogTitle>
          </DialogHeader>
          {obraEmEdicao && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Nome da Obra</label>
                <Input
                  value={obraEmEdicao.nome}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, nome: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, nome: capitalizarPrimeiraLetra(e.target.value) } : null)}
                  placeholder="Digite o nome da obra"
                  spellCheck="true"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  lang="pt-BR"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Endereço</label>
                <Input
                  value={obraEmEdicao.endereco}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, endereco: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, endereco: capitalizarPrimeiraLetra(e.target.value) } : null)}
                  placeholder="Digite o endereço da obra"
                  spellCheck="true"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  lang="pt-BR"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  value={obraEmEdicao.cliente || ''}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, cliente: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, cliente: capitalizarPrimeiraLetra(e.target.value) } : null)}
                  placeholder="Digite o nome do cliente"
                  spellCheck="true"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  lang="pt-BR"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Input
                  value={obraEmEdicao.responsavel || ''}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, responsavel: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, responsavel: capitalizarPrimeiraLetra(e.target.value) } : null)}
                  placeholder="Digite o nome do responsável"
                  spellCheck="true"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  lang="pt-BR"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Logo da Obra</label>
                <div className="flex items-center space-x-4">
                  <label className="cursor-pointer border border-dashed border-gray-300 rounded-md p-4 hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setLogoEditFile(file);
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setLogoEditPreview(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center">
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Selecionar imagem</span>
                    </div>
                  </label>
                  {logoEditPreview && (
                    <div className="relative w-16 h-16">
                      <img
                        src={logoEditPreview}
                        alt="Preview do logo"
                        className="w-full h-full object-cover rounded-md"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Button 
                onClick={(e) => {
                  console.log('[DEBUG] Evento onClick do botão Salvar Alterações acionado');
                  e.preventDefault(); // Prevenir comportamento padrão
                  handleSalvarEdicao();
                }} 
                onMouseDown={() => console.log('[DEBUG] Botão Salvar Alterações recebeu clique (mousedown)')}
                className="w-full"
                disabled={uploadingLogo}
                type="button" // Garantir que é um botão normal, não de submit
              >
                {uploadingLogo ? "Salvando..." : "Salvar Alterações"}
              </Button>
              
              <Button 
                onClick={() => {
                  console.log('[DEBUG] Botão alternativo clicado');
                  if (!obraEmEdicao) {
                    console.log('[DEBUG] obraEmEdicao é null');
                    return;
                  }
                  handleExcluirObra(obraEmEdicao.id);
                  setShowEditDialog(false);
                }}
                variant="destructive"
                className="w-full mt-2"
              >
                Excluir Obra
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Obras;
