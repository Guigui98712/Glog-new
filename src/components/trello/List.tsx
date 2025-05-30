import { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, X, Check, Trash2 } from 'lucide-react';
import { TrelloList, TrelloCard, TrelloLabel } from '@/types/trello';
import { 
  criarCard, 
  excluirCard, 
  atualizarCard,
  buscarEtiquetas,
  adicionarEtiqueta,
  removerEtiqueta,
  criarChecklist,
  adicionarComentario,
  adicionarAnexo,
  moverCard,
  renomearLista
} from '@/lib/trello-local';
import { toast } from 'sonner';
import { useToast } from '@/components/ui/use-toast';

interface ListProps {
  list: TrelloList;
  allLists: TrelloList[];
  onUpdate: (listId: number, updates: Partial<TrelloList>) => void;
  onDelete?: (listId: number) => void;
}

export function List({ list, allLists, onUpdate, onDelete }: ListProps) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [availableLabels, setAvailableLabels] = useState<TrelloLabel[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [listTitle, setListTitle] = useState(list.title);
  const { toast } = useToast();

  useEffect(() => {
    setListTitle(list.title);
  }, [list.title]);

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      console.log('[DEBUG] Carregando etiquetas...');
      const labels = await buscarEtiquetas();
      console.log('[DEBUG] Etiquetas carregadas:', labels);
      setAvailableLabels(labels);
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar etiquetas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar etiquetas",
        variant: "destructive"
      });
    }
  };

  const handleAddCard = async () => {
    try {
      if (!newCardTitle.trim()) return;

      const newCard = await criarCard(list.id, newCardTitle);
      onUpdate(list.id, {
        cards: [...(list.cards || []), newCard]
      });
      setNewCardTitle('');
      setIsAddingCard(false);
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao criar card:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar card",
        variant: "destructive"
      });
    }
  };

  const handleSaveTitle = async () => {
    try {
      if (!listTitle.trim()) {
        setListTitle(list.title);
        setIsEditingTitle(false);
        return;
      }

      if (listTitle !== list.title) {
        await renomearLista(list.id, listTitle);
        onUpdate(list.id, { title: listTitle });
        
        toast({
          title: "Sucesso",
          description: "Lista renomeada com sucesso!"
        });
      }
      
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Erro ao renomear lista:', error);
      toast({
        title: "Erro",
        description: "Erro ao renomear lista",
        variant: "destructive"
      });
      setListTitle(list.title);
      setIsEditingTitle(false);
    }
  };

  const handleDeleteList = () => {
    if (onDelete) {
      onDelete(list.id);
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      await excluirCard(cardId);
      onUpdate(list.id, {
        cards: list.cards.filter(card => card.id !== cardId)
      });
      
      toast({
        title: "Sucesso",
        description: "Card excluído com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao excluir card:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir card",
        variant: "destructive"
      });
    }
  };

  const handleMoveCard = async (cardId: number, direction: 'left' | 'right') => {
    try {
      const currentIndex = allLists.findIndex(l => l.id === list.id);
      const targetList = direction === 'left' 
        ? allLists[currentIndex - 1] 
        : allLists[currentIndex + 1];

      if (!targetList) return;

      await moverCard(cardId, targetList.id);
      
      // Remover o card da lista atual
      onUpdate(list.id, {
        cards: list.cards.filter(card => card.id !== cardId)
      });

      // Adicionar o card à lista de destino
      const movedCard = list.cards.find(card => card.id === cardId);
      if (movedCard) {
        onUpdate(targetList.id, {
          cards: [...(targetList.cards || []), { ...movedCard, list_id: targetList.id }]
        });
      }

      toast({
        title: "Sucesso",
        description: "Card movido com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: "Erro ao mover card",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCard = async (cardId: number, updates: Partial<TrelloCard>) => {
    try {
      await atualizarCard(cardId, updates);
      const card = list.cards.find(c => c.id === cardId);
      if (card) {
        // Garantir que estamos usando a versão mais atualizada do card
        const updatedCard = { ...card, ...updates };
        
        // Atualizar imediatamente o estado local
        onUpdate(list.id, {
          cards: list.cards.map(c => c.id === cardId ? updatedCard : c)
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar card",
        variant: "destructive"
      });
    }
  };

  const handleAddChecklist = async (cardId: number, title: string) => {
    try {
      const newChecklist = await criarChecklist(cardId, title);
      const card = list.cards.find(c => c.id === cardId);
      if (card) {
        const updatedCard = {
          ...card,
          checklists: [...(card.checklists || []), { ...newChecklist, items: [] }]
        };
        onUpdate(list.id, {
          cards: list.cards.map(c => c.id === cardId ? updatedCard : c)
        });
      }
      toast({
        title: "Sucesso",
        description: "Checklist adicionado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao adicionar checklist:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar checklist",
        variant: "destructive"
      });
    }
  };

  const handleAddComment = async (cardId: number, content: string) => {
    try {
      const newComment = await adicionarComentario(cardId, content);
      const card = list.cards.find(c => c.id === cardId);
      if (card) {
        const updatedCard = {
          ...card,
          comments: [...(card.comments || []), newComment]
        };
        onUpdate(list.id, {
          cards: list.cards.map(c => 
            c.id === cardId ? updatedCard : c
          )
        });
      }
      toast({
        title: "Sucesso",
        description: "Comentário adicionado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar comentário",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleAddAttachment = async (cardId: number, file: File) => {
    try {
      const newAttachment = await adicionarAnexo(cardId, file);
      const card = list.cards.find(c => c.id === cardId);
      if (card) {
        const updatedCard = {
          ...card,
          attachments: [...(card.attachments || []), newAttachment]
        };
        onUpdate(list.id, {
          cards: list.cards.map(c => 
            c.id === cardId ? updatedCard : c
          )
        });
      }
      toast({
        title: "Sucesso",
        description: "Anexo adicionado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao adicionar anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar anexo",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleToggleLabel = async (cardId: number, labelId: number) => {
    try {
      const card = list.cards.find(c => c.id === cardId);
      if (!card) {
        console.error('[DEBUG] Card não encontrado:', cardId);
        return;
      }

      console.log('[DEBUG] Estado atual das etiquetas:', card.labels);
      console.log('[DEBUG] Tentando alternar etiqueta:', labelId);
      
      // Encontrar a etiqueta que está sendo alternada
      const labelToToggle = availableLabels.find(l => l.id === labelId);
      if (!labelToToggle) return;

      // Encontrar as etiquetas "Fazendo" e "Concluído"
      const labelFazendo = availableLabels.find(l => l.title.toLowerCase() === "fazendo");
      const labelConcluido = availableLabels.find(l => l.title.toLowerCase() === "concluído");
      
      const hasLabel = card.labels.some(l => l.id === labelId);
      console.log('[DEBUG] Card possui a etiqueta?', hasLabel);
      
      if (hasLabel) {
        console.log('[DEBUG] Removendo etiqueta do card');
        await removerEtiqueta(cardId, labelId);
        
        // Atualizar o estado local removendo a etiqueta
        const updatedCard = {
          ...card,
          labels: card.labels.filter(l => l.id !== labelId)
        };
        
        // Atualizar a lista com o card modificado
        const updatedList = {
          ...list,
          cards: list.cards.map(c => c.id === cardId ? updatedCard : c)
        };
        
        console.log('[DEBUG] Estado atualizado após remover etiqueta:', updatedCard.labels);
        onUpdate(list.id, updatedList);
        
        toast({
          title: "Etiqueta removida",
          description: "Etiqueta removida com sucesso!"
        });
      } else {
        console.log('[DEBUG] Adicionando etiqueta ao card');
        await adicionarEtiqueta(cardId, labelId);
        
        // Se estamos adicionando a etiqueta "Concluído" e existe a etiqueta "Fazendo", remover "Fazendo"
        if (labelToToggle.title.toLowerCase() === "concluído" && 
            labelFazendo && 
            card.labels.some(l => l.id === labelFazendo.id)) {
          await removerEtiqueta(cardId, labelFazendo.id);
          card.labels = card.labels.filter(l => l.id !== labelFazendo.id);
        }
        
        // Buscar a etiqueta completa
        const label = availableLabels.find(l => l.id === labelId);
        if (label) {
          // Atualizar o estado local adicionando a etiqueta
          const updatedCard = {
            ...card,
            labels: [...card.labels.filter(l => l.id !== labelFazendo?.id), label]
          };
          
          // Atualizar a lista com o card modificado
          const updatedList = {
            ...list,
            cards: list.cards.map(c => c.id === cardId ? updatedCard : c)
          };
          
          console.log('[DEBUG] Estado atualizado após adicionar etiqueta:', updatedCard.labels);
          onUpdate(list.id, updatedList);
          
          toast({
            title: "Etiqueta adicionada",
            description: "Etiqueta adicionada com sucesso!"
          });
        }
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao alternar etiqueta:', error);
      toast({
        title: "Erro",
        description: "Erro ao alternar etiqueta",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="bg-gray-100 rounded-lg shadow-sm w-80 flex-shrink-0">
      <div className="p-3 bg-gray-200 rounded-t-lg flex items-center justify-between">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  setListTitle(list.title);
                  setIsEditingTitle(false);
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSaveTitle}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setListTitle(list.title);
                setIsEditingTitle(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h3 className="font-medium text-gray-800">{list.title}</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditingTitle(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={handleDeleteList}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {list.cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onDelete={handleDeleteCard}
            onUpdate={handleUpdateCard}
            onAddChecklist={handleAddChecklist}
            onAddComment={handleAddComment}
            onAddAttachment={handleAddAttachment}
            onToggleLabel={(labelId) => handleToggleLabel(card.id, labelId)}
            availableLabels={availableLabels}
          />
        ))}

        {isAddingCard ? (
          <div className="bg-white p-3 rounded-md shadow-sm space-y-2">
            <Input
              placeholder="Título do card..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCard();
                } else if (e.key === 'Escape') {
                  setNewCardTitle('');
                  setIsAddingCard(false);
                }
              }}
            />
            <div className="flex justify-between">
              <Button size="sm" onClick={handleAddCard}>
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewCardTitle('');
                  setIsAddingCard(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-500 hover:text-gray-700"
            onClick={() => setIsAddingCard(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar card
          </Button>
        )}
      </div>
    </div>
  );
} 