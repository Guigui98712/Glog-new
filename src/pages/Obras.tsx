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
import { Plus, MoreVertical, Pencil, Trash2, Upload, Image, Search, Building, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { 
  listarObrasComAcesso,
  criarObra, 
  atualizarObra, 
  excluirObraSegura, 
  uploadFoto,
  listarRegistrosDiario,
  type Obra,
  type ObraParaEnvio,
  compartilharObra
} from "@/lib/api";
import { RegistroDiario } from "@/types/obra";
import { LocalNotifications } from '@capacitor/local-notifications';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Interface estendida para incluir o progresso calculado
interface ObraComProgresso extends Obra {
  progressoCalculado?: number;
  compartilhada?: boolean;
  permissao_compartilhamento?: string | null;
  obra_origem_id?: number;
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

  const [novaObraNome, setNovaObraNome] = useState("");
  const [novaObraEndereco, setNovaObraEndereco] = useState("");
  const [novaObraObservacoes, setNovaObraObservacoes] = useState("");
  const [novaObraCustoPrevisto, setNovaObraCustoPrevisto] = useState(0);
  const [novaObraCliente, setNovaObraCliente] = useState("");
  const [novaObraResponsavel, setNovaObraResponsavel] = useState("");
  const [novaObraDataPrevisaoFim, setNovaObraDataPrevisaoFim] = useState("");
  const [novaObraViagem, setNovaObraViagem] = useState(false);
  const [logoNovaObraFile, setLogoNovaObraFile] = useState<File | null>(null);
  const [logoNovaObraPreview, setLogoNovaObraPreview] = useState<string | null>(null);
  const [salvandoNovaObra, setSalvandoNovaObra] = useState(false);

  const [obraEmEdicao, setObraEmEdicao] = useState<Obra | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [logoEditFile, setLogoEditFile] = useState<File | null>(null);
  const [logoEditPreview, setLogoEditPreview] = useState<string | null>(null);
  const [logoEditRemovido, setLogoEditRemovido] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [compartilharObraId, setCompartilharObraId] = useState<number | null>(null);
  const [compartilharEmail, setCompartilharEmail] = useState("");
  const [compartilharDialogOpen, setCompartilharDialogOpen] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => {
    carregarObras();
  }, []);

  const carregarObras = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DEBUG] Carregando obras...');

      const data = await listarObrasComAcesso();
      console.log('[DEBUG] Obras carregadas:', data);
      
      if (data && Array.isArray(data)) {
        console.log('[DEBUG] Atualizando estado com', data.length, 'obras');
        
        // Carregar os registros do diário para cada obra para calcular o progresso real
        const obrasComProgresso = await Promise.all(
          data.map(async (obra) => {
            try {
              const obraId = obra.obra_origem_id || obra.id;
              const registros = await listarRegistrosDiario(obraId);
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
    if (!novaObraNome || !novaObraEndereco) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios: nome e endereço.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSalvandoNovaObra(true);
      let logoNovaObraUrl: string | null = null;
      if (logoNovaObraFile) {
        logoNovaObraUrl = await uploadFoto(logoNovaObraFile);
      }

      const novaObraData: ObraParaEnvio = {
        nome: novaObraNome,
        endereco: novaObraEndereco,
        viagem_fora_cidade: novaObraViagem,
        custo_real: 0,
        progresso: 0,
        status: 'em_andamento' as const,
        cliente: novaObraCliente || null,
        responsavel: novaObraResponsavel || null,
        logo_url: logoNovaObraUrl,
        data_inicio: null,
        data_previsao_fim: novaObraDataPrevisaoFim ? `${novaObraDataPrevisaoFim}-01` : null,
        user_id: null, // Será preenchido automaticamente pelo backend
        trello_board_id: null
      };

      console.log('[DEBUG] Enviando dados para criação da obra:', novaObraData);

      const obraCriada = await criarObra(novaObraData);

      // Forçar recarregamento completo das obras
      await carregarObras();
      
      setNovaObraNome("");
      setNovaObraEndereco("");
      setNovaObraObservacoes("");
      setNovaObraCustoPrevisto(0);
      setNovaObraCliente("");
      setNovaObraResponsavel("");
      setNovaObraDataPrevisaoFim("");
      setNovaObraViagem(false);
      setLogoNovaObraFile(null);
      setLogoNovaObraPreview(null);
      setShowDialog(false);
      
      toast({
        title: "Obra criada com sucesso! 🏗️",
        description: `A obra "${novaObraNome}" foi criada e já está disponível no sistema.`
      });
    } catch (error) {
      console.error('Erro ao criar obra:', error);
      toast({
        title: "Erro ao criar obra",
        description: "Não foi possível criar a obra. Verifique os dados e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSalvandoNovaObra(false);
    }
  };

  const handleEditarObra = (obra: Obra) => {
    setObraEmEdicao(obra);
    setLogoEditPreview(obra.logo_url);
    setLogoEditFile(null);
    setLogoEditRemovido(false);
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
      let logoUrl = logoEditRemovido ? null : obraEmEdicao.logo_url;
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
      await carregarObras();
      
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

  const abrirDialogCompartilhar = (obraId: number) => {
    setCompartilharObraId(obraId);
    setCompartilharEmail("");
    setCompartilharDialogOpen(true);
  };

  const handleCompartilharObra = async () => {
    if (!compartilharObraId || !compartilharEmail) {
      toast({
        title: "Preencha o e-mail",
        description: "Informe o e-mail de quem vai receber o acesso.",
        variant: "destructive"
      });
      return;
    }
    setCompartilhando(true);
    try {
      await compartilharObra(compartilharObraId, compartilharEmail);
      toast({
        title: "Obra compartilhada!",
        description: `A obra foi compartilhada com ${compartilharEmail}`
      });
      setCompartilharDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao compartilhar",
        description: error.message || "Não foi possível compartilhar a obra.",
        variant: "destructive"
      });
    } finally {
      setCompartilhando(false);
    }
  };

  const obrasProprias = obras.filter((obra) => !obra.compartilhada);
  const obrasCompartilhadas = obras.filter((obra) => obra.compartilhada);

  const renderObraCard = (obra: ObraComProgresso) => (
    <Card key={`${obra.compartilhada ? 'compartilhada' : 'propria'}-${obra.id}`} className="p-6 hover:shadow-lg transition-shadow">
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
            <DropdownMenuItem onClick={() => handleVerDetalhes(obra.obra_origem_id || obra.id)}>
              Ver Detalhes
            </DropdownMenuItem>
            {(!obra.compartilhada || obra.permissao_compartilhamento !== 'visualizar') && (
              <DropdownMenuItem onClick={() => handleEditarObra(obra)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
            )}
            {!obra.compartilhada && (
              <DropdownMenuItem onClick={() => handleExcluirObra(obra.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            )}
            {!obra.compartilhada && (
              <DropdownMenuItem onClick={() => abrirDialogCompartilhar(obra.id)}>
                Compartilhar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-2">
        {obra.compartilhada && (
          <p className="text-xs font-medium text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded">
            Compartilhada com você
          </p>
        )}
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
          onClick={() => handleVerDetalhes(obra.obra_origem_id || obra.id)}
        >
          Ver Detalhes
        </Button>
      </div>
    </Card>
  );

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
        <h1 className="text-3xl font-bold">Obras</h1>
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
        <div className="space-y-8">
          {obrasProprias.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Obras</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {obrasProprias.map(renderObraCard)}
              </div>
            </section>
          )}

          {obrasCompartilhadas.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Compartilhadas com você</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {obrasCompartilhadas.map(renderObraCard)}
              </div>
            </section>
          )}
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
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome da Obra</Label>
                <Input
                  id="edit-nome"
                  value={obraEmEdicao?.nome || ''}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, nome: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, nome: capitalizarPrimeiraLetra(e.target.value)} : null)}
                  placeholder="Ex: Reforma Apartamento Moema"
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endereco">Endereço</Label>
                <Input
                  id="edit-endereco"
                  value={obraEmEdicao?.endereco || ''}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, endereco: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, endereco: capitalizarPrimeiraLetra(e.target.value)} : null)}
                  placeholder="Ex: Rua das Palmeiras, 123"
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-observacoes">Observações</Label>
                <Textarea
                  id="edit-observacoes"
                  value={obraEmEdicao?.observacoes || ''}
                  onChange={(e) => setObraEmEdicao(prev => prev ? { ...prev, observacoes: e.target.value } : null)}
                  onBlur={(e) => setObraEmEdicao(prev => prev ? { ...prev, observacoes: capitalizarPrimeiraLetra(e.target.value)} : null)}
                  placeholder="Detalhes adicionais sobre a obra"
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
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
                              setLogoEditRemovido(false);
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
                      <button
                        type="button"
                        onClick={() => {
                          setLogoEditFile(null);
                          setLogoEditPreview(null);
                          setLogoEditRemovido(true);
                        }}
                        className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 text-red-600 hover:text-red-700"
                        title="Remover logo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
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

      {/* Dialog para nova obra */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Obra</Label>
              <Input
                id="nome"
                value={novaObraNome}
                onChange={(e) => setNovaObraNome(e.target.value)}
                onBlur={(e) => setNovaObraNome(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Ex: Construção Casa Térrea"
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={novaObraEndereco}
                onChange={(e) => setNovaObraEndereco(e.target.value)}
                onBlur={(e) => setNovaObraEndereco(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Ex: Av. Principal, 456, Bairro Centro"
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={novaObraObservacoes}
                onChange={(e) => setNovaObraObservacoes(e.target.value)}
                onBlur={(e) => setNovaObraObservacoes(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Informações relevantes sobre a obra"
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Viagens</label>
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={novaObraViagem}
                    onChange={e => setNovaObraViagem(e.target.checked)}
                    className="accent-primary"
                  />
                  Fora da cidade
                </label>
                <span className="text-xs text-muted-foreground">Marque se a obra for fora da cidade</span>
              </div>
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
                        setLogoNovaObraFile(file);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setLogoNovaObraPreview(event.target?.result as string);
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

                {logoNovaObraPreview && (
                  <div className="relative w-16 h-16">
                    <img
                      src={logoNovaObraPreview}
                      alt="Preview do logo"
                      className="w-full h-full object-cover rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoNovaObraFile(null);
                        setLogoNovaObraPreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 text-red-600 hover:text-red-700"
                      title="Remover logo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleNovaObra} disabled={salvandoNovaObra}>
              {salvandoNovaObra ? 'Salvando...' : 'Salvar Obra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para compartilhar obra */}
      <Dialog open={compartilharDialogOpen} onOpenChange={setCompartilharDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar Obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="email"
              placeholder="E-mail do colaborador"
              value={compartilharEmail}
              onChange={e => setCompartilharEmail(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCompartilharObra} disabled={compartilhando || !compartilharEmail}>
              {compartilhando ? "Compartilhando..." : "Compartilhar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Obras;
