import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Edit, Trash2, Clock, Tag, CheckSquare, MessageSquare, Paperclip, MoreHorizontal, Check, X, FileText, Share as ShareIcon, Check as CheckIcon } from 'lucide-react';
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
import { TrelloBoard, TrelloList, TrelloCard, TrelloChecklist, TrelloChecklistItem, TrelloLabel, InitializedTrelloCard } from '@/types/trello';
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
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'; // Removido DragStart, ResponderProvided se não usados diretamente
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
// Importações do Capacitor
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { supabase } from '@/lib/supabase';
import { pdfStyles } from '../styles/pdf-styles';
import NotificationService from '@/services/NotificationService';
// Importar React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app'; // Importar o App plugin
import { LocalNotifications } from '@capacitor/local-notifications'; // Descomentando a importação

const PendenciasObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const notificationService = NotificationService.getInstance();
  
  // Estados para diálogos
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showDeleteCardDialog, setShowDeleteCardDialog] = useState(false);
  const [showAddListDialog, setShowAddListDialog] = useState(false);
  const [showEditListDialog, setShowEditListDialog] = useState(false);
  const [showDeleteListDialog, setShowDeleteListDialog] = useState(false);
  const [showCardDetailsDialog, setShowCardDetailsDialog] = useState(false);
  
  // Estados para cards e listas
  const [cardAtual, setCardAtual] = useState<InitializedTrelloCard | null>(null);
  const [listaAtual, setListaAtual] = useState<TrelloList | null>(null);
  const [novaListaNome, setNovaListaNome] = useState('');
  
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

  // Função para editar o título do card diretamente na visualização
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');

  const [editandoTituloCardId, setEditandoTituloCardId] = useState<number | null>(null);
  const [novoTituloCard, setNovoTituloCard] = useState('');

  // Estado para edição de descrição do card
  const [editandoDescricaoCardId, setEditandoDescricaoCardId] = useState<number | null>(null);
  const [novaDescricaoCard, setNovaDescricaoCard] = useState('');

  const [editandoListaId, setEditandoListaId] = useState<number | null>(null);
  // Estado para o input de nome de lista (tanto para criar nova quanto para editar existente)
  const [valorInputNomeLista, setValorInputNomeLista] = useState(''); 

  // Consulta da obra
  const { data: obra, isLoading: obraLoading, error: obraError } = useQuery({
    queryKey: ['obra', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      if (!data) throw new Error('Obra não encontrada');
      
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });

  // Lidar com erros da consulta da obra
  useEffect(() => {
    if (obraError) {
      console.error('Erro ao carregar dados:', obraError);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da obra",
        variant: "destructive"
      });
    }
  }, [obraError, toast]);

  // Consulta do quadro de pendências
  const { 
    data: board, 
    isLoading: boardLoading, 
    error: boardError,
    refetch: refetchBoard
  } = useQuery({
    queryKey: ['board', id],
    queryFn: async () => {
      if (!id) throw new Error('ID da obra não fornecido para carregar o quadro.');
      console.log('Carregando quadro da obra:', id);
      const quadro = await obterQuadroObra(Number(id), (message, progress) => {
        console.log(`Progresso: ${message} (${progress}%)`);
      });

      if (!quadro || !quadro.lists) {
        throw new Error('Não foi possível carregar o quadro da obra');
      }

      console.log('Quadro carregado com sucesso:', quadro);
      return quadro;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: !!id // Só executa se o ID estiver disponível
  });

  // Lidar com erros da consulta do quadro
  useEffect(() => {
    if (boardError) {
      console.error('Erro ao carregar quadro:', boardError);
      toast({
        title: "Erro",
        description: boardError instanceof Error ? boardError.message : 'Erro ao carregar o quadro da obra',
        variant: "destructive"
      });
    }
  }, [boardError, toast]);

  // Consulta de etiquetas
  const { data: etiquetasDisponiveis = [] } = useQuery({
    queryKey: ['etiquetas'],
    queryFn: async () => {
      // Buscar etiquetas e garantir que não haja duplicatas
      const etiquetas = await buscarEtiquetas();
      
      // Criar um Map para armazenar etiquetas por ID, eliminando duplicatas
      const etiquetasMap = new Map();
      etiquetas.forEach(etiqueta => {
        if (!etiquetasMap.has(etiqueta.id)) {
          etiquetasMap.set(etiqueta.id, etiqueta);
        }
      });
      
      // Converter o Map de volta para array
      return Array.from(etiquetasMap.values());
    },
    staleTime: 1000 * 60 * 60, // 60 minutos (etiquetas mudam com menos frequência)
    gcTime: 1000 * 60 * 60 * 24, // 24 horas
    refetchOnMount: false, // Não recarregar ao montar o componente
    refetchOnWindowFocus: false, // Não recarregar quando a janela recebe foco
  });

  // Mutação para criar lista
  const criarListaMutation = useMutation({
    mutationFn: async ({ obraId, nome }: { obraId: number, nome: string }) => {
      return await criarLista(obraId, nome);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Seção criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      setShowAddListDialog(false);
      setValorInputNomeLista(''); // Limpar o input após sucesso
    },
    onError: (error) => {
      console.error('Erro ao criar seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar a seção.",
        variant: "destructive"
      });
    }
  });

  // Mutação para renomear lista
  const renomearListaMutation = useMutation({
    mutationFn: async ({ listaId, novoNome }: { listaId: number, novoNome: string }) => {
      return await renomearLista(listaId, novoNome);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Sucesso",
        description: "Seção renomeada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      setEditandoListaId(null);
      setValorInputNomeLista(''); 
      setShowEditListDialog(false); 
    },
    onError: (error) => {
      console.error('Erro ao renomear seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível renomear a seção.",
        variant: "destructive"
      });
    }
  });

  // Mutação para excluir lista
  const excluirListaMutation = useMutation({
    mutationFn: async (listaId: number) => {
      return await excluirLista(listaId);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Seção excluída com sucesso!",
      });
      // Invalidar a query e forçar um refetch
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      queryClient.refetchQueries({ queryKey: ['board', id] });
      setShowDeleteListDialog(false);
      setListaAtual(null); // Limpar a lista atual
    },
    onError: (error) => {
      console.error('Erro ao excluir seção:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir a seção.",
        variant: "destructive"
      });
    }
  });

  // Mutação para criar card
  const criarCardMutation = useMutation({
    mutationFn: async (params: { 
      listaId: number, 
      titulo: string, 
      descricao: string, 
      dataVencimento: string | null,
      etiquetas: string[]
    }) => {
      const { listaId, titulo, descricao, dataVencimento, etiquetas } = params;
      return await criarCard(listaId, titulo, descricao, dataVencimento, etiquetas);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      setShowAddCardDialog(false);
    },
    onError: (error) => {
      console.error('Erro ao criar card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar o card.",
        variant: "destructive"
      });
    }
  });

  // Mutação para excluir card
  const excluirCardMutation = useMutation({
    mutationFn: async (cardId: number) => {
      return await excluirCard(cardId);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Card excluído com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      setShowDeleteCardDialog(false);
    },
    onError: (error) => {
      console.error('Erro ao excluir card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o card.",
        variant: "destructive"
      });
    }
  });

  // Função auxiliar para enviar notificação local
  const enviarNotificacaoLocalConcluida = async (tituloPendencia: string) => {
    try {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Pendência Concluída",
              body: `A pendência "${tituloPendencia}" foi marcada como concluída.`,
              id: Math.floor(Math.random() * 10000) + 1,
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_notification',
              channelId: 'default',
            }
          ]
        });
      } else {
        console.warn('Permissão de notificação local negada.');
      }
    } catch (error) {
      console.error('Erro ao enviar notificação local:', error);
    }
  };

  // Mutação para mover card
  const moverCardMutation = useMutation({
    mutationFn: async ({ cardId, novaListaId }: { cardId: number, novaListaId: number }) => {
      return await moverCard(cardId, novaListaId);
    },
    onSuccess: async (_, variables) => {
      // A invalidação será feita no handleDragEnd após todas as operações.
      // A lógica de notificação e etiquetas também será movida para handleDragEnd.
      // Apenas um toast de sucesso específico para o movimento aqui.
      toast({ title: "Sucesso", description: "Card movido para outra seção!" });
    },
    onError: (error) => {
      console.error('Erro ao mover card para outra lista:', error);
      toast({ title: "Erro", description: "Não foi possível mover o card para outra seção.", variant: "destructive" });
      // A invalidação em caso de erro também será tratada no handleDragEnd.
    }
  });

  // Mutação para atualizar posição do card
  const atualizarPosicaoCardMutation = useMutation({
    mutationFn: async ({ cardId, listId, posicao }: { 
      cardId: number, 
      listId: number, 
      posicao: number 
    }) => {
      return await atualizarPosicaoCard(cardId, listId, posicao);
    },
    onSuccess: () => {
      // A invalidação será feita no handleDragEnd.
      // Toast específico para reordenação bem-sucedida.
      toast({ title: "Sucesso", description: "Ordem do card atualizada!" });
    },
    onError: (error) => {
      console.error('Erro ao atualizar posição do card:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar a ordem do card.", variant: "destructive" });
      // A invalidação em caso de erro também será tratada no handleDragEnd.
    }
  });

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

  // Funções para gerenciar listas (seções)
  const handleAddList = () => {
    setValorInputNomeLista(''); // Limpar o input ao abrir o diálogo de adicionar
    setShowAddListDialog(true);
  };

  const handleSaveNewList = async () => {
    if (!valorInputNomeLista.trim()) { // Usar valorInputNomeLista
      toast({ title: "Erro", description: "O nome da seção é obrigatório.", variant: "destructive" });
      return;
    }
    criarListaMutation.mutate({ 
      obraId: Number(id), 
      nome: capitalizarPrimeiraLetra(valorInputNomeLista) // Usar valorInputNomeLista
    });
  };

  const handleOpenEditListDialog = (lista: TrelloList) => {
    setListaAtual(lista); 
    setValorInputNomeLista(lista.title || (lista as any).nome || ''); 
    setShowEditListDialog(true);
  };

  const handleSaveEditListDialog = () => {
    if (!listaAtual) return;
    if (!valorInputNomeLista.trim()) { // Usar valorInputNomeLista
      toast({ title: "Erro", description: "O nome da seção é obrigatório.", variant: "destructive" });
      return;
    }
    renomearListaMutation.mutate({ 
      listaId: listaAtual.id, 
      novoNome: capitalizarPrimeiraLetra(valorInputNomeLista) // Usar valorInputNomeLista
    });
  };

  const handleCancelEditList = () => {
    setEditandoListaId(null);
    setValorInputNomeLista('');
    setShowEditListDialog(false); // Fechar o diálogo ao cancelar
  };

  const handleDeleteList = (lista: TrelloList) => {
    setListaAtual(lista);
    setShowDeleteListDialog(true);
  };

  const handleConfirmDeleteList = () => {
    if (!listaAtual) {
      toast({
        title: "Erro",
        description: "Seção não selecionada.",
        variant: "destructive"
      });
      return;
    }

    excluirListaMutation.mutate(listaAtual.id);
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
    
    criarCardMutation.mutate({
      listaId: listaAtual.id,
      titulo: titleCapitalizado,
      descricao: descriptionCapitalizada,
      dataVencimento: formattedDueDate,
      etiquetas: novoCard.labels
    });
  };

  const handleDeleteCard = (card: TrelloCard) => {
    setCardAtual(card as any);
    setShowDeleteCardDialog(true);
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardAtual) {
      toast({
        title: "Erro",
        description: "Card não selecionado.",
        variant: "destructive"
      });
      return;
    }

    excluirCardMutation.mutate(cardAtual.id);
  };

  const handleMoveCard = async (card: TrelloCard, novaListaId: number) => {
    moverCardMutation.mutate({ cardId: card.id, novaListaId });
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
    
    // Garantir que não há etiquetas duplicadas usando Set
    const uniqueLabels = [...new Set(labels)];
    
    setNovoCard({...novoCard, labels: uniqueLabels});
  };
  
  // Função auxiliar para obter a classe de cor da etiqueta
  const getEtiquetaCor = (nome: string) => {
    const nomeNormalizado = nome.toLowerCase().trim();
    
    if (nomeNormalizado.includes('urgente')) return 'etiqueta-urgente';
    if (nomeNormalizado.includes('fazendo')) return 'etiqueta-fazendo';
    if (nomeNormalizado.includes('concluído') || nomeNormalizado.includes('concluido')) return 'etiqueta-concluido';
    if (nomeNormalizado.includes('pendente')) return 'etiqueta-pendente';
    if (nomeNormalizado.includes('aguardando')) return 'etiqueta-aguardando';
    
    return 'etiqueta-padrao';
  };
  
  // Função auxiliar para renderizar labels
  const renderizarLabels = (labels: TrelloLabel[]) => {
    if (!labels || labels.length === 0) return null;
    
    return labels.map((label) => (
      <Badge 
        key={label.id}
        className={`text-xs mr-1 ${label.color || 'bg-gray-500 text-white'}`}
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
      
      // Enviar requisição ao backend para criar a checklist
      const novaChecklist = await criarChecklist(cardAtual.id, novoChecklistNome);
      
      // Limpar o input
      setNovoChecklistNome('');
      
      // Se a checklist foi criada com sucesso, atualizar o estado local
      if (novaChecklist) {
        // Criar cópia profunda do cardAtual
        const cardAtualizado = JSON.parse(JSON.stringify(cardAtual));
        
        // Adicionar a nova checklist com um array de items vazio
        cardAtualizado.checklists.push({
          ...novaChecklist,
          items: []
        });
        
        // Atualizar o estado do card
        setCardAtual(cardAtualizado);
        
        // Atualizar também no board para manter consistência
        if (board) {
          const newBoard = JSON.parse(JSON.stringify(board));
          const listaIndex = newBoard.lists.findIndex((l: TrelloList) => l.id === cardAtual.list_id);
          
          if (listaIndex !== -1) {
            const cardIndex = newBoard.lists[listaIndex].cards.findIndex((c: TrelloCard) => c.id === cardAtual.id);
            
            if (cardIndex !== -1) {
              const cardNoBoard = newBoard.lists[listaIndex].cards[cardIndex];
              
              // Garantir que a propriedade checklists existe
              if (!cardNoBoard.checklists) {
                cardNoBoard.checklists = [];
              }
              
              // Adicionar a nova checklist com items vazio
              cardNoBoard.checklists.push({
                ...novaChecklist,
                items: []
              });
            }
          }
          
          // Atualizar o estado do board sem fazer fetch
          queryClient.setQueryData(['board', id], newBoard);
        }
      }
      
      toast({
        title: "Sucesso",
        description: "Checklist criada com sucesso!",
      });
      
      // Invalidar a query para garantir que os dados serão atualizados na próxima vez
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    } catch (error) {
      console.error('Erro ao criar checklist:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível criar a checklist.",
        variant: "destructive"
      });
      
      // Em caso de erro, recarregar os dados para manter consistência
      refetchBoard();
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

      // Criar novo item na checklist
      const novoItem = await adicionarItemChecklist(checklistId, capitalizarPrimeiraLetra(novoChecklistItem));
      
      // Limpar o campo de input
      setNovoChecklistItem('');
      
      // Atualizar o estado local em vez de recarregar todo o board
      if (cardAtual) {
        // Criar uma cópia profunda do cardAtual para evitar modificações diretas no estado
        const cardAtualizado = JSON.parse(JSON.stringify(cardAtual));
        
        // Encontrar a checklist para adicionar o item
        const checklistIndex = cardAtualizado.checklists.findIndex(
          (checklist: TrelloChecklist) => checklist.id === checklistId
        );
        
        if (checklistIndex !== -1) {
          // Garantir que o array de items existe
          if (!cardAtualizado.checklists[checklistIndex].items) {
            cardAtualizado.checklists[checklistIndex].items = [];
          }
          
          // Adicionar o novo item à checklist
          cardAtualizado.checklists[checklistIndex].items.push(novoItem);
          
          // Atualizar o estado do cardAtual com o novo item
          setCardAtual(cardAtualizado);
          
          // Também atualizar o item no board em memória para manter a consistência
          if (board) {
            const newBoard = JSON.parse(JSON.stringify(board));
            const listaIndex = newBoard.lists.findIndex((l: TrelloList) => l.id === cardAtual.list_id);
            
            if (listaIndex !== -1) {
              const cardIndex = newBoard.lists[listaIndex].cards.findIndex((c: TrelloCard) => c.id === cardAtual.id);
              
              if (cardIndex !== -1 && newBoard.lists[listaIndex].cards[cardIndex]) {
                // Garantir que a propriedade checklists existe
                if (!newBoard.lists[listaIndex].cards[cardIndex].checklists) {
                  newBoard.lists[listaIndex].cards[cardIndex].checklists = [];
                }
                
                // Encontrar a checklist correspondente no board
                const boardChecklistIndex = newBoard.lists[listaIndex].cards[cardIndex].checklists.findIndex(
                  (cl: TrelloChecklist) => cl.id === checklistId
                );
                
                if (boardChecklistIndex !== -1) {
                  // Garantir que o array de items existe
                  if (!newBoard.lists[listaIndex].cards[cardIndex].checklists[boardChecklistIndex].items) {
                    newBoard.lists[listaIndex].cards[cardIndex].checklists[boardChecklistIndex].items = [];
                  }
                  
                  // Adicionar o item à checklist no board
                  newBoard.lists[listaIndex].cards[cardIndex].checklists[boardChecklistIndex].items.push(novoItem);
                }
              }
            }
            
            // Atualizar o estado do board sem fazer um novo fetch do servidor
            queryClient.setQueryData(['board', id], newBoard);
          }
        }
      }
      
      toast({
        title: "Sucesso",
        description: "Item adicionado com sucesso!",
      });
      
      // Invalidar a query para garantir que os dados sejam atualizados na próxima vez que o componente for renderizado
      queryClient.invalidateQueries({ queryKey: ['board', id] });
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
      // Criar uma cópia do item com o estado checked invertido
      const itemAtualizado = { ...item, checked: !item.checked };
      
      // Atualizar o estado local imediatamente para feedback instantâneo ao usuário
      if (cardAtual) {
        // Criar cópia profunda do cardAtual para evitar modificações diretas no estado
        const cardAtualizado = JSON.parse(JSON.stringify(cardAtual));
        
        // Procurar o item em todas as checklists do card e atualizar seu estado
        let itemEncontrado = false;
        cardAtualizado.checklists.forEach((checklist: TrelloChecklist) => {
          const itemIndex = checklist.items.findIndex((i: TrelloChecklistItem) => i.id === item.id);
          if (itemIndex !== -1) {
            checklist.items[itemIndex].checked = !item.checked;
            itemEncontrado = true;
          }
        });
        
        if (itemEncontrado) {
          // Atualizar o estado do card atual com o novo estado do item
          setCardAtual(cardAtualizado);
          
          // Também atualizar o item no board em memória para manter consistência
          if (board) {
            const newBoard = JSON.parse(JSON.stringify(board));
            const listaIndex = newBoard.lists.findIndex((l: TrelloList) => l.id === cardAtual.list_id);
            
            if (listaIndex !== -1) {
              const cardIndex = newBoard.lists[listaIndex].cards.findIndex((c: TrelloCard) => c.id === cardAtual.id);
              
              if (cardIndex !== -1 && newBoard.lists[listaIndex].cards[cardIndex]) {
                const cardNoBoard = newBoard.lists[listaIndex].cards[cardIndex];
                
                if (cardNoBoard.checklists) {
                  cardNoBoard.checklists.forEach((checklist: TrelloChecklist) => {
                    const itemIndex = checklist.items.findIndex((i: TrelloChecklistItem) => i.id === item.id);
                    if (itemIndex !== -1) {
                      checklist.items[itemIndex].checked = !item.checked;
                    }
                  });
                }
              }
            }
            
            // Atualizar o board no estado sem fazer uma nova requisição ao backend
            queryClient.setQueryData(['board', id], newBoard);
          }
        }
      }
      
      // Após atualizar o estado local, enviar a mudança para o backend
      await atualizarItemChecklist(item.id, itemAtualizado);
      
      // Invalidar a query para que os dados sejam recarregados na próxima vez
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o item.",
        variant: "destructive"
      });
      
      // Em caso de erro, recarregar os dados do board para manter consistência
      refetchBoard();
    }
  };
  
  const handleDeleteChecklistItem = async (itemId: number) => {
    try {
      // Atualizar estado local imediatamente para feedback instantâneo
      if (cardAtual) {
        // Criar cópia profunda do cardAtual
        const cardAtualizado = JSON.parse(JSON.stringify(cardAtual));
        let itemRemovido = false;
        
        // Remover o item de todas as checklists
        cardAtualizado.checklists.forEach((checklist: TrelloChecklist) => {
          const itemIndex = checklist.items.findIndex((i: TrelloChecklistItem) => i.id === itemId);
          if (itemIndex !== -1) {
            checklist.items.splice(itemIndex, 1);
            itemRemovido = true;
          }
        });
        
        if (itemRemovido) {
          // Atualizar o estado do card
          setCardAtual(cardAtualizado);
          
          // Atualizar também no board
          if (board) {
            const newBoard = JSON.parse(JSON.stringify(board));
            const listaIndex = newBoard.lists.findIndex((l: TrelloList) => l.id === cardAtual.list_id);
            
            if (listaIndex !== -1) {
              const cardIndex = newBoard.lists[listaIndex].cards.findIndex((c: TrelloCard) => c.id === cardAtual.id);
              
              if (cardIndex !== -1) {
                const cardNoBoard = newBoard.lists[listaIndex].cards[cardIndex];
                if (cardNoBoard && cardNoBoard.checklists) {
                  cardNoBoard.checklists.forEach((checklist: TrelloChecklist) => {
                    const itemIndex = checklist.items.findIndex((i: TrelloChecklistItem) => i.id === itemId);
                    if (itemIndex !== -1) {
                      checklist.items.splice(itemIndex, 1);
                    }
                  });
                }
              }
            }
            
            // Atualizar o estado do board sem fazer fetch
            queryClient.setQueryData(['board', id], newBoard);
          }
        }
      }
      
      // Enviar a exclusão para o backend
      await excluirItemChecklist(itemId);
      
      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso!",
      });
      
      // Invalidar a query para atualização futura
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o item.",
        variant: "destructive"
      });
      
      // Em caso de erro, recarregar os dados
      refetchBoard();
    }
  };
  
  const handleDeleteChecklist = async (checklistId: number) => {
    try {
      // Atualizar o estado local imediatamente para feedback instantâneo
      if (cardAtual) {
        // Criar cópia profunda
        const cardAtualizado = JSON.parse(JSON.stringify(cardAtual));
        
        // Encontrar o índice da checklist a ser removida
        const checklistIndex = cardAtualizado.checklists.findIndex(
          (checklist: TrelloChecklist) => checklist.id === checklistId
        );
        
        if (checklistIndex !== -1) {
          // Remover a checklist do array
          cardAtualizado.checklists.splice(checklistIndex, 1);
          
          // Atualizar o estado do card
          setCardAtual(cardAtualizado);
          
          // Atualizar também no board
          if (board) {
            const newBoard = JSON.parse(JSON.stringify(board));
            const listaIndex = newBoard.lists.findIndex((l: TrelloList) => l.id === cardAtual.list_id);
            
            if (listaIndex !== -1) {
              const cardIndex = newBoard.lists[listaIndex].cards.findIndex((c: TrelloCard) => c.id === cardAtual.id);
              
              if (cardIndex !== -1) {
                const cardNoBoard = newBoard.lists[listaIndex].cards[cardIndex];
                if (cardNoBoard && cardNoBoard.checklists) {
                  const boardChecklistIndex = cardNoBoard.checklists.findIndex(
                    (cl: TrelloChecklist) => cl.id === checklistId
                  );
                  
                  if (boardChecklistIndex !== -1) {
                    cardNoBoard.checklists.splice(boardChecklistIndex, 1);
                  }
                }
              }
            }
            
            // Atualizar o estado do board sem fazer fetch
            queryClient.setQueryData(['board', id], newBoard);
          }
        }
      }
      
      // Enviar a exclusão para o backend
      await excluirChecklist(checklistId);
      
      toast({
        title: "Sucesso",
        description: "Checklist excluída com sucesso!",
      });
      
      // Invalidar a query para atualização futura
      queryClient.invalidateQueries({ queryKey: ['board', id] });
    } catch (error) {
      console.error('Erro ao excluir checklist:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir a checklist.",
        variant: "destructive"
      });
      
      // Em caso de erro, recarregar os dados para restaurar o estado correto
      refetchBoard();
    }
  };
  
  const handleViewCardDetails = (card: TrelloCard) => {
    setCardAtual({
      ...(card as any),
      checklists: (card as any).checklists || [],
      comments: (card as any).comments || [],
      attachments: (card as any).attachments || [],
      labels: card.labels || []
    });
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
    
    let notificacaoEnviada = false; // Flag para evitar notificação dupla

    try {
      const etiquetasAtuais = await buscarEtiquetas();
      const etiquetaObj = etiquetasAtuais.find(e => e.title === label);
      const etiquetaFazendo = etiquetasAtuais.find(e => e.title.toLowerCase() === 'fazendo');
      const etiquetaUrgente = etiquetasAtuais.find(e => e.title.toLowerCase() === 'urgente');
      
      if (!etiquetaObj) {
        console.error('Etiqueta não encontrada:', label);
        return;
      }
      
      const cardLabels = Array.isArray(cardAtual.labels) ? cardAtual.labels : [];
      const hasLabel = cardLabels.some(l => 
        (typeof l === 'string' ? l === label : l.title === label)
      );
      
      // Se está adicionando a etiqueta "Concluído", remover "Fazendo" se existir
      if (!hasLabel && 
          label.toLowerCase() === 'concluído' && 
          etiquetaFazendo && 
          cardLabels.some(l => (typeof l === 'string' ? l === etiquetaFazendo.title : l.id === etiquetaFazendo.id))) {
        await removerEtiqueta(cardAtual.id, etiquetaFazendo.id);
      }
      
      // Se está adicionando a etiqueta "Concluído", remover "Urgente" se existir
      if (!hasLabel && 
          label.toLowerCase() === 'concluído' && 
          etiquetaUrgente && 
          cardLabels.some(l => (typeof l === 'string' ? l === etiquetaUrgente.title : l.id === etiquetaUrgente.id))) {
        await removerEtiqueta(cardAtual.id, etiquetaUrgente.id);
      }
      
      if (hasLabel) {
        await removerEtiqueta(cardAtual.id, etiquetaObj.id);
      } else {
        await adicionarEtiqueta(cardAtual.id, etiquetaObj.id);
        // Verificar se a etiqueta adicionada foi "Concluído"
        if (label.toLowerCase() === 'concluído') {
           // Enviar notificação PUSH (já existente)
           await notificationService.notificarPendenciaConcluida(
            Number(id),
            cardAtual.title
          );
          // Enviar notificação LOCAL
          await enviarNotificacaoLocalConcluida(cardAtual.title);
          notificacaoEnviada = true;
        }
      }
      
      await refetchBoard();
      
      // Atualizar o estado local do card atual
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual.list_id);
      if (lista) {
        const cardAtualizado = lista.cards.find(c => c.id === cardAtual.id);
        if (cardAtualizado) {
          setCardAtual({
            ...(cardAtualizado as any),
            checklists: (cardAtualizado as any).checklists || [],
            comments: (cardAtualizado as any).comments || [],
            attachments: (cardAtualizado as any).attachments || [],
            labels: cardAtualizado.labels || []
          });
          setNovoCard(prev => ({ // Usar prevState para segurança
            ...prev,
            labels: cardAtualizado.labels.map(l => l.title)
          }));
        }
      }
      
      toast({ title: "Sucesso", description: hasLabel ? "Etiqueta removida com sucesso!" : "Etiqueta adicionada com sucesso!" });
    } catch (error) {
      console.error('Erro ao atualizar etiquetas:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar as etiquetas.", variant: "destructive" });
    }
  };

  // Função para editar o título do card diretamente na visualização
  const handleEditarTituloCard = (card: TrelloCard) => {
    setEditandoTituloCardId(card.id);
    setNovoTituloCard(card.title);
  };

  const handleSalvarTituloCard = (cardId: number) => {
    if (!novoTituloCard.trim()) {
      toast({
        title: "Erro",
        description: "O título do card é obrigatório.",
        variant: "destructive"
      });
      // Mantém a edição aberta para o usuário corrigir
      return;
    }
    atualizarCardMutation.mutate({ cardId, updates: { title: novoTituloCard } });
  };

  const handleCancelEditTituloCard = () => {
    setEditandoTituloCardId(null);
    setNovoTituloCard('');
  };

  // Funções para editar título do card no diálogo
  const handleEditarTituloCardNoDialogo = () => {
    if (!cardAtual) return;
    setEditandoTituloCardId(cardAtual.id);
    setNovoTituloCard(cardAtual.title);
  };

  const handleSalvarTituloCardNoDialogo = async () => {
    if (!cardAtual || !novoTituloCard.trim()) {
      toast({
        title: "Erro",
        description: "O título do card é obrigatório.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await atualizarCard(cardAtual.id, { title: capitalizarPrimeiraLetra(novoTituloCard) });
      
      // Atualizar card atual
      setCardAtual({
        ...cardAtual,
        title: capitalizarPrimeiraLetra(novoTituloCard)
      });
      
      setEditandoTituloCardId(null);
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      
      toast({
        title: "Sucesso",
        description: "Título atualizado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o título.",
        variant: "destructive"
      });
    }
  };

  const handleCancelEditTituloCardNoDialogo = () => {
    setEditandoTituloCardId(null);
    setNovoTituloCard('');
  };

  // Funções para editar descrição do card no diálogo
  const handleEditarDescricaoCardNoDialogo = () => {
    if (!cardAtual) return;
    setEditandoDescricaoCardId(cardAtual.id);
    setNovaDescricaoCard(cardAtual.description || '');
  };

  const handleSalvarDescricaoCardNoDialogo = async () => {
    if (!cardAtual) return;
    
    try {
      await atualizarCard(cardAtual.id, { description: capitalizarPrimeiraLetra(novaDescricaoCard) });
      
      // Atualizar card atual
      setCardAtual({
        ...cardAtual,
        description: capitalizarPrimeiraLetra(novaDescricaoCard)
      });
      
      setEditandoDescricaoCardId(null);
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      
      toast({
        title: "Sucesso",
        description: "Descrição atualizada com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao atualizar descrição:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a descrição.",
        variant: "destructive"
      });
    }
  };

  const handleCancelEditDescricaoCardNoDialogo = () => {
    setEditandoDescricaoCardId(null);
    setNovaDescricaoCard('');
  };

  // Mutação para atualizar card
  const atualizarCardMutation = useMutation({
    mutationFn: async ({ cardId, updates }: { cardId: number, updates: any }) => {
      return await atualizarCard(cardId, updates);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Card atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['board', id] });
      setEditandoTituloCardId(null);
      setNovoTituloCard('');
    },
    onError: (error) => {
      console.error('Erro ao atualizar card:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o card.",
        variant: "destructive"
      });
    }
  });

  // Função para reordenar os cards
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination || !board) {
      console.log("[DragEnd] Sem destino ou board, retornando.");
      return;
    }

    const cardId = parseInt(draggableId);
    const sourceListId = parseInt(source.droppableId);
    const destListId = parseInt(destination.droppableId);

    if (sourceListId === destListId && source.index === destination.index) {
      console.log("[DragEnd] Card solto na mesma posição.");
      return; // Card foi solto na mesma posição
    }

    // 1. Atualização Otimista da UI
    const currentBoard = queryClient.getQueryData<TrelloBoard>(['board', id]);
    const newBoardOptimistic = JSON.parse(JSON.stringify(currentBoard || board)) as TrelloBoard;

    const sourceListOptimistic = newBoardOptimistic.lists.find(l => l.id === sourceListId);
    const destListOptimistic = newBoardOptimistic.lists.find(l => l.id === destListId);

    if (!sourceListOptimistic || !destListOptimistic) {
      console.error("[DragEnd] Lista de origem ou destino otimista não encontrada.");
      // Não reverter aqui ainda, pois o backend pode estar ok.
      // Apenas logar e deixar o try/catch principal lidar com falhas de API.
      return;
    }

    const [movedCard] = sourceListOptimistic.cards.splice(source.index, 1);
    if (!movedCard) {
        console.error("[DragEnd] Card movido não encontrado na lista de origem otimista.");
        return;
    }
    destListOptimistic.cards.splice(destination.index, 0, movedCard);
    queryClient.setQueryData(['board', id], newBoardOptimistic);
    console.log("[DragEnd] UI atualizada otimisticamente.");

    try {
      // 2. Mover Card entre Listas (se necessário)
      if (sourceListId !== destListId) {
        console.log(`[DragEnd] Movendo card ${cardId} da lista ${sourceListId} para ${destListId} no backend.`);
        await moverCardMutation.mutateAsync({ cardId, novaListaId: destListId });
        // Lógica de notificação e etiquetas será aqui, após sucesso do moverCard
        if (board) { // usar 'board' do useQuery para dados mais recentes pós-mutação
            const freshBoardData = queryClient.getQueryData<TrelloBoard>(['board', id]) || board;
            const listaDestino = freshBoardData.lists.find(l => l.id === destListId);
            if (listaDestino?.title?.trim().toLowerCase().includes('concluído')) {
                const cardInfo = freshBoardData.lists.flatMap(l => l.cards).find(c => c.id === cardId);
                if (cardInfo) {
                    await notificationService.notificarPendenciaConcluida(Number(id), cardInfo.title);
                    // await enviarNotificacaoLocalConcluida(cardInfo.title); // Descomentar se LocalNotifications estiver configurado
                    
                    // Lógica de etiquetas
                    const etiquetasAtuais = await buscarEtiquetas(); 
                    const etiquetaFazendo = etiquetasAtuais.find(e => e.title.toLowerCase() === 'fazendo');
                    const etiquetaUrgente = etiquetasAtuais.find(e => e.title.toLowerCase() === 'urgente');
                    const etiquetaConcluido = etiquetasAtuais.find(e => e.title.toLowerCase() === 'concluído');
                    const cardLabels = Array.isArray(cardInfo.labels) ? cardInfo.labels : [];

                    if(etiquetaConcluido){
                        const hasConcluido = cardLabels.some(l => (typeof l === 'string' ? l === etiquetaConcluido.title : l.id === etiquetaConcluido.id));
                        if(!hasConcluido) await adicionarEtiqueta(cardId, etiquetaConcluido.id);
                    }
                    if(etiquetaFazendo && cardLabels.some(l => (typeof l === 'string' ? l === etiquetaFazendo.title : l.id === etiquetaFazendo.id))){
                        await removerEtiqueta(cardId, etiquetaFazendo.id);
                    }
                    if(etiquetaUrgente && cardLabels.some(l => (typeof l === 'string' ? l === etiquetaUrgente.title : l.id === etiquetaUrgente.id))){
                        await removerEtiqueta(cardId, etiquetaUrgente.id);
                    }
                }
            } else if (listaDestino?.title?.trim().toLowerCase().includes('fazendo')) {
                const etiquetasAtuais = await buscarEtiquetas();
                const etiquetaFazendo = etiquetasAtuais.find(e => e.title.toLowerCase() === 'fazendo');
                const cardInfo = freshBoardData.lists.flatMap(l => l.cards).find(c => c.id === cardId);
                if (cardInfo && etiquetaFazendo) {
                    const cardLabels = Array.isArray(cardInfo.labels) ? cardInfo.labels : [];
                    const hasFazendo = cardLabels.some(l => (typeof l === 'string' ? l === etiquetaFazendo.title : l.id === etiquetaFazendo.id));
                    if (!hasFazendo) await adicionarEtiqueta(cardId, etiquetaFazendo.id);
                }
            }
        }
      }

      // 3. Atualizar Posição do Card na Lista de Destino
      // Usar newBoardOptimistic para calcular a posição, pois reflete o estado visual desejado
      const cardsInDestList = newBoardOptimistic.lists.find(l => l.id === destListId)?.cards || [];
      let newPosition;

      if (destination.index === 0) {
        const nextCard = cardsInDestList.length > 1 ? cardsInDestList[1] : null;
        newPosition = nextCard && nextCard.position ? nextCard.position / 2 : 1000;
      } else if (destination.index >= cardsInDestList.length - 1) {
        const prevCard = cardsInDestList[cardsInDestList.length - 2]; 
        newPosition = prevCard && prevCard.position ? prevCard.position + 1000 : (cardsInDestList[0]?.position || 0) + 1000;
      } else {
        const prevCard = cardsInDestList[destination.index - 1];
        const nextCard = cardsInDestList[destination.index + 1];
        const prevCardPos = prevCard && prevCard.position ? prevCard.position : 0;
        const nextCardPos = nextCard && nextCard.position ? nextCard.position : (prevCardPos + 2000);
        newPosition = (prevCardPos + nextCardPos) / 2;
      }
      
      if (isNaN(newPosition) || newPosition <= 0) {
        console.warn("[DragEnd] Cálculo de nova posição inválido, usando fallback:", newPosition);
        newPosition = Date.now(); 
      }
      
      console.log(`[DragEnd] Atualizando posição do card ${cardId} para ${newPosition} na lista ${destListId}.`);
      await atualizarPosicaoCardMutation.mutateAsync({
        cardId,
        listId: destListId,
        posicao: newPosition
      });
      
      // 4. Sucesso: Invalidar query para buscar dados frescos e consistentes do backend.
      console.log("[DragEnd] Todas as operações de backend concluídas. Invalidando query do board.");
      await queryClient.refetchQueries({ queryKey: ['board', id], exact: true });

      toast({
        title: "Operação Concluída",
        description: `Card "${movedCard.title.substring(0, 30)}${movedCard.title.length > 30 ? '...' : ''}" ${sourceListId === destListId ? 'reordenado' : 'movido'} com sucesso.`,
      });

    } catch (error) {
      console.error('[DragEnd] Erro crítico ao mover/reordenar card:', error);
      toast({
        title: "Erro Crítico",
        description: "Não foi possível completar a operação. Restaurando o quadro para o estado anterior...",
        variant: "destructive"
      });
      // Reverter para o estado anterior do board em caso de erro em qualquer etapa crítica.
      // queryClient.setQueryData(['board', id], currentBoard); // currentBoard é o estado antes da atualização otimista.
      // Ou, de forma mais segura, apenas refetch para garantir consistência com o servidor.
      await queryClient.refetchQueries({ queryKey: ['board', id], exact: true });
    }
  };

  // Função para gerar o PDF usando window.print
  const gerarPDF = async () => {
    try {
      if (!board) {
        toast({ title: "Erro", description: 'Nenhum dado disponível para gerar o PDF', variant: 'destructive' });
        return;
      }

      // Criar o conteúdo HTML para o PDF
      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              ${pdfStyles}
              
              /* Estilos adicionais para melhorar a estrutura do relatório */
              .card {
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                page-break-inside: avoid;
                break-inside: avoid;
              }
              
              .section {
                margin-bottom: 30px;
                border-radius: 8px;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              
              .section-title {
                background-color: #f1f5f9;
                padding: 10px 15px;
                border-radius: 4px;
                margin-bottom: 15px;
              }
              
              p {
                orphans: 4;
                widows: 4;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: manual;
              }
              
              .labels-container {
                display: flex;
                flex-wrap: wrap;
                gap: 3px;
                margin: 8px 0;
              }
              
              .label {
                padding: 3px 6px;
                font-size: 10px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Relatório de Pendências</h1>
              <p class="obra-info">Obra: ${obra?.nome}</p>
              <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
 
            ${board.lists.map(list => `
              <div class="section">
                <h2 class="section-title">${list.title}</h2>
                ${list.cards.length > 0 ? list.cards.map(card => `
                  <div class="card">
                    <h3 class="card-title">${card.title}</h3>
                    
                    ${card.description ? `
                      <p class="card-description">${card.description}</p>
                    ` : ''}
                    
                    ${card.labels?.length ? `
                      <div class="labels-container">
                        ${card.labels.map(label => {
                          // Mapear cores diretamente com base no nome da cor ou título da etiqueta
                          let bgColor = '#6b7280'; // cor padrão (cinza)
                          let textColor = '#ffffff';
                          
                          // Identificar a cor com base nas propriedades da etiqueta
                          if (label.color === 'green' || (typeof label.title === 'string' && label.title.toLowerCase().includes('concluído'))) {
                            bgColor = '#10b981'; // verde
                          } else if (label.color === 'yellow' || (typeof label.title === 'string' && label.title.toLowerCase().includes('fazendo'))) {
                            bgColor = '#f59e0b'; // amarelo
                          } else if (label.color === 'red' || (typeof label.title === 'string' && label.title.toLowerCase().includes('urgente'))) {
                            bgColor = '#ef4444'; // vermelho
                          } else if (label.color === 'blue' || (typeof label.title === 'string' && label.title.toLowerCase().includes('pendente'))) {
                            bgColor = '#3b82f6'; // azul
                          } else if (label.color === 'purple') {
                            bgColor = '#8b5cf6'; // roxo
                          }
                          
                          return `<span class="label" style="background-color: ${bgColor}; color: ${textColor};">${label.title}</span>`;
                        }).join('')}
                      </div>
                    ` : ''}
                    
                    ${card.checklists?.map(checklist => `
                      <div class="checklist">
                        <h4 class="checklist-title">${checklist.title}</h4>
                        ${checklist.items?.map(item => `
                          <div class="checklist-item ${item.checked ? 'completed' : ''}">
                            ${item.checked ? '✓' : '○'} ${item.title}
                          </div>
                        `).join('')}
                      </div>
                    `).join('')}
                    
                    ${card.due_date ? `
                      <p class="card-due-date">
                        Data de vencimento: ${formatarData(card.due_date)}
                      </p>
                    ` : ''}
                  </div>
                `).join('') : '<p style="color: #666; font-style: italic;">Nenhum card nesta lista.</p>'}
              </div>
            `).join('')}
          </body>
        </html>
      `;

      // Criar elemento temporário para renderizar o HTML - mantendo-o visível temporariamente para debug
      const tempDiv = document.createElement('div');
      tempDiv.style.width = '800px'; // Largura fixa
      tempDiv.style.margin = '0 auto';
      tempDiv.style.position = 'fixed';
      tempDiv.style.zIndex = '-1000'; // Atrás de todo conteúdo
      tempDiv.style.left = '0';
      tempDiv.style.top = '0';
      tempDiv.style.background = '#ffffff';
      tempDiv.style.padding = '20px';
      tempDiv.innerHTML = content;
      document.body.appendChild(tempDiv);

      try {
        // Dar um pequeno atraso para garantir que tudo seja renderizado corretamente
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Configurar opções do html2canvas
        const options = {
          scale: 2,
          useCORS: true,
          logging: true, // Ativar logs para debug
          backgroundColor: '#ffffff',
          allowTaint: true,
          foreignObjectRendering: false, // Definir como false para maior compatibilidade
        };

        // Gerar imagem do conteúdo
        console.log('Iniciando captura com html2canvas...');
        const canvas = await html2canvas(tempDiv, options);
        console.log('Captura concluída!');
        
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error('Canvas gerado tem dimensões zero');
        }
        
        // Criar PDF
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        // Configurar fonte e tamanho
        pdf.setFont('helvetica');
        pdf.setFontSize(12);

        // Adicionar a imagem ao PDF
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        console.log('Dimensões canvas:', canvas.width, 'x', canvas.height);
        console.log('Dimensões de imagem no PDF:', imgWidth, 'x', imgHeight, 'mm');
        
        let heightLeft = imgHeight;
        let position = 0;

        // Primeira página
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297; // A4 height in mm

        // Adicionar páginas adicionais se necessário
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= 297;
        }

        // Salvar o PDF
        pdf.save(`pendencias_${obra?.nome?.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);

        toast({ title: "Sucesso", description: 'PDF gerado com sucesso!'});
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        toast({ title: "Erro", description: 'Erro ao gerar o PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), variant: 'destructive' });
      } finally {
        // Limpar elemento temporário
        document.body.removeChild(tempDiv);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({ title: "Erro", description: 'Erro ao gerar o PDF', variant: 'destructive' });
    }
  };

  // Função para lidar com o clique no botão de gerar PDF
  const handleGerarOuCompartilharPDF = async () => {
    const deviceInfo = await Device.getInfo();
    if (deviceInfo.platform !== 'web') {
      console.log('[DEBUG] Plataforma mobile detectada, chamando compartilharPDF');
      await compartilharPDF();
    } else {
      console.log('[DEBUG] Plataforma web detectada, chamando gerarPDF');
      await gerarPDF();
    }
  };

  // Função para compartilhar PDF
  const compartilharPDF = async () => {
    try {
      if (!board) {
        toast({
          title: 'Erro',
          description: 'Quadro não carregado.',
          variant: 'destructive'
        });
        return;
      }

      if (Capacitor.isNativePlatform()) {
        // Criar o conteúdo HTML com estilos
        const content = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                ${pdfStyles}
                
                /* Estilos adicionais específicos para o PDF */
                .card {
                  margin-bottom: 20px;
                  page-break-inside: avoid;
                  break-inside: avoid;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                
                .section {
                  margin-bottom: 30px;
                  border-radius: 8px;
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                
                .section-title {
                  background-color: #f1f5f9;
                  padding: 10px 15px;
                  border-radius: 4px;
                  margin-bottom: 15px;
                }
                
                .checklist-item {
                  margin: 5px 0;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                  hyphens: manual;
                }
                
                .labels-container {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 3px;
                  margin: 8px 0;
                }
                
                .label {
                  display: inline-block;
                  margin-right: 4px;
                  margin-bottom: 4px;
                  padding: 3px 6px;
                  font-size: 10px;
                }
                
                p {
                  orphans: 4;
                  widows: 4;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                  hyphens: manual;
                }
              </style>
            </head>
            <body>
              <div class="report-header">
                <h1>Relatório de Pendências</h1>
                <p class="obra-nome">${obra?.nome}</p>
                <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
              
              ${board.lists.map(list => `
                <div class="section">
                  <h2 class="section-title">${list.title}</h2>
                  ${list.cards.length > 0 ? list.cards.map(card => `
                    <div class="card">
                      <h3 class="card-title">${card.title}</h3>
                      
                      ${card.description ? `
                        <p class="card-description">${card.description}</p>
                      ` : ''}
                      
                      ${card.labels?.length ? `
                        <div class="labels-container">
                          ${card.labels.map(label => {
                            // Mapear cores diretamente com base no nome da cor ou título da etiqueta
                            let bgColor = '#6b7280'; // cor padrão (cinza)
                            let textColor = '#ffffff';
                            
                            // Identificar a cor com base nas propriedades da etiqueta
                            if (label.color === 'green' || (typeof label.title === 'string' && label.title.toLowerCase().includes('concluído'))) {
                              bgColor = '#10b981'; // verde
                            } else if (label.color === 'yellow' || (typeof label.title === 'string' && label.title.toLowerCase().includes('fazendo'))) {
                              bgColor = '#f59e0b'; // amarelo
                            } else if (label.color === 'red' || (typeof label.title === 'string' && label.title.toLowerCase().includes('urgente'))) {
                              bgColor = '#ef4444'; // vermelho
                            } else if (label.color === 'blue' || (typeof label.title === 'string' && label.title.toLowerCase().includes('pendente'))) {
                              bgColor = '#3b82f6'; // azul
                            } else if (label.color === 'purple') {
                              bgColor = '#8b5cf6'; // roxo
                            }
                            
                            return `<span class="label" style="background-color: ${bgColor}; color: ${textColor};">${label.title}</span>`;
                          }).join('')}
                        </div>
                      ` : ''}
                      
                      ${card.checklists?.map(checklist => `
                        <div class="checklist">
                          <h4 class="checklist-title">${checklist.title}</h4>
                          ${checklist.items?.map(item => `
                            <div class="checklist-item ${item.checked ? 'completed' : ''}">
                              ${item.checked ? '✓' : '○'} ${item.title}
                            </div>
                          `).join('')}
                        </div>
                      `).join('')}
                      
                      ${card.due_date ? `
                        <p class="card-due-date">
                          Data de vencimento: ${formatarData(card.due_date)}
                        </p>
                      ` : ''}
                    </div>
                  `).join('') : '<p style="color: #666; font-style: italic;">Nenhum card nesta lista.</p>'}
                </div>
              `).join('')}
            </body>
          </html>
        `;

        // Criar elemento temporário para renderizar o HTML
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '800px'; // Largura fixa
        tempDiv.style.margin = '0 auto';
        tempDiv.style.position = 'fixed';
        tempDiv.style.zIndex = '-1000'; // Atrás de todo conteúdo
        tempDiv.style.left = '0';
        tempDiv.style.top = '0';
        tempDiv.style.background = '#ffffff';
        tempDiv.style.padding = '20px';
        tempDiv.innerHTML = content;
        document.body.appendChild(tempDiv);

        // Gerar PDF usando jsPDF e html2canvas
        try {
          // Dar um pequeno atraso para garantir que tudo seja renderizado corretamente
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('[DEBUG] Capturando elemento para PDF...');
          const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            allowTaint: true,
            foreignObjectRendering: false,
            logging: true
          });
          
          console.log('[DEBUG] Dimensões do canvas:', canvas.width, 'x', canvas.height);
          
          if (canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas gerado tem dimensões zero');
          }
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });

          pdf.setFont('helvetica');
          pdf.setFontSize(12);

          // --- Lógica de Paginação (igual à gerarPDF) ---
          const pdfWidth = 210;
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          let heightLeft = pdfHeight;
          let position = 0;
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= 297;
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= 297;
          }
          // --- Fim Lógica de Paginação ---

          // Obter PDF como Base64
          const pdfBase64 = pdf.output('datauristring').split(',')[1];

          // Salvar o PDF no sistema de arquivos temporário
          const fileName = `pendencias_${obra?.nome?.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
          const result = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
          });

          // Compartilhar o arquivo salvo usando a URI
          await Share.share({
            title: `Relatório de Pendências - ${obra?.nome}`,
            text: `Segue o relatório de pendências da obra ${obra?.nome}.`,
            url: result.uri, // Usar a URI do arquivo salvo
            dialogTitle: 'Compartilhar PDF'
          });

          toast({ title: 'Sucesso', description: 'Compartilhamento iniciado.' });

        } catch (pdfError) {
          console.error('Erro ao gerar PDF para compartilhamento:', pdfError);
          toast({
            title: 'Erro',
            description: 'Não foi possível gerar o PDF para compartilhamento: ' + 
              (pdfError instanceof Error ? pdfError.message : 'Erro desconhecido'),
            variant: 'destructive'
          });
        } finally {
          // Limpar elemento temporário
          document.body.removeChild(tempDiv);
        }
      } else {
        // Fallback para web (poderia chamar gerarPDF ou mostrar mensagem)
        toast({
          title: 'Info',
          description: 'Compartilhamento de PDF direto não suportado na web. Use a opção "Gerar PDF".'
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar PDF:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao tentar compartilhar o PDF.',
        variant: 'destructive'
      });
    }
  };

  // Função auxiliar para inicializar um card
  const initializeCard = (card: Partial<TrelloCard>): TrelloCard => ({
    id: card.id!,
    list_id: card.list_id!,
    title: card.title!,
    description: card.description || '',
    position: card.position!,
    due_date: card.due_date,
    labels: card.labels || [],
    checklists: card.checklists || [],
    comments: card.comments || [],
    attachments: card.attachments || [],
    created_at: card.created_at!,
    updated_at: card.updated_at!
  });

  // Unificação do estado de carregamento
  const isLoading = obraLoading || boardLoading;
  const obraNome = obra?.nome || '';

  const isDraggingCardRef = useRef(false); // Ref para controlar se um card está sendo arrastado

  // Efeito para lidar com o botão de voltar do Android
  useEffect(() => {
    const listener = App.addListener('backButton', (event) => {
      if (showCardDetailsDialog) {
        event.canGoBack = false; // Impede o comportamento padrão de voltar
        setShowCardDetailsDialog(false); // Fecha o diálogo
      } else if (showAddCardDialog) {
        event.canGoBack = false;
        setShowAddCardDialog(false);
      } else if (showDeleteCardDialog) {
        event.canGoBack = false;
        setShowDeleteCardDialog(false);
      } else if (showAddListDialog) {
        event.canGoBack = false;
        setShowAddListDialog(false);
      } else if (showEditListDialog) {
        event.canGoBack = false;
        setShowEditListDialog(false);
      } else if (showDeleteListDialog) {
        event.canGoBack = false;
        setShowDeleteListDialog(false);
      }
      // Se nenhum diálogo estiver aberto, o comportamento padrão de voltar ocorrerá
    });

    return () => {
      listener.remove();
    };
  }, [
    showCardDetailsDialog, 
    showAddCardDialog, 
    showDeleteCardDialog, 
    showAddListDialog, 
    showEditListDialog, 
    showDeleteListDialog
  ]);

  // Renderização dos botões com estados de carregamento
  const renderizarBotaoNovaLista = () => (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setShowAddListDialog(true)}
      className="flex items-center gap-2"
      disabled={criarListaMutation.isPending}
    >
      {criarListaMutation.isPending ? (
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-1" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Nova Seção
    </Button>
  );

  // Botão salvar nova lista com estado de carregamento
  const renderizarBotaoSalvarLista = () => (
    <Button 
      onClick={handleSaveNewList}
      disabled={criarListaMutation.isPending}
    >
      {criarListaMutation.isPending ? (
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-1" />
      ) : 'Salvar'}
    </Button>
  );

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
          <h1 className="text-2xl font-bold">Pendências: {obra?.nome || ''}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGerarOuCompartilharPDF}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Gerar PDF
          </Button>
          {renderizarBotaoNovaLista()}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : boardError ? (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg">
          <p className="text-red-600 mb-4">Erro ao carregar quadro: {boardError instanceof Error ? boardError.message : 'Erro desconhecido'}</p>
          <Button onClick={() => refetchBoard()}>Tentar Novamente</Button>
        </div>
      ) : (
        <div ref={boardRef} className="w-full">
          <DragDropContext
            onDragStart={() => {
              isDraggingCardRef.current = true;
              if (navigator.vibrate) navigator.vibrate(50); // Feedback tátil ao iniciar arrasto
            }}
            onDragEnd={(result) => {
              handleDragEnd(result);
              // Pequeno timeout para garantir que o onClick não seja disparado imediatamente após o drop
              setTimeout(() => {
                isDraggingCardRef.current = false;
              }, 150); 
            }}
            enableDefaultSensors={true} // Usar sensores padrão da biblioteca
          >
            {/* Removido o <DndSensors> customizado */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {board?.lists.map((lista) => (
                <Droppable key={lista.id} droppableId={lista.id.toString()}>
                  {(providedDroppable, snapshotDroppable) => (
                    <div
                      ref={providedDroppable.innerRef}
                      {...providedDroppable.droppableProps}
                      className={`bg-muted/30 rounded-lg p-4 min-h-[200px] ${snapshotDroppable.isDraggingOver ? 'bg-muted/50' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        {/* Título da Lista/Seção - Não será editável in-place aqui, mas sim via diálogo */}
                        <h2 className="text-lg font-semibold truncate" title={lista.title || (lista as any).nome}>
                          {lista.title || (lista as any).nome}
                        </h2>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleAddCard(lista)} title="Adicionar Card">
                            <Plus className="h-5 w-5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEditListDialog(lista)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar Seção
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteList(lista)} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Seção
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {lista.cards.map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id.toString()} index={index}>
                            {(providedDraggableItem, snapshotDraggableItem) => (
                              <div // Este é o elemento que será realmente movido pelo Draggable
                                ref={providedDraggableItem.innerRef}
                                {...providedDraggableItem.draggableProps} 
                                // dragHandleProps será aplicado ao ícone específico
                                className={`cursor-default ${snapshotDraggableItem.isDragging ? 'opacity-70 z-50' : ''}`}
                                onClick={() => {
                                  // Só abre detalhes se não estiver arrastando E se o clique não foi para iniciar um arrasto
                                  if (!isDraggingCardRef.current && !snapshotDraggableItem.isDragging) {
                                    handleViewCardDetails(card);
                                  }
                                }}
                              >
                                <Card 
                                  className={`shadow-sm hover:shadow-md transition-all relative
                                    ${snapshotDraggableItem.isDragging ? 'shadow-lg ring-2 ring-primary bg-background/95' : ''}
                                    ${(card as any)._justMoved ? 'animate-pulse shadow-md ring-1 ring-primary/40 bg-primary/5' : ''}`}
                                >
                                  {/* Ícone de arrastar com dragHandleProps */}
                                  <div 
                                    {...providedDraggableItem.dragHandleProps} // Aplicar aqui!
                                    className="absolute top-1 right-1 w-8 h-8 p-1 rounded-full bg-slate-200/50 hover:bg-slate-300/70 flex items-center justify-center cursor-grab opacity-50 hover:opacity-100 z-20"
                                    title="Arrastar card"
                                    onClick={(e) => e.stopPropagation()} // Impede que o clique aqui abra o card
                                    onTouchStart={(e) => e.stopPropagation()} // Importante para priorizar o drag handle no touch
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="9" cy="5.5" r="1" /> <circle cx="9" cy="12" r="1" /> <circle cx="9" cy="18.5" r="1" />
                                      <circle cx="15" cy="5.5" r="1" /> <circle cx="15" cy="12" r="1" /> <circle cx="15" cy="18.5" r="1" />
                                    </svg>
                                  </div>
                                  
                                  {/* Conteúdo do Card */}
                                  <CardContent className="p-3">
                                    {/* Título do card */}
                                    <h3 className="font-medium text-sm mb-1">{card.title}</h3>
                                    
                                    {/* Descrição do card (se existir) */}
                                    {card.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                        {card.description}
                                      </p>
                                    )}
                                    
                                    {/* Footer com metadados */}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 mb-2">
                                      {/* Data de vencimento */}
                                      {card.due_date && (
                                        <div className="flex items-center">
                                          <Clock className="w-3 h-3 mr-1" />
                                          {formatarData(card.due_date)}
                                        </div>
                                      )}
                                      
                                      {/* Contadores */}
                                      <div className="flex items-center gap-2">
                                        {/* Contagem de checklists */}
                                        {card.checklists && card.checklists.length > 0 && (
                                          <div className="flex items-center">
                                            <CheckSquare className="w-3 h-3 mr-1" />
                                            {card.checklists.reduce((total, cl) => total + (cl.items?.filter(item => item.checked)?.length || 0), 0)}/
                                            {card.checklists.reduce((total, cl) => total + (cl.items?.length || 0), 0)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Etiquetas do card (movidas para o final) */}
                                    {card.labels && card.labels.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {card.labels.map((label, labelIndex) => {
                                          let labelTitle = '';
                                          let labelClass = '';
                                          
                                          // Determinar o título da etiqueta
                                          if (typeof label === 'string') {
                                            labelTitle = label;
                                            labelClass = 'bg-gray-500 text-white';
                                            
                                            // Aplicar cores com base no nome
                                            if (label.toLowerCase().includes('urgente')) 
                                              labelClass = 'bg-red-500 text-white';
                                            else if (label.toLowerCase().includes('fazendo')) 
                                              labelClass = 'bg-yellow-500 text-white';
                                            else if (label.toLowerCase().includes('concluído') || label.toLowerCase().includes('concluido')) 
                                              labelClass = 'bg-green-500 text-white';
                                          } else {
                                            labelTitle = label.title || '';
                                            
                                            // Cores específicas para cada tipo de etiqueta
                                            if (label.color) {
                                              // Mapear cores hexadecimais/nomes para classes do Tailwind
                                              if (label.color === 'green' || labelTitle.toLowerCase().includes('concluído') || labelTitle.toLowerCase().includes('concluido'))
                                                labelClass = 'bg-green-500 text-white';
                                              else if (label.color === 'yellow' || labelTitle.toLowerCase().includes('fazendo'))
                                                labelClass = 'bg-yellow-500 text-white';
                                              else if (label.color === 'red' || labelTitle.toLowerCase().includes('urgente'))
                                                labelClass = 'bg-red-500 text-white';
                                              else if (label.color === 'blue')
                                                labelClass = 'bg-blue-500 text-white';
                                              else
                                                labelClass = 'bg-gray-500 text-white';
                                            } else {
                                              labelClass = 'bg-gray-500 text-white';
                                            }
                                          }
                                          
                                          return (
                                            <Badge 
                                              key={labelIndex}
                                              className={`text-xs ${labelClass}`}
                                            >
                                              {labelTitle}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {providedDroppable.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
            {/* Fim do <DndSensors> wrapper (se estivesse usando) */}
          </DragDropContext>
        </div>
      )}

      {/* DIÁLOGOS */}
      {/* Dialog para adicionar seção (Nova Lista) */}
      <Dialog open={showAddListDialog} onOpenChange={setShowAddListDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Nova Seção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-list-name">Nome da Seção</Label>
              <Input
                id="new-list-name"
                value={valorInputNomeLista} // Usar valorInputNomeLista
                onChange={(e) => setValorInputNomeLista(e.target.value)} // Corrigido para novoListaNome
                onBlur={(e) => setValorInputNomeLista(capitalizarPrimeiraLetra(e.target.value))} // Corrigido para novoListaNome
                placeholder="Nome da seção"
                spellCheck="true" autoCorrect="on" autoCapitalize="sentences" lang="pt-BR"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            {renderizarBotaoSalvarLista()} 
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar seção (Lista Existente) */}
      <Dialog open={showEditListDialog} onOpenChange={(open) => { 
        if(!open) { 
          setListaAtual(null); 
          setValorInputNomeLista('');
        }
        setShowEditListDialog(open);
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Seção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">Nome da Seção</Label>
              <Input
                id="edit-list-name"
                value={valorInputNomeLista} // Usar valorInputNomeLista
                onChange={(e) => setValorInputNomeLista(e.target.value)}
                onBlur={(e) => setValorInputNomeLista(capitalizarPrimeiraLetra(e.target.value))}
                placeholder="Nome da seção"
                spellCheck="true" autoCorrect="on" autoCapitalize="sentences" lang="pt-BR"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEditList}>Cancelar</Button>
            <Button onClick={handleSaveEditListDialog} disabled={renomearListaMutation.isPending}>
              {renomearListaMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar exclusão de seção */}
      <Dialog open={showDeleteListDialog} onOpenChange={setShowDeleteListDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Seção</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Tem certeza que deseja excluir a seção "{listaAtual?.title}"?</p>
            <p className="text-sm text-muted-foreground mt-2">Todos os cards desta seção também serão excluídos.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteListDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteList} disabled={excluirListaMutation.isPending}>
              {excluirListaMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para adicionar card */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Card</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Título</Label>
              <Input
                id="card-title"
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
              <Label htmlFor="card-description">Descrição</Label>
              <Textarea
                id="card-description"
                value={novoCard.description}
                onChange={(e) => setNovoCard({...novoCard, description: e.target.value})}
                onBlur={(e) => setNovoCard({...novoCard, description: capitalizarPrimeiraLetra(e.target.value)})}
                placeholder="Descrição (opcional)"
                spellCheck="true" 
                autoCorrect="on" 
                autoCapitalize="sentences"
                lang="pt-BR"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-2">
                {
                  // Filtrar etiquetas duplicadas usando IDs únicos
                  etiquetasDisponiveis
                    .filter((etiqueta, index, self) => 
                      index === self.findIndex(e => e.id === etiqueta.id)
                    )
                    .map((etiqueta) => {
                      const isSelected = novoCard.labels.includes(etiqueta.title);
                      return (
                        <Badge 
                          key={etiqueta.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer"
                          style={{
                            backgroundColor: isSelected ? etiqueta.color : 'transparent',
                            color: isSelected ? 'white' : etiqueta.color,
                            borderColor: etiqueta.color
                          }}
                          onClick={() => handleToggleLabel(etiqueta.title)}
                        >
                          {etiqueta.title}
                        </Badge>
                      );
                    })
                }
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCardDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveNewCard} disabled={criarCardMutation.isPending}>
              {criarCardMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para confirmar exclusão de card */}
      <Dialog open={showDeleteCardDialog} onOpenChange={setShowDeleteCardDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Card</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Tem certeza que deseja excluir o card "{cardAtual?.title}"?</p>
            <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteCardDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteCard} disabled={excluirCardMutation.isPending}>
              {excluirCardMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para detalhes do card - Aqui aplicamos a edição in-place do título */}
      <Dialog open={showCardDetailsDialog} onOpenChange={setShowCardDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3 mb-3 flex items-center justify-between">
            <div className="flex items-center">
              {editandoTituloCardId === cardAtual?.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={novoTituloCard}
                    onChange={(e) => setNovoTituloCard(e.target.value)}
                    className="h-8 font-medium"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" onClick={handleSalvarTituloCardNoDialogo} className="h-6 w-6">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCancelEditTituloCardNoDialogo} className="h-6 w-6">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <DialogTitle>
                    {cardAtual?.title}
                  </DialogTitle>
                  <Button variant="ghost" size="icon" onClick={handleEditarTituloCardNoDialogo} className="h-6 w-6">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Data de vencimento */}
            {cardAtual?.due_date && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Data de Vencimento</h3>
                <p className="text-sm">{formatarData(cardAtual.due_date)}</p>
              </div>
            )}
            
            {/* Descrição */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Descrição</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleEditarDescricaoCardNoDialogo} 
                  className="h-6 w-6"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              {editandoDescricaoCardId === cardAtual?.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={novaDescricaoCard}
                    onChange={(e) => setNovaDescricaoCard(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="Adicione uma descrição..."
                    spellCheck="true"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    lang="pt-BR"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEditDescricaoCardNoDialogo}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSalvarDescricaoCardNoDialogo}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 rounded-md p-3">
                  {cardAtual?.description ? (
                    <p className="text-sm whitespace-pre-wrap">{cardAtual.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma descrição</p>
                  )}
                </div>
              )}
            </div>
            
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

    </div> // Fechamento do container principal
  );
};

export default PendenciasObra;