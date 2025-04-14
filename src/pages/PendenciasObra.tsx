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
import { DragDropContext, Droppable, Draggable, DropResult, DragStart, ResponderProvided } from 'react-beautiful-dnd';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
// Importações do Capacitor
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { supabase } from '@/lib/supabase';
import { pdfStyles } from '../styles/pdf-styles';

const PendenciasObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [obraNome, setObraNome] = useState<string>('');
  const [obra, setObra] = useState<any>(null);
  
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

  const [error, setError] = useState<string | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos

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
      const { data: obra, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!obra) {
        toast.warning('Obra não encontrada');
        return;
      }
      
      setObra(obra);
      setObraNome(obra.nome);
      
      // Carregar o quadro antes de finalizar o carregamento
      await carregarQuadro(obra.id);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados da obra');
    } finally {
      setLoading(false);
    }
  };

  const carregarQuadro = async (id: number, forceReload = false) => {
    if (!id) {
      setLoading(false);
      return;
    }

    // Verificar se podemos usar o cache
    const now = Date.now();
    if (!forceReload && board && lastLoadTime && (now - lastLoadTime) < CACHE_DURATION) {
      console.log('Usando cache do quadro');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Carregando quadro da obra:', id);
      
      const quadro = await obterQuadroObra(id, (message, progress) => {
        console.log(`Progresso: ${message} (${progress}%)`);
      });

      if (!quadro || !quadro.lists) {
        throw new Error('Não foi possível carregar o quadro da obra');
      }

      setBoard(quadro);
      setLastLoadTime(now);
      console.log('Quadro carregado com sucesso:', quadro);
    } catch (error) {
      console.error('Erro ao carregar quadro:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar o quadro da obra');
      toast.error('Erro ao carregar o quadro da obra');
    } finally {
      setLoading(false);
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
      await carregarQuadro(Number(id));
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
      await carregarQuadro(Number(id));
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
      await carregarQuadro(Number(id));
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
      await carregarQuadro(Number(id));
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
    setCardAtual(card as any);
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
      await carregarQuadro(Number(id));
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
      await carregarQuadro(Number(id));
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
      
      await criarChecklist(cardAtual.id, novoChecklistNome);
      
      toast({
        title: "Sucesso",
        description: "Checklist criada com sucesso!",
      });
      
      setNovoChecklistNome('');
      await carregarQuadro(Number(id));
      
      // Recarregar o card atual para mostrar a nova checklist
      const quadro = await obterQuadroObra(Number(id));
      const lista = quadro.lists.find(l => l.id === cardAtual.list_id);
      if (lista) {
        const card = lista.cards.find(c => c.id === cardAtual.id);
        if (card) {
          setCardAtual({
            ...(card as any),
            checklists: (card as any).checklists || [],
            comments: (card as any).comments || [],
            attachments: (card as any).attachments || [],
            labels: card.labels || []
          });
          setNovoCard({
            ...novoCard,
            labels: card.labels.map(l => l.title)
          });
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
      await carregarQuadro(Number(id));
      
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
          setCardAtual({
            ...(card as any),
            checklists: (card as any).checklists || [],
            comments: (card as any).comments || [],
            attachments: (card as any).attachments || [],
            labels: card.labels || []
          });
          
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
          setCardAtual({
            ...(card as any),
            checklists: (card as any).checklists || [],
            comments: (card as any).comments || [],
            attachments: (card as any).attachments || [],
            labels: card.labels || []
          });
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
          setCardAtual({
            ...(card as any),
            checklists: (card as any).checklists || [],
            comments: (card as any).comments || [],
            attachments: (card as any).attachments || [],
            labels: card.labels || []
          });
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
      await carregarQuadro(Number(id));
      
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
          setNovoCard({
            ...novoCard,
            labels: cardAtualizado.labels.map(l => l.title)
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
      await carregarQuadro(Number(id));
    }
  };

  // Função para gerar o PDF usando window.print
  const gerarPDF = async () => {
    try {
      if (!board) {
        toast.error('Nenhum dado disponível para gerar o PDF');
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
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Relatório de Pendências</h1>
              <p class="obra-info">Obra: ${obraNome}</p>
              <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
 
            ${board.lists.map(list => `
              <div class="section">
                <h2 class="section-title">${list.title}</h2>
                ${list.cards.map(card => `
                  <div class="card">
                    <h3 class="card-title">${card.title}</h3>
                    
                    ${card.description ? `
                      <p class="card-description">${card.description}</p>
                    ` : ''}
                    
                    ${card.labels?.length ? `
                      <div class="labels-container">
                        ${card.labels.map(label => `
                          <span class="label label-${label.color || 'default'}">${label.title}</span>
                        `).join('')}
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
                `).join('')}
              </div>
            `).join('')}
          </body>
        </html>
      `;

      // Criar elemento temporário para renderizar o HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      document.body.appendChild(tempDiv);

      try {
        // Configurar opções do html2canvas
        const options = {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: tempDiv.scrollWidth,
          height: tempDiv.scrollHeight
        };

        // Gerar imagem do conteúdo
        const canvas = await html2canvas(tempDiv, options);
        
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
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
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
        pdf.save(`pendencias_${obraNome.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);

        toast.success('PDF gerado com sucesso!');
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        toast.error('Erro ao gerar o PDF');
      } finally {
        // Limpar elemento temporário
        document.body.removeChild(tempDiv);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF');
    }
  };

  // Função para lidar com o clique no botão de gerar PDF
  const handleGerarPDF = async () => {
    console.log('[DEBUG] Botão Gerar PDF clicado');
    await gerarPDF();
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
                  margin-bottom: 15px;
                  page-break-inside: avoid;
                }
                
                .checklist-item {
                  margin: 5px 0;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                
                .labels-container {
                  margin: 8px 0;
                }
                
                .label {
                  display: inline-block;
                  margin-right: 8px;
                  margin-bottom: 4px;
                }
              </style>
            </head>
            <body>
              <div class="report-header">
                <h1>Relatório de Pendências</h1>
                <p class="obra-nome">${obraNome}</p>
                <p class="data">Data: ${format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
              
              ${board.lists.map(list => `
                <div class="section">
                  <h2 class="section-title">${list.title}</h2>
                  ${list.cards.map(card => `
                    <div class="card">
                      <h3 class="card-title">${card.title}</h3>
                      
                      ${card.description ? `
                        <p class="card-description">${card.description}</p>
                      ` : ''}
                      
                      ${card.labels?.length ? `
                        <div class="labels-container">
                          ${card.labels.map(label => `
                            <span class="label label-${label.color || 'default'}">${label.title}</span>
                          `).join('')}
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
                  `).join('')}
                </div>
              `).join('')}
            </body>
          </html>
        `;

        // Criar elemento temporário para renderizar o HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        document.body.appendChild(tempDiv);

        // Gerar PDF usando jsPDF e html2canvas
        try {
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });

          // Configurar fonte e tamanho
          pdf.setFont('helvetica');
          pdf.setFontSize(12);

          // Adicionar cabeçalho
          pdf.setFontSize(16);
          pdf.text(`Relatório de Pendências - ${obraNome}`, 20, 20);
          pdf.setFontSize(12);
          pdf.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 30);

          // Capturar o conteúdo do HTML gerado
          const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          const pageHeight = pdf.internal.pageSize.getHeight();

          let position = 40; // Começar após o cabeçalho

          // Adicionar o conteúdo em múltiplas páginas se necessário
          while (position < pdfHeight) {
            pdf.addImage(imgData, 'JPEG', 0, -position + 40, pdfWidth, pdfHeight);
            position += pageHeight - 40;
            if (position < pdfHeight) {
              pdf.addPage();
            }
          }

          // Restaurar configuração original
          boardRef.current.style.backgroundColor = originalBgColor;

          // Converter para blob e compartilhar
          const blob = pdf.output('blob');
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });

          const fileName = `pendencias_${obraNome.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;

          // Salvar o arquivo no sistema de arquivos do dispositivo
          const filePath = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });

          // Compartilhar o arquivo
          await Share.share({
            title: `Pendências - ${obraNome}`,
            text: `Relatório de pendências da obra ${obraNome}`,
            url: filePath.uri,
            dialogTitle: 'Compartilhar PDF'
          });

          // Limpar o arquivo temporário
          await Filesystem.deleteFile({
            path: fileName,
            directory: Directory.Cache
          });

          toast({
            title: 'Sucesso',
            description: 'Relatório compartilhado com sucesso!'
          });
        } catch (pdfError) {
          console.error('Erro ao gerar PDF para compartilhamento:', pdfError);
          toast({
            title: 'Erro',
            description: 'Não foi possível gerar o PDF para compartilhamento.',
            variant: 'destructive'
          });
        }
      } else {
        // Em ambiente web, usar a mesma impressão
        gerarPDF();
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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={gerarPDF}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Gerar PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAddListDialog(true)}
            className="flex items-center gap-2"
          >
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