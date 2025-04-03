import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Edit, Trash2, Clock, Tag, CheckSquare, MessageSquare, Paperclip, MoreHorizontal, Check, X, FileText, Share as ShareIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { buscarObra } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  obterQuadroObra,
  criarCard,
  moverCard,
  excluirCard,
  atualizarCard,
  criarLista,
  excluirLista,
  renomearLista,
  criarChecklist,
  adicionarItemChecklist,
  atualizarItemChecklist,
  excluirItemChecklist,
  excluirChecklist,
  buscarEtiquetas,
  removerEtiqueta,
  adicionarEtiqueta,
  atualizarPosicaoCard
} from '@/lib/trello-local';
import { TrelloBoard, TrelloList, TrelloCard, TrelloChecklist, TrelloChecklistItem, TrelloLabel } from '@/types/trello';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart, ResponderProvided } from 'react-beautiful-dnd';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
// Importações do Capacitor
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const PendenciasObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [obraNome, setObraNome] = useState('');
  
  // Estados para diálogos
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showDeleteCardDialog, setShowDeleteCardDialog] = useState(false);
  const [showAddListDialog, setShowAddListDialog] = useState(false);
  const [showEditListDialog, setShowEditListDialog] = useState(false);
  const [showDeleteListDialog, setShowDeleteListDialog] = useState(false);
  const [showCardDetailsDialog, setShowCardDetailsDialog] = useState(false);
  
  // Estados para cards e listas
  const [cardAtual, setCardAtual] = useState<TrelloCard | null>(null);
  const [listaAtual, setListaAtual] = useState<TrelloList | null>(null);
  const [novaListaNome, setNovaListaNome] = useState('');
  const [etiquetasDisponiveis, setEtiquetasDisponiveis] = useState<TrelloLabel[]>([]);
  
  // Estado para novo card
  const [novoCard, setNovoCard] = useState({
    title: '',
    description: '',
    due_date: '',
    labels: [] as string[]
  });
  
  // Estados para checklists
  const [novoChecklistNome, setNovoChecklistNome] = useState('');
  const [novoChecklistItem, setNovoChecklistItem] = useState('');
  const [checklistAtual, setChecklistAtual] = useState<TrelloChecklist | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

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

  // Etiquetas disponíveis com cores
  const etiquetas = [
    { nome: "Urgente", cor: "bg-red-500 text-white" },
    { nome: "Fazendo", cor: "bg-yellow-500 text-white" },
    { nome: "Concluído", cor: "bg-green-500 text-white" }
  ];

  // Função para editar o título do card diretamente na visualização
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');

  // Função para criar listas padrão
  const criarListasPadrao = async () => {
    try {
      if (!board || board.lists.length === 0) {
        await criarLista(Number(id), "Urgente");
        await criarLista(Number(id), "Fazendo");
        await criarLista(Number(id), "Concluído");
        await carregarQuadro();
      }
    } catch (error) {
      console.error('Erro ao criar listas padrão:', error);
    }
  };

  useEffect(() => {
    carregarDados();
    carregarEtiquetas();
  }, [id]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      console.log('Iniciando carregamento de dados para obra ID:', id);
      
      // Buscar dados da obra
      const obra = await buscarObra(Number(id));
      console.log('Dados da obra:', obra);
      
      if (!obra) {
        console.error('Obra não encontrada');
        toast({
          title: "Erro",
          description: "Obra não encontrada",
          variant: "destructive"
        });
        return;
      }
      
      setObraNome(obra.nome);
      await carregarQuadro();
    } catch (error) {
      console.error('Erro detalhado ao carregar dados:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarQuadro = async () => {
    try {
      console.log('Carregando quadro da obra:', id);
      const quadro = await obterQuadroObra(Number(id));
      console.log('Quadro carregado:', quadro);
      setBoard(quadro as unknown as TrelloBoard);
    } catch (error) {
      console.error('Erro detalhado ao carregar quadro:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível carregar o quadro.",
        variant: "destructive"
      });
    }
  };

  const carregarEtiquetas = async () => {
    try {
      const etiquetas = await buscarEtiquetas();
      setEtiquetasDisponiveis(etiquetas);
    } catch (error) {
      console.error('Erro ao carregar etiquetas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as etiquetas.",
        variant: "destructive"
      });
    }
  };

  // Funções para gerenciar listas (seções)
  const handleAddList = () => {
    setNovaListaNome('');
    setShowAddListDialog(true);
  };

  const handleSaveNewList = async () => {
    try {
      if (!novaListaNome.trim()) {
        toast({
          title: "Erro",
          description: "O nome da seção é obrigatório.",
          variant: "destructive"
        });
        return;
      }

      await criarLista(Number(id), novaListaNome);
      
      toast({
        title: "Sucesso",
        description: "Seção criada com sucesso!",
      });
      
      setShowAddListDialog(false);
      await carregarQuadro();
    } catch (error) {
      console.error('Erro ao criar seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar a seção.",
        variant: "destructive"
      });
    }
  };

  const handleEditList = (lista: TrelloList) => {
    console.log('[DEBUG] Iniciando edição da lista:', lista);
    setListaAtual(lista);
    setNovaListaNome(lista.title || (lista as any).nome);
    setShowEditListDialog(true);
  };

  const handleSaveEditList = async () => {
    try {
      console.log('[DEBUG] Salvando edição da lista. Lista atual:', listaAtual);
      console.log('[DEBUG] Novo nome da lista:', novaListaNome);
      
      if (!listaAtual) {
        toast({
          title: "Erro",
          description: "Seção não selecionada.",
          variant: "destructive"
        });
        return;
      }

      if (!novaListaNome.trim()) {
        toast({
          title: "Erro",
          description: "O nome da seção é obrigatório.",
          variant: "destructive"
        });
        return;
      }

      console.log('[DEBUG] Chamando renomearLista com ID:', listaAtual.id, 'e novo nome:', novaListaNome);
      await renomearLista(listaAtual.id, novaListaNome);
      
      toast({
        title: "Sucesso",
        description: "Seção renomeada com sucesso!",
      });
      
      setShowEditListDialog(false);
      await carregarQuadro();
    } catch (error) {
      console.error('[DEBUG] Erro ao renomear seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível renomear a seção.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteList = (lista: TrelloList) => {
    setListaAtual(lista);
    setShowDeleteListDialog(true);
  };

  const handleConfirmDeleteList = async () => {
    try {
      if (!listaAtual) {
        toast({
          title: "Erro",
          description: "Seção não selecionada.",
          variant: "destructive"
        });
        return;
      }

      // Garantir que estamos usando o ID correto da lista
      const listaId = listaAtual.id;
      console.log('[DEBUG] Excluindo lista com ID:', listaId);

      await excluirLista(listaId);
      
      toast({
        title: "Sucesso",
        description: "Seção excluída com sucesso!",
      });
      
      setShowDeleteListDialog(false);
      await carregarQuadro();
    } catch (error) {
      console.error('Erro ao excluir seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir a seção.",
        variant: "destructive"
      });
    }
  };

  // Funções para gerenciar cards
  const handleAddCard = (lista: TrelloList) => {
    setListaAtual(lista);
    setNovoCard({
      title: '',
      description: '',
      due_date: '',
      labels: []
    });
    setShowAddCardDialog(true);
  };

  const handleSaveNewCard = async () => {
    try {
      if (!listaAtual) {
        toast({
          title: "Erro",
          description: "Lista não selecionada.",
          variant: "destructive"
        });
        return;
      }

      if (!novoCard.title.trim()) {
        toast({
          title: "Erro",
          description: "O título do card é obrigatório.",
          variant: "destructive"
        });
        return;
      }

      // Aplicar capitalização
      const titleCapitalizado = capitalizarPrimeiraLetra(novoCard.title);
      const descriptionCapitalizada = capitalizarPrimeiraLetra(novoCard.description);
      
      // Convertendo "" para null no due_date
      const formattedDueDate = novoCard.due_date.trim() === '' ? null : novoCard.due_date;
      
      console.log('[DEBUG] Criando card com due_date:', formattedDueDate);
      
      await criarCard(
        listaAtual.id,
        titleCapitalizado,
        descriptionCapitalizada,
        formattedDueDate,
        novoCard.labels
      );

      toast({
        title: "Sucesso",
        description: "Card criado com sucesso!",
      });

      setShowAddCardDialog(false);
      await carregarQuadro();
    } catch (error) {
      console.error('Erro ao criar card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar o card.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCard = (card: TrelloCard) => {
    setCardAtual(card);
    setShowDeleteCardDialog(true);
  };

  const handleConfirmDeleteCard = async () => {
    try {
      if (!cardAtual) {
        toast({
          title: "Erro",
          description: "Card não selecionado.",
          variant: "destructive"
        });
        return;
      }

      await excluirCard(cardAtual.id);

      toast({
        title: "Sucesso",
        description: "Card excluído com sucesso!",
      });

      setShowDeleteCardDialog(false);
      await carregarQuadro();
    } catch (error) {
      console.error('Erro ao excluir card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o card.",
        variant: "destructive"
      });
    }
  };

  const handleMoveCard = async (card: TrelloCard, novaListaId: number) => {
    try {
      await moverCard(card.id, novaListaId);
      toast({
        title: "Sucesso",
        description: "Card movido com sucesso!",
      });
      await carregarQuadro();
    } catch (error) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível mover o card.",
        variant: "destructive"
      });
    }
  };

  const formatarData = (dataString: string | null) => {
    if (!dataString) return null;
    try {
      return format(new Date(dataString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (error) {
      return dataString;
    }
  };

  // Função para gerenciar etiquetas
  const handleToggleLabel = (label: string) => {
    const labels = [...novoCard.labels];
    const index = labels.indexOf(label);
    
    if (index === -1) {
      labels.push(label);
    } else {
      labels.splice(index, 1);
    }
    
    setNovoCard({...novoCard, labels});
  };
  
  // Função auxiliar para obter a classe de cor da etiqueta
  const getEtiquetaCor = (nome: string) => {
    const etiqueta = etiquetas.find(e => e.nome === nome);
    return etiqueta ? etiqueta.cor : "bg-gray-500 text-white";
  };
  
  // Função auxiliar para renderizar labels
  const renderizarLabels = (labels: any) => {
    if (!labels || labels.length === 0) return null;
    
    // Função auxiliar para extrair o título da etiqueta
    const getTituloEtiqueta = (label: any) => {
      if (typeof label === 'string') return label;
      if (label.title) return label.title;
      if (label.nome) return label.nome;
      return label.toString();
    };

    // Remover duplicatas baseado no título da etiqueta
    const labelsUnicos = Array.from(new Set(labels.map(getTituloEtiqueta)))
      .map(titulo => {
        const etiqueta = etiquetas.find(e => e.nome === titulo);
        return {
          title: titulo,
          cor: etiqueta?.cor || "bg-gray-500 text-white"
        };
      });
    
    return labelsUnicos.map((label, idx) => (
      <Badge 
        key={`${label.title}-${idx}`}
        className={`text-xs mr-1 ${label.cor}`}
      >
        {label.title}
      </Badge>
    ));
  };

  // Funções para gerenciar checklists
  const handleAddChecklist = async () => {
    try {
      if (!cardAtual) return;
      
      if (!novoChecklistNome.trim()) {
        toast({
          title: "Erro",
          description: "O nome da checklist é obrigatório.",
          variant: "destructive"
        });
        return;
      }
      
      await criarChecklist(cardAtual.id, novoChecklistNome);
      
      toast({
        title: "Sucesso",
        description: "Checklist criada com sucesso!",
      });
      
      setNovoChecklistNome('');
      await carregarQuadro();
      
      // Recarregar o card atual para mostrar a nova checklist
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual.list_id);
      if (lista) {
        const card = lista.cards.find(c => c.id === cardAtual.id);
        if (card) {
          setCardAtual(card as any);
        }
      }
    } catch (error) {
      console.error('Erro ao criar checklist:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar a checklist.",
        variant: "destructive"
      });
    }
  };
  
  const handleAddChecklistItem = async (checklistId: number) => {
    try {
      if (!novoChecklistItem.trim()) {
        toast({
          title: "Erro",
          description: "O item da checklist é obrigatório.",
          variant: "destructive"
        });
        return;
      }

      await adicionarItemChecklist(checklistId, capitalizarPrimeiraLetra(novoChecklistItem));
      setNovoChecklistItem('');
      await carregarQuadro();
      
      toast({
        title: "Sucesso",
        description: "Item adicionado com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao adicionar item na checklist:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível adicionar o item.",
        variant: "destructive"
      });
    }
  };
  
  const handleToggleChecklistItem = async (item: TrelloChecklistItem) => {
    try {
      await atualizarItemChecklist(item.id, {
        ...item,
        checked: !item.checked
      });
      
      // Recarregar o card atual para mostrar a alteração
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual?.list_id);
      if (lista) {
        const card = lista.cards.find(c => c.id === cardAtual?.id);
        if (card) {
          setCardAtual(card as any);
          
          // Atualizar o board para refletir as mudanças instantaneamente
          const newBoard = {...board};
          if (newBoard && newBoard.lists) {
            const listaIndex = newBoard.lists.findIndex(l => l.id === cardAtual?.list_id);
            if (listaIndex !== -1) {
              const cardIndex = newBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual?.id);
              if (cardIndex !== -1) {
                newBoard.lists[listaIndex].cards[cardIndex] = card as any;
                setBoard(newBoard);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o item.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteChecklistItem = async (itemId: number) => {
    try {
      await excluirItemChecklist(itemId);
      
      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso!",
      });
      
      // Recarregar o card atual para mostrar a alteração
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual?.list_id);
      if (lista) {
        const card = lista.cards.find(c => c.id === cardAtual?.id);
        if (card) {
          setCardAtual(card as any);
        }
      }
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o item.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteChecklist = async (checklistId: number) => {
    try {
      await excluirChecklist(checklistId);
      
      toast({
        title: "Sucesso",
        description: "Checklist excluída com sucesso!",
      });
      
      // Recarregar o card atual para mostrar a alteração
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual?.list_id);
      if (lista) {
        const card = lista.cards.find(c => c.id === cardAtual?.id);
        if (card) {
          setCardAtual(card as any);
        }
      }
    } catch (error) {
      console.error('Erro ao excluir checklist:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir a checklist.",
        variant: "destructive"
      });
    }
  };
  
  const handleViewCardDetails = (card: TrelloCard) => {
    setCardAtual(card as any);
    // Inicializar o estado do novoCard com os dados do card atual
    setNovoCard({
      title: card.title,
      description: card.description || '',
      due_date: card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '',
      labels: Array.isArray(card.labels) ? 
        (typeof card.labels[0] === 'string' ? 
          (card.labels as unknown as string[]) : 
          ((card.labels as unknown as any[]).map(l => l.title || l.toString()))
        ) : []
    });
    setShowCardDetailsDialog(true);
  };

  // Função para alternar etiqueta diretamente na visualização do card
  const handleToggleLabelInView = async (label: string) => {
    if (!cardAtual) return;
    
    try {
      // Buscar etiquetas atuais do card
      const etiquetasAtuais = await buscarEtiquetas();
      const etiquetaObj = etiquetasAtuais.find(e => e.title === label);
      
      if (!etiquetaObj) {
        console.error('Etiqueta não encontrada:', label);
        return;
      }
      
      // Verificar se o card já tem a etiqueta
      const cardLabels = Array.isArray(cardAtual.labels) ? cardAtual.labels : [];
      const hasLabel = cardLabels.some(l => 
        (typeof l === 'string' ? l === label : l.title === label)
      );
      
      // Atualizar etiquetas no banco de dados
      if (hasLabel) {
        await removerEtiqueta(cardAtual.id, etiquetaObj.id);
      } else {
        await adicionarEtiqueta(cardAtual.id, etiquetaObj.id);
      }
      
      // Recarregar o quadro para atualizar os dados
      await carregarQuadro();
      
      // Atualizar o estado local do card atual
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual.list_id);
      if (lista) {
        const cardAtualizado = lista.cards.find(c => c.id === cardAtual.id);
        if (cardAtualizado) {
          setCardAtual(cardAtualizado);
          setNovoCard({
            ...novoCard,
            labels: cardAtualizado.labels.map(l => typeof l === 'string' ? l : l.title)
          });
        }
      }
      
      toast({
        title: "Sucesso",
        description: hasLabel ? "Etiqueta removida com sucesso!" : "Etiqueta adicionada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao atualizar etiquetas:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar as etiquetas.",
        variant: "destructive"
      });
    }
  };

  // Função para editar o título do card diretamente na visualização
  const handleEditarTitulo = () => {
    if (!cardAtual) return;
    setNovoTitulo(cardAtual.title);
    setEditandoTitulo(true);
  };

  const handleSalvarTitulo = async () => {
    if (!cardAtual || !novoTitulo.trim()) return;
    
    try {
      await atualizarCard(cardAtual.id, {
        title: novoTitulo
      });
      
      // Atualizar o card atual com o novo título usando 'as any' para evitar problemas de tipagem
      const cardAtualizado = {...cardAtual, title: novoTitulo};
      setCardAtual(cardAtualizado as any);
      
      // Atualizar o board para refletir as mudanças instantaneamente
      const newBoard = {...board};
      if (newBoard && newBoard.lists) {
        const listaIndex = newBoard.lists.findIndex(l => l.id === cardAtual.list_id);
        if (listaIndex !== -1) {
          const cardIndex = newBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual.id);
          if (cardIndex !== -1) {
            newBoard.lists[listaIndex].cards[cardIndex].title = novoTitulo;
            setBoard(newBoard as any);
          }
        }
      }
      
      setEditandoTitulo(false);
      
      toast({
        title: "Sucesso",
        description: "Título atualizado com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o título.",
        variant: "destructive"
      });
    }
  };

  // Função para reordenar os cards
  const handleDragEnd = async (result: any) => {
    if (!result.destination || !board) return;

    try {
      const sourceListId = parseInt(result.source.droppableId);
      const destListId = parseInt(result.destination.droppableId);
      const cardId = parseInt(result.draggableId);

      // Criar uma cópia do board para atualizar o estado
      const newBoard = JSON.parse(JSON.stringify(board));
      const sourceListIndex = newBoard.lists.findIndex((l: any) => l.id === sourceListId);
      const destListIndex = newBoard.lists.findIndex((l: any) => l.id === destListId);

      if (sourceListIndex === -1 || destListIndex === -1) return;

      // Remover o card da lista de origem
      const [movedCard] = newBoard.lists[sourceListIndex].cards.splice(result.source.index, 1);

      // Adicionar o card na lista de destino
      newBoard.lists[destListIndex].cards.splice(result.destination.index, 0, movedCard);

      // Atualizar o estado local imediatamente para feedback visual
      setBoard(newBoard);

      // Atualizar no backend
      await moverCard(cardId, destListId);

      // Atualizar a posição no backend
      const destList = board.lists.find(l => l.id === destListId);
      if (destList) {
        const prevCard = result.destination.index > 0 
          ? destList.cards[result.destination.index - 1]?.position || 0 
          : 0;
        const nextCard = result.destination.index < destList.cards.length 
          ? destList.cards[result.destination.index]?.position || prevCard + 2000 
          : prevCard + 2000;
        const novaPosicao = (prevCard + nextCard) / 2;

        await atualizarPosicaoCard(cardId, destListId, novaPosicao);
      }

      toast({
        title: "Sucesso",
        description: "Card movido com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover o card. Tentando recarregar...",
        variant: "destructive"
      });
      // Recarregar o quadro em caso de erro
      await carregarQuadro();
    }
  };

  // Função para gerar o PDF
  const gerarPDF = async () => {
    if (!boardRef.current || !board) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF. Conteúdo não encontrado.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Processando",
        description: "Gerando PDF, por favor aguarde...",
      });

      // Verificar se estamos no ambiente nativo com Capacitor
      const isNative = Capacitor.isNativePlatform();
      
      // Obter a data atual formatada
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const fileName = `Pendencias_${obraNome.replace(/\s+/g, '_')}_${dataAtual.replace(/\//g, '-')}.pdf`;

      // Conteúdo HTML do relatório - design completo com ícones e estilos
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Pendências - ${obraNome}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            html, body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              color: #333;
              background-color: #ffffff;
              width: 100%;
            }
            * {
              box-sizing: border-box;
            }
            .pdf-container {
              width: 100%;
              padding: 0;
              margin: 0 auto;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 15px;
              width: 100%;
            }
            .report-header-left {
              display: flex;
              align-items: center;
            }
            .report-logo {
              width: 50px;
              height: 50px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 15px;
            }
            .report-logo img, .report-logo svg {
              width: 50px;
              height: 50px;
            }
            .report-title-container {
              display: flex;
              flex-direction: column;
            }
            .report-title {
              font-size: 22px;
              font-weight: 700;
              color: #333;
              margin: 0;
            }
            .obra-title {
              font-size: 17px;
              font-weight: 500;
              color: #3b82f6;
              margin: 5px 0 0 0;
            }
            .report-header-right {
              text-align: right;
            }
            .report-date {
              font-size: 14px;
              color: #666;
            }
            
            .report-content {
              width: 100%;
            }
            .report-lists {
              display: flex;
              flex-direction: column;
              gap: 20px;
              width: 100%;
            }
            .list-container {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              break-inside: avoid;
              width: 100%;
            }
            .list-header {
              background-color: #3b82f6;
              color: white;
              padding: 10px 15px;
              font-size: 16px;
              font-weight: 600;
            }
            .list-body {
              padding: 10px;
              background-color: #f9fafb;
            }
            .card-container {
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 12px;
              margin-bottom: 10px;
              box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .card-title {
              font-size: 15px;
              font-weight: 600;
              color: #1f2937;
              margin-top: 0;
              margin-bottom: 8px;
            }
            .card-description {
              font-size: 14px;
              color: #4b5563;
              margin: 8px 0;
            }
            .card-checklists {
              margin-top: 10px;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
            .checklist-container {
              margin-bottom: 12px;
            }
            .checklist-title {
              font-size: 14px;
              font-weight: 600;
              color: #4b5563;
              margin-bottom: 5px;
            }
            .checklist-items {
              padding-left: 10px;
            }
            .checklist-item {
              display: flex;
              align-items: flex-start;
              margin-bottom: 5px;
              font-size: 13px;
            }
            .checkbox {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 16px;
              height: 16px;
              margin-right: 8px;
              border-radius: 3px;
              flex-shrink: 0;
              line-height: 1;
              font-size: 10px;
            }
            .checkbox.checked {
              background-color: #22c55e;
              color: white;
              font-weight: bold;
              border: 1px solid #22c55e;
            }
            .checkbox.unchecked {
              background-color: white;
              border: 1px solid #d1d5db;
            }
            .checklist-item-text {
              font-size: 13px;
              color: #4b5563;
            }
            .completed-text {
              text-decoration: line-through;
              color: #9ca3af;
            }
            .card-labels {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 8px;
            }
            .card-label {
              font-size: 11px;
              padding: 3px 6px;
              border-radius: 4px;
              color: white;
              font-weight: 500;
            }
            .card-date {
              font-size: 12px;
              color: #6b7280;
              margin-top: 8px;
              display: flex;
              align-items: center;
            }
            .card-date-icon {
              margin-right: 4px;
              width: 14px;
              height: 14px;
            }
            .card-attachments {
              font-size: 12px;
              color: #6b7280;
              margin-top: 5px;
            }
            .report-footer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="pdf-container">
            <!-- Cabeçalho do relatório -->
            <div class="report-header">
              <div class="report-header-left">
                <div class="report-logo">
                  <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M32,4 L56,18 L56,46 L32,60 L8,46 L8,18 Z" stroke="black" stroke-width="2" fill="white"/>
                    <path d="M32,8 L52,20 L52,44 L32,56 L12,44 L12,20 Z" stroke="#00B2D6" stroke-width="1.5" fill="none"/>
                    <g transform="translate(17, 16)">
                      <path d="M15,8 C8,8 4,12 4,18 L4,22 L26,22 L26,18 C26,12 22,8 15,8 Z" fill="black"/>
                      <path d="M10,8 L10,21 M15,8 L15,21 M20,8 L20,21" stroke="white" stroke-width="1.5"/>
                      <rect x="4" y="22" width="22" height="2" fill="black"/>
                      <path d="M15,25 C12,25 10,27 10,30 C10,33 12,35 15,35 C18,35 20,33 20,30 C20,27 18,25 15,25 Z" fill="black"/>
                      <rect x="13" y="29" width="4" height="2" fill="white"/>
                    </g>
                  </svg>
                </div>
                <div class="report-title-container">
                  <h1 class="report-title">Relatório de Pendências</h1>
                  <p class="obra-title">${obraNome}</p>
                </div>
              </div>
              <div class="report-header-right">
                <div class="report-date">
                  Data: ${dataAtual}
                </div>
              </div>
            </div>
        
            <!-- Conteúdo do relatório -->
            <div class="report-content">
              <div class="report-lists">
              ${board.lists.map(list => {
                return `
                  <div class="list-container">
                    <div class="list-header">${list.title}</div>
                    <div class="list-body">
                      ${list.cards && list.cards.length > 0 ? 
                        list.cards.map(card => {
                          return `
                          <div class="card-container">
                            <div class="card-labels">
                              ${card.labels && card.labels.length > 0 ? 
                                card.labels.map(label => {
                                  // Determinar a cor baseado no nome da etiqueta
                                  let color = '#6b7280'; // cor padrão cinza
                                  if (typeof label === 'string') {
                                    if (label.toLowerCase().includes('urgente')) color = '#ef4444';
                                    else if (label.toLowerCase().includes('fazendo')) color = '#f59e0b';
                                    else if (label.toLowerCase().includes('concluído')) color = '#10b981';
                                  } else {
                                    color = label.color || '#6b7280';
                                  }
                                  
                                  const labelName = typeof label === 'string' ? label : label.title;
                                  
                                  return `<span class="card-label" style="background-color: ${color};">${labelName}</span>`;
                                }).join('') : ''
                              }
                            </div>
                            <h4 class="card-title">${card.title}</h4>
                            ${card.description ? `<p class="card-description">${card.description}</p>` : ''}
                            
                            ${card.checklists && card.checklists.length > 0 ? 
                              `<div class="card-checklists">
                                ${card.checklists.map(checklist => {
                                  return `
                                  <div class="checklist-container">
                                    <h5 class="checklist-title">${checklist.title}</h5>
                                    <div class="checklist-items">
                                      ${checklist.items && checklist.items.length > 0 ? 
                                        checklist.items.map(item => {
                                          return `
                                          <div class="checklist-item">
                                            <span class="checkbox ${item.checked ? 'checked' : 'unchecked'}">
                                              ${item.checked ? '✓' : ''}
                                            </span>
                                            <span class="checklist-item-text ${item.checked ? 'completed-text' : ''}">
                                              ${item.title}
                                            </span>
                                          </div>
                                          `;
                                        }).join('') : 'Nenhum item'
                                      }
                                    </div>
                                  </div>
                                  `;
                                }).join('')}
                              </div>` : ''
                            }
                            
                            ${card.due_date ? `
                              <div class="card-date">
                                <span class="card-date-icon">📅</span>
                                Vencimento: ${new Date(card.due_date).toLocaleDateString('pt-BR')}
                              </div>
                            ` : ''}
                          </div>
                          `;
                        }).join('') : '<p>Nenhum card nesta lista</p>'
                      }
                    </div>
                  </div>
                `;
              }).join('')}
              </div>
            </div>
            
            <!-- Rodapé do relatório -->
            <div class="report-footer">
              <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')} - G-Log Sistema de Gerenciamento de Obras</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Criar um iframe temporário para renderizar o HTML
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.position = 'fixed';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      // Escrever o HTML no iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Aguardar o carregamento completo das imagens
        setTimeout(async () => {
          try {
            // Criar documento PDF
            const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });

            // Processar a página
            const canvas = await html2canvas(iframeDoc.body, {
              scale: 2,
              logging: false,
              useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Adicionar páginas adicionais se necessário
            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }

            // Remover o iframe temporário
            document.body.removeChild(iframe);

            // Verificar se estamos em um ambiente nativo
            if (isNative) {
              try {
                // Gerar PDF como blob
                const pdfBlob = pdf.output('blob');
                
                // Converter blob para base64
                const reader = new FileReader();
                reader.onloadend = async function() {
                  const base64data = reader.result?.toString().split(',')[1];
                  
                  if (base64data) {
                    try {
                      // Salvar arquivo no dispositivo
                      const result = await Filesystem.writeFile({
                        path: fileName,
                        data: base64data,
                        directory: Directory.Documents,
                        recursive: true
                      });
                      
                      toast({
                        title: "Sucesso",
                        description: "PDF gerado com sucesso!",
                      });
                      
                      // Tentar abrir o arquivo com a API padrão para dispositivos móveis
                      if (Capacitor.getPlatform() === 'android') {
                        // No Android, podemos usar o Browser plugin para abrir o arquivo
                        const { Browser } = Capacitor.Plugins;
                        await Browser.open({ url: result.uri });
                      } else {
                        // Em outros dispositivos, exibir o arquivo salvo
                        toast({
                          title: "Arquivo salvo",
                          description: `O arquivo foi salvo em ${result.uri}`,
                        });
                      }
                    } catch (error) {
                      console.error('Erro ao salvar PDF:', error);
                      
                      // Fallback: compartilhar o arquivo como alternativa
                      await Share.share({
                        title: 'Relatório de Pendências',
                        text: `Relatório de Pendências - ${obraNome}`,
                        url: 'data:application/pdf;base64,' + base64data,
                        dialogTitle: 'Compartilhar Relatório de Pendências'
                      });
                    }
                  }
                };
                
                reader.readAsDataURL(pdfBlob);
              } catch (error) {
                console.error('Erro ao processar PDF:', error);
                toast({
                  title: "Erro",
                  description: "Ocorreu um erro ao processar o PDF. Tentando método alternativo...",
                });
                
                // Fallback para download direto em caso de erro
                pdf.save(fileName);
              }
            } else {
              // Para navegadores desktop, fazer download diretamente
              pdf.save(fileName);
              
              toast({
                title: "Sucesso",
                description: "PDF gerado com sucesso!",
              });
            }
          } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast({
              title: "Erro",
              description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
              variant: "destructive"
            });
            
            // Remover o iframe temporário em caso de erro
            document.body.removeChild(iframe);
          }
        }, 1000); // Dar tempo para carregar
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para compartilhar PDF
  const compartilharPDF = async () => {
    if (!boardRef.current || !board) {
      toast({
        title: "Erro",
        description: "Não foi possível compartilhar. Conteúdo não encontrado.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Processando",
        description: "Preparando arquivo para compartilhar...",
      });

      // Verificar se estamos em ambiente nativo
      const isNative = Capacitor.isNativePlatform();
      
      // Verificar se a API Web Share está disponível para navegadores
      const canShare = navigator && navigator.share;

      if (!isNative && !canShare) {
        toast({
          title: "Compartilhamento não disponível",
          description: "Use a função 'Gerar PDF' para baixar o relatório.",
        });
        return gerarPDF();
      }

      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const fileName = `Pendencias_${obraNome.replace(/\s+/g, '_')}_${dataAtual.replace(/\//g, '-')}.pdf`;

      // Criando o PDF (código simplificado - reusa a função anterior para isso)
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.position = 'fixed';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);
      
      // Gerando o PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Se estamos em ambiente nativo com Capacitor
      if (isNative) {
        try {
          // Gerar PDF como base64
          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          
          // Salvar temporariamente no dispositivo
          const result = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
            recursive: true
          });
          
          // Compartilhar o arquivo usando a API de compartilhamento nativa
          await Share.share({
            title: 'Relatório de Pendências',
            text: `Relatório de Pendências - ${obraNome}`,
            url: result.uri,
            dialogTitle: 'Compartilhar Relatório de Pendências'
          });
          
          toast({
            title: "Sucesso",
            description: "Relatório compartilhado!",
          });
        } catch (error) {
          console.error('Erro ao compartilhar:', error);
          toast({
            title: "Erro",
            description: "Ocorreu um erro ao compartilhar. Tentando método alternativo...",
          });
          
          // Tentar método alternativo
          gerarPDF();
        }
      } else if (canShare) {
        // Para navegadores com suporte à API Web Share
        try {
          // Criar blob para compartilhar
          const pdfBlob = pdf.output('blob');
          
          // Verificar se o navegador suporta compartilhamento de arquivos
          const shareData = {
            title: 'Relatório de Pendências',
            text: `Relatório de Pendências - ${obraNome}`,
            files: [new File([pdfBlob], fileName, { type: 'application/pdf' })]
          };
          
          if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
          } else {
            // Compartilhar apenas texto e URL se não suportar arquivos
            await navigator.share({
              title: 'Relatório de Pendências',
              text: `Relatório de Pendências - ${obraNome}`
            });
            
            // E fazer download do arquivo
            pdf.save(fileName);
          }
          
          toast({
            title: "Sucesso",
            description: "Relatório compartilhado!",
          });
        } catch (error) {
          console.error('Erro ao compartilhar:', error);
          // Recorrer ao download padrão
          pdf.save(fileName);
          
          toast({
            title: "Compartilhamento falhou",
            description: "O PDF foi baixado localmente.",
          });
        }
      } else {
        // Método de fallback: download direto
        pdf.save(fileName);
        
        toast({
          title: "Compartilhamento não disponível",
          description: "O PDF foi baixado localmente.",
        });
      }
      
      // Limpar recursos
      document.body.removeChild(iframe);
    } catch (error) {
      console.error('Erro ao preparar PDF para compartilhar:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao preparar o arquivo para compartilhar.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/obras/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Pendências: {obraNome}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={gerarPDF} className="flex-1 sm:flex-none flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Gerar PDF
          </Button>
          {!!(window as any).Capacitor?.isNativePlatform() && (
            <Button onClick={compartilharPDF} className="flex-1 sm:flex-none flex items-center gap-2">
              <ShareIcon className="w-4 h-4" />
              Compartilhar
            </Button>
          )}
          <Button onClick={handleAddList} className="flex-1 sm:flex-none flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Seção
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div ref={boardRef} className="w-full">
          <DragDropContext
            onDragEnd={handleDragEnd}
            enableDefaultSensors={false}
          >
            <DndSensors>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {board?.lists.map((lista) => (
                  <Droppable key={lista.id} droppableId={lista.id.toString()}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`bg-muted/30 rounded-lg p-4 min-h-[200px] ${
                          snapshot.isDraggingOver ? 'bg-muted/50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-semibold">{lista.title || (lista as any).nome}</h2>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleAddCard(lista)}
                              title="Adicionar Card"
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditList(lista)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar Seção
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteList(lista)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir Seção
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {lista.cards.map((card, index) => (
                            <Draggable
                              key={card.id}
                              draggableId={card.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  data-drag-handle
                                  className={`touch-none ${
                                    snapshot.isDragging ? 'opacity-50' : ''
                                  }`}
                                >
                                  <Card 
                                    className={`shadow-sm hover:shadow-md transition-all ${
                                      snapshot.isDragging
                                        ? 'shadow-lg ring-2 ring-primary'
                                        : ''
                                    }`}
                                    onClick={() => handleViewCardDetails(card)}
                                  >
                                    <CardHeader className="p-4 pb-2">
                                      <CardTitle className="text-base">{card.title}</CardTitle>
                                    </CardHeader>
                                    
                                    {card.description && (
                                      <CardContent className="p-4 pt-0 pb-2">
                                        <p className="text-sm text-muted-foreground line-clamp-3">{card.description}</p>
                                      </CardContent>
                                    )}
                                    
                                    <CardFooter className="p-4 pt-2 flex flex-wrap gap-2 justify-between">
                                      <div className="flex flex-wrap gap-2">
                                        {card.due_date && (
                                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                            <Clock className="h-3 w-3" />
                                            {formatarData(card.due_date)}
                                          </Badge>
                                        )}
                                        
                                        {renderizarLabels(card.labels)}
                                        
                                        {card.checklists && card.checklists.length > 0 && (
                                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                            <CheckSquare className="h-3 w-3" />
                                            {card.checklists.reduce((total, checklist) => 
                                              total + checklist.items.filter(item => item.checked).length, 0
                                            )} / {card.checklists.reduce((total, checklist) => 
                                              total + checklist.items.length, 0
                                            )}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCard(card);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </CardFooter>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {lista.cards.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Nenhum card nesta seção
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DndSensors>
          </DragDropContext>
        </div>
      )}

      {/* Dialog para adicionar seção */}
      <Dialog open={showAddListDialog} onOpenChange={setShowAddListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Seção</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="list-name" className="text-sm font-medium">Nome da Seção</Label>
              <Input
                id="list-name"
                value={novaListaNome}
                onChange={(e) => setNovaListaNome(e.target.value)}
                onBlur={(e) => setNovaListaNome(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Nome da seção"
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
                lang="pt-BR"
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveNewList}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar seção */}
      <Dialog open={showEditListDialog} onOpenChange={setShowEditListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Seção</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name" className="text-sm font-medium">Nome da Seção</Label>
              <Input
                id="edit-list-name"
                value={novaListaNome}
                onChange={(e) => setNovaListaNome(e.target.value)}
                onBlur={(e) => setNovaListaNome(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Nome da seção"
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
                lang="pt-BR"
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveEditList}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar exclusão de seção */}
      <Dialog open={showDeleteListDialog} onOpenChange={setShowDeleteListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p>Tem certeza que deseja excluir a seção "{listaAtual?.title || (listaAtual as any)?.nome}"?</p>
            <p className="text-sm text-muted-foreground mt-2">Esta ação excluirá todos os cards desta seção e não pode ser desfeita.</p>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDeleteList}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar card */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Card</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Título</Label>
              <Input
                id="title"
                value={novoCard.title}
                onChange={(e) => setNovoCard({...novoCard, title: e.target.value})}
                onBlur={(e) => setNovoCard({...novoCard, title: capitalizarPrimeiraLetra(e.target.value)})}
                placeholder="Título do card"
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
                lang="pt-BR"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Descrição</Label>
              <Textarea
                id="description"
                value={novoCard.description}
                onChange={(e) => setNovoCard({...novoCard, description: e.target.value})}
                onBlur={(e) => setNovoCard({...novoCard, description: capitalizarPrimeiraLetra(e.target.value)})}
                placeholder="Descrição do card"
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
                lang="pt-BR"
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveNewCard}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar exclusão */}
      <Dialog open={showDeleteCardDialog} onOpenChange={setShowDeleteCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p>Tem certeza que deseja excluir o card "{cardAtual?.title}"?</p>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDeleteCard}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para detalhes do card */}
      <Dialog open={showCardDetailsDialog} onOpenChange={setShowCardDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {editandoTitulo ? (
              <div className="flex items-center gap-2">
                <Input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="text-xl font-semibold"
                  autoFocus
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleSalvarTitulo}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setEditandoTitulo(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{cardAtual?.title}</DialogTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleEditarTitulo}
                  className="h-6 w-6"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Data de vencimento */}
            {cardAtual?.due_date && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Data de Vencimento</h3>
                <p className="text-sm">{formatarData(cardAtual.due_date)}</p>
              </div>
            )}
            
            {/* Etiquetas */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {etiquetasDisponiveis.map((etiqueta) => {
                  const isSelected = cardAtual?.labels?.some(l => 
                    (typeof l === 'string' ? l === etiqueta.title : l.id === etiqueta.id)
                  );
                  return (
                    <Badge 
                      key={etiqueta.id}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer ${isSelected ? "" : ""}`}
                      style={{
                        backgroundColor: isSelected ? etiqueta.color : 'transparent',
                        color: isSelected ? 'white' : etiqueta.color,
                        borderColor: etiqueta.color
                      }}
                      onClick={() => handleToggleLabelInView(etiqueta.title)}
                    >
                      {etiqueta.title}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            {/* Checklists */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Checklists</h3>
              </div>
              
              {/* Adicionar nova checklist */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={novoChecklistNome}
                    onChange={(e) => setNovoChecklistNome(e.target.value)}
                    placeholder="Nome da checklist"
                    className="flex-1"
                  />
                  <Button onClick={handleAddChecklist}>Adicionar</Button>
                </div>
              </div>
              
              {/* Checklists existentes */}
              {cardAtual?.checklists && cardAtual.checklists.length > 0 ? (
                <div className="space-y-6">
                  {cardAtual.checklists.map((checklist) => (
                    <div key={checklist.id} className="space-y-2 border rounded-md p-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{checklist.title}</h3>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteChecklist(checklist.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Itens da checklist */}
                      <div className="space-y-2">
                        {checklist.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={item.checked} 
                                onCheckedChange={() => handleToggleChecklistItem(item)}
                                id={`item-${item.id}`}
                              />
                              <label 
                                htmlFor={`item-${item.id}`}
                                className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}
                              >
                                {item.title}
                              </label>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDeleteChecklistItem(item.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {/* Adicionar novo item */}
                      <div className="flex gap-2 mt-4">
                        <Input
                          value={novoChecklistItem}
                          onChange={(e) => setNovoChecklistItem(e.target.value)}
                          onBlur={(e) => setNovoChecklistItem(capitalizarPrimeiraLetra(e.target.value))}
                          placeholder="Novo item da checklist"
                          className="flex-1"
                          spellCheck={true}
                          autoCorrect="on"
                          autoCapitalize="sentences"
                          lang="pt-BR"
                        />
                        <Button 
                          size="sm"
                          onClick={() => handleAddChecklistItem(checklist.id)}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma checklist adicionada
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  handleDeleteCard(cardAtual!);
                  setShowCardDetailsDialog(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
            <div>
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente para customizar os sensores do drag and drop
const DndSensors = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    let pressTimer: NodeJS.Timeout;
    let isDragging = false;
    let dragElement: HTMLElement | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dragHandle = target.closest('[data-drag-handle]');
      
      if (!dragHandle) return;
      
      dragElement = dragHandle as HTMLElement;
      
      pressTimer = setTimeout(() => {
        isDragging = true;
        dragElement?.setAttribute('draggable', 'true');
        
        // Adiciona feedback visual
        const card = dragElement.querySelector('.card');
        if (card) {
          card.classList.add('ring-2', 'ring-primary', 'opacity-90');
        }
      }, 300); // Tempo que precisa segurar para começar o drag
    };

    const handleMouseUp = () => {
      clearTimeout(pressTimer);
      if (dragElement) {
        dragElement.setAttribute('draggable', 'false');
        const card = dragElement.querySelector('.card');
        if (card) {
          card.classList.remove('ring-2', 'ring-primary', 'opacity-90');
        }
      }
      isDragging = false;
      dragElement = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        clearTimeout(pressTimer);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(pressTimer);
    };
  }, []);

  return <>{children}</>;
};

export default PendenciasObra;