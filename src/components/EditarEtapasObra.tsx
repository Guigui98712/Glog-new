import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Save, X, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import FluxogramaObra from './FluxogramaObra';
import { supabase } from '@/lib/supabase';
import { Node } from 'reactflow';
import { Label } from '@/components/ui/label';

interface EtapaConfig {
  id: string;
  nome: string;
  position: { x: number; y: number };
}

interface EditarEtapasObraProps {
  obraId: number;
  onClose: () => void;
  onSave: () => void;
}

const EditarEtapasObra: React.FC<EditarEtapasObraProps> = ({ obraId, onClose, onSave }) => {
  const { toast } = useToast();
  const [etapas, setEtapas] = useState<EtapaConfig[]>([]);
  const [etapaAtual, setEtapaAtual] = useState<EtapaConfig | null>(null);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Registros vazios para o fluxograma em modo de edição
  const registrosVazios = [{ data: '', etapas_iniciadas: [], etapas_concluidas: [] }];

  useEffect(() => {
    carregarEtapas();
    
    // Adicionar evento para fechar o menu de contexto quando clicar fora dele
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [obraId]);

  const carregarEtapas = async () => {
    try {
      setLoading(true);
      
      // Buscar etapas da obra do banco de dados
      const { data: etapasDatas, error } = await supabase
        .from('etapas_fluxograma')
        .select('*')
        .eq('obra_id', obraId);

      if (error) {
        throw error;
      }

      // Se houver etapas cadastradas, usar essas etapas
      if (etapasDatas && etapasDatas.length > 0) {
        const etapasConfig = etapasDatas.map(etapa => ({
          id: etapa.id.toString(),
          nome: etapa.nome,
          position: etapa.position || { x: 0, y: 0 }
        }));
        setEtapas(etapasConfig);
      } else {
        // Se não houver etapas cadastradas, usar as etapas padrão
        const etapasConfig = getEtapasConfigPadrao(false);
        setEtapas(etapasConfig);
      }
    } catch (error) {
      console.error('Erro ao carregar etapas:', error);
      toast({
        title: "Erro ao carregar etapas",
        description: "Não foi possível carregar as etapas da obra.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para obter a configuração padrão das etapas
  const getEtapasConfigPadrao = (isMobile: boolean) => {
    const horizontalSpacing = isMobile ? 150 : 200;
    const verticalSpacing = isMobile ? 70 : 100;
    
    return [
      { id: '1', nome: 'Serviços Preliminares', position: { x: 0 * horizontalSpacing, y: 0 } },
      { id: '2', nome: 'Terraplenagem', position: { x: 1 * horizontalSpacing, y: 0 } },
      { id: '3', nome: 'Fundação', position: { x: 2 * horizontalSpacing, y: 0 } },
      { id: '4', nome: 'Alvenaria', position: { x: 3 * horizontalSpacing, y: -0.5 * verticalSpacing } },
      { id: '5', nome: 'Estrutura', position: { x: 3 * horizontalSpacing, y: 0.5 * verticalSpacing } },
      { id: '6', nome: 'Passagens Elétricas', position: { x: 4 * horizontalSpacing, y: -1 * verticalSpacing } },
      { id: '7', nome: 'Passagens Hidráulicas', position: { x: 4 * horizontalSpacing, y: 0 } },
      { id: '8', nome: 'Laje', position: { x: 4 * horizontalSpacing, y: 1 * verticalSpacing } },
      { id: '9', nome: 'Cobertura', position: { x: 5 * horizontalSpacing, y: -1 * verticalSpacing } },
      { id: '10', nome: 'Instalações Elétricas', position: { x: 5 * horizontalSpacing, y: 0 } },
      { id: '11', nome: 'Instalações Hidráulicas', position: { x: 5 * horizontalSpacing, y: 1 * verticalSpacing } },
      { id: '12', nome: 'Reboco', position: { x: 6 * horizontalSpacing, y: -0.5 * verticalSpacing } },
      { id: '13', nome: 'Regularização', position: { x: 6 * horizontalSpacing, y: 0.5 * verticalSpacing } },
      { id: '14', nome: 'Revestimento', position: { x: 7 * horizontalSpacing, y: -1 * verticalSpacing } },
      { id: '15', nome: 'Gesso', position: { x: 7 * horizontalSpacing, y: 0 } },
      { id: '16', nome: 'Marmoraria', position: { x: 7 * horizontalSpacing, y: 1 * verticalSpacing } },
      { id: '17', nome: 'Pintura', position: { x: 8 * horizontalSpacing, y: 0 } },
      { id: '18', nome: 'Esquadrias', position: { x: 9 * horizontalSpacing, y: 0 } },
      { id: '19', nome: 'Limpeza Bruta', position: { x: 10 * horizontalSpacing, y: 0 } },
      { id: '20', nome: 'Marcenaria', position: { x: 11 * horizontalSpacing, y: -0.5 * verticalSpacing } },
      { id: '21', nome: 'Metais', position: { x: 11 * horizontalSpacing, y: 0.5 * verticalSpacing } },
      { id: '22', nome: 'Limpeza Final', position: { x: 12 * horizontalSpacing, y: 0 } },
    ];
  };

  const handleEtapasChange = (novasEtapas: EtapaConfig[]) => {
    // Verificar se as etapas realmente mudaram para evitar loops infinitos
    if (JSON.stringify(etapas) !== JSON.stringify(novasEtapas)) {
      setEtapas(novasEtapas);
      
      // Se a etapa atual foi modificada, atualizar também
      if (etapaAtual) {
        const etapaAtualizada = novasEtapas.find(e => e.id === etapaAtual.id);
        if (etapaAtualizada) {
          setEtapaAtual(etapaAtualizada);
        }
      }
    }
  };

  const handleNodeClick = (node: Node) => {
    console.log("Nó clicado no EditarEtapasObra:", node);
    const etapa = etapas.find(e => e.id === node.id);
    if (etapa) {
      setSelectedNodeId(node.id);
      setEtapaAtual(etapa);
      setNovaEtapaNome(etapa.nome);
      
      // Mostrar menu de contexto
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      console.log("Elemento do nó:", nodeElement);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        console.log("Posição do nó:", rect);
        
        // Calcular posição do menu de contexto
        const menuX = rect.right + 10; // Posicionar à direita do nó
        const menuY = rect.top + rect.height / 2; // Centralizar verticalmente
        
        console.log("Posição do menu:", { x: menuX, y: menuY });
        
        setContextMenuPosition({
          x: menuX,
          y: menuY
        });
        setShowContextMenu(true);
      } else {
        console.error("Elemento do nó não encontrado");
      }
    } else {
      console.error("Etapa não encontrada para o nó:", node.id);
    }
  };

  const handleAddEtapa = () => {
    setNovaEtapaNome('');
    setShowAddDialog(true);
  };

  const handleSaveNewEtapa = () => {
    if (!novaEtapaNome.trim()) {
      toast({
        title: "Erro",
        description: "O nome da etapa é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Adicionando nova etapa:", novaEtapaNome);
      
      // Gerar um novo ID para a etapa
      const newId = String(Date.now()); // Usar timestamp para garantir ID único
      
      // Calcular a posição da nova etapa
      const lastEtapa = etapas[etapas.length - 1];
      const newPosition = lastEtapa 
        ? { x: lastEtapa.position.x + 200, y: 0 }
        : { x: 0, y: 0 };
      
      // Adicionar a nova etapa
      const novaEtapa = {
        id: newId,
        nome: novaEtapaNome,
        position: newPosition
      };
      
      console.log("Nova etapa criada:", novaEtapa);
      
      // Atualizar o estado com a nova etapa
      const etapasAtualizadas = [...etapas, novaEtapa];
      setEtapas(etapasAtualizadas);
      
      // Fechar o diálogo
      setShowAddDialog(false);
      
      // Forçar uma atualização do componente
      setTimeout(() => {
        setEtapas([...etapasAtualizadas]);
      }, 100);
      
      toast({
        title: "Sucesso",
        description: "Etapa adicionada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao adicionar etapa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a etapa.",
        variant: "destructive"
      });
    }
  };

  const handleEditEtapa = () => {
    if (!etapaAtual) return;
    setShowContextMenu(false);
    setShowEditDialog(true);
  };

  const handleSaveEditEtapa = () => {
    if (!etapaAtual) {
      console.error("Nenhuma etapa selecionada para edição");
      return;
    }
    
    if (!novaEtapaNome.trim()) {
      toast({
        title: "Erro",
        description: "O nome da etapa é obrigatório.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log("Etapa atual antes da edição:", etapaAtual);
      console.log("Etapas antes da edição:", etapas);
      
      // Criar uma cópia profunda das etapas atuais
      const etapasAtualizadas = JSON.parse(JSON.stringify(etapas));
      
      // Encontrar e atualizar a etapa pelo ID
      const index = etapasAtualizadas.findIndex((e: EtapaConfig) => e.id === etapaAtual.id);
      console.log("Índice da etapa a ser editada:", index);
      
      if (index !== -1) {
        etapasAtualizadas[index].nome = novaEtapaNome;
        console.log("Etapas após a edição:", etapasAtualizadas);
        
        // Atualizar o estado das etapas
        setEtapas(etapasAtualizadas);
        
        // Atualizar também o objeto etapaAtual para refletir a mudança
        const etapaAtualizada = {
          ...etapaAtual,
          nome: novaEtapaNome
        };
        setEtapaAtual(etapaAtualizada);
        console.log("Etapa atual após a edição:", etapaAtualizada);
        
        // Fechar os diálogos
        setShowEditDialog(false);
        setShowContextMenu(false);
        
        // Forçar uma atualização do componente
        setTimeout(() => {
          const novasEtapas = [...etapasAtualizadas];
          setEtapas(novasEtapas);
        }, 100);
        
        toast({
          title: "Sucesso",
          description: "Etapa atualizada com sucesso!",
        });
      } else {
        throw new Error("Etapa não encontrada");
      }
    } catch (error) {
      console.error("Erro ao editar etapa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível editar a etapa.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEtapa = () => {
    if (!etapaAtual) return;
    setShowContextMenu(false);
    setShowDeleteDialog(true);
  };

  const handleConfirmDeleteEtapa = () => {
    if (!etapaAtual) {
      console.error("Nenhuma etapa selecionada para exclusão");
      return;
    }
    
    try {
      console.log("Excluindo etapa:", etapaAtual);
      
      // Remover a etapa
      const updatedEtapas = etapas.filter(etapa => etapa.id !== etapaAtual.id);
      console.log("Etapas após exclusão:", updatedEtapas);
      
      // Atualizar o estado
      setEtapas(updatedEtapas);
      setShowDeleteDialog(false);
      setSelectedNodeId(null);
      setEtapaAtual(null);
      
      // Forçar uma atualização do componente
      setTimeout(() => {
        setEtapas([...updatedEtapas]);
      }, 100);
      
      toast({
        title: "Sucesso",
        description: "Etapa removida com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao excluir etapa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a etapa.",
        variant: "destructive"
      });
    }
  };

  const handleSaveEtapas = async () => {
    try {
      setSalvando(true);
      console.log("Iniciando salvamento das etapas:", etapas);
      
      // Primeiro, excluir todas as etapas existentes
      console.log("Excluindo etapas existentes para obra_id:", obraId);
      const { error: deleteError } = await supabase
        .from('etapas_fluxograma')
        .delete()
        .eq('obra_id', obraId);
      
      if (deleteError) {
        console.error("Erro ao excluir etapas existentes:", deleteError);
        throw deleteError;
      }
      
      // Depois, inserir as novas etapas
      const etapasParaInserir = etapas.map(etapa => ({
        obra_id: obraId,
        nome: etapa.nome,
        position: etapa.position
      }));
      
      console.log("Inserindo novas etapas:", etapasParaInserir);
      const { data: insertedData, error: insertError } = await supabase
        .from('etapas_fluxograma')
        .insert(etapasParaInserir)
        .select();
      
      if (insertError) {
        console.error("Erro ao inserir novas etapas:", insertError);
        throw insertError;
      }
      
      console.log("Etapas inseridas com sucesso:", insertedData);
      
      // Atualizar também a tabela etapas_datas para manter compatibilidade
      console.log("Excluindo etapas_datas existentes para obra_id:", obraId);
      const { error: deleteEtapasDatasError } = await supabase
        .from('etapas_datas')
        .delete()
        .eq('obra_id', obraId);
        
      if (deleteEtapasDatasError) {
        console.error("Erro ao excluir etapas_datas existentes:", deleteEtapasDatasError);
        throw deleteEtapasDatasError;
      }
      
      const etapasDatasParaInserir = etapas.map(etapa => ({
        obra_id: obraId,
        etapa_nome: etapa.nome,
        status: 'pendente'
      }));
      
      console.log("Inserindo novas etapas_datas:", etapasDatasParaInserir);
      const { data: insertedEtapasDatas, error: insertEtapasDatasError } = await supabase
        .from('etapas_datas')
        .insert(etapasDatasParaInserir)
        .select();
        
      if (insertEtapasDatasError) {
        console.error("Erro ao inserir novas etapas_datas:", insertEtapasDatasError);
        throw insertEtapasDatasError;
      }
      
      console.log("Etapas_datas inseridas com sucesso:", insertedEtapasDatas);
      
      toast({
        title: "Sucesso",
        description: "Etapas salvas com sucesso!",
      });
      
      // Chamar a função de callback para atualizar a página principal
      console.log("Chamando função de callback onSave()");
      onSave();
    } catch (error) {
      console.error('Erro ao salvar etapas:', error);
      toast({
        title: "Erro ao salvar etapas",
        description: "Não foi possível salvar as etapas da obra.",
        variant: "destructive"
      });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Editar Etapas da Obra</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 relative">
          <div className="bg-blue-50 p-3 rounded-md mb-4 border border-blue-200">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Dicas para edição:</h3>
            <ul className="text-xs text-blue-700 list-disc pl-4 space-y-1">
              <li>Clique em uma etapa para selecioná-la e editar seu nome</li>
              <li>Arraste as etapas para reorganizar o fluxograma</li>
              <li>Use os botões abaixo para adicionar ou remover etapas</li>
              <li>Clique em "Salvar Etapas" quando terminar</li>
            </ul>
          </div>
          <FluxogramaObra
            registros={registrosVazios}
            editMode={true}
            onEtapasChange={handleEtapasChange}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNodeId}
            etapasConfig={etapas}
            key={JSON.stringify(etapas)}
          />
          {/* Overlay de instrução quando não há etapas selecionadas */}
          {!etapaAtual && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-5 pointer-events-none rounded-md">
              <div className="bg-white p-3 rounded-md shadow-md text-center">
                <p className="text-sm font-medium">Clique em uma etapa para editar</p>
              </div>
            </div>
          )}
          
          {/* Menu de contexto para editar/excluir etapa */}
          {showContextMenu && etapaAtual && (
            <div 
              ref={contextMenuRef}
              className="fixed bg-white shadow-lg rounded-md border p-2 z-[9999]"
              style={{
                left: `${contextMenuPosition.x}px`,
                top: `${contextMenuPosition.y}px`,
                transform: 'translateY(-50%)'
              }}
            >
              <div className="flex flex-col gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center justify-start gap-2"
                  onClick={handleEditEtapa}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center justify-start gap-2 text-red-500 hover:text-red-700"
                  onClick={handleDeleteEtapa}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Etapa Selecionada</h3>
            {etapaAtual ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="etapaNome">Nome da Etapa</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="etapaNome"
                      value={novaEtapaNome}
                      onChange={(e) => setNovaEtapaNome(e.target.value)}
                      placeholder="Nome da etapa"
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSaveEditEtapa}
                      disabled={!novaEtapaNome.trim() || novaEtapaNome === etapaAtual.nome}
                      size="sm"
                    >
                      Atualizar
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleDeleteEtapa}
                  >
                    Excluir Etapa
                  </Button>
                  <div className="text-xs text-gray-500">
                    ID: {etapaAtual.id}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                <p className="text-sm">Nenhuma etapa selecionada</p>
                <p className="text-xs mt-1">Clique em uma etapa no fluxograma</p>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Adicionar Nova Etapa</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="novaEtapa">Nome da Nova Etapa</Label>
                <div className="flex space-x-2">
                  <Input
                    id="novaEtapa"
                    value={novaEtapaNome}
                    onChange={(e) => setNovaEtapaNome(e.target.value)}
                    placeholder="Nome da nova etapa"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddEtapa}
                    disabled={!novaEtapaNome.trim()}
                    size="sm"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
              <div className="text-xs text-gray-500 italic">
                A nova etapa será adicionada ao final do fluxograma
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end items-center">
          <Button onClick={handleSaveEtapas} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </CardContent>

      {/* Dialog para confirmar exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p>Tem certeza que deseja excluir a etapa "{etapaAtual?.nome}"?</p>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDeleteEtapa}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EditarEtapasObra; 