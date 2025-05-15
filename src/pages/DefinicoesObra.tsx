import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Edit, Trash2, FileUp, Tag, CheckSquare, MessageSquare, Paperclip, MoreHorizontal, Check, X, FileText, Download, ExternalLink, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { buscarObra, atualizarObra } from '@/lib/api';
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
import { supabase } from '@/lib/supabase';
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
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { FilePondFile } from 'filepond';
import { FilePond, registerPlugin } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

// Importações do Capacitor
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Registrar plugins do FilePond
registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);

// Interfaces para Definições
interface DefinicaoCard {
  id: string;
  title: string;
  description?: string;
  attachments?: string[];
  checklists?: {
    id: string;
    title: string;
    items: {
      id: string;
      text?: string;
      title?: string;
      checked: boolean;
    }[];
  }[];
  labels?: (string | { title?: string; color?: string })[];
}

interface DefinicaoLista {
  id: string;
  title: string;
  cards: DefinicaoCard[];
}

interface DefinicaoQuadro {
  id: string;
  nome?: string;
  title?: string;
  lists: DefinicaoLista[];
}

interface Obra {
  id: number;
  nome: string;
  endereco: string;
  data_inicio: string;
  data_fim_prevista: string;
  status: string;
  progresso: number;
  custo_previsto: number;
  custo_real: number;
  responsavel?: string;
  definicoes_board_id?: string;
}

const DefinicoesObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<DefinicaoQuadro | null>(null);
  const [obraNome, setObraNome] = useState('');
  
  // Estados para diálogos
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showDeleteCardDialog, setShowDeleteCardDialog] = useState(false);
  const [showCardDetailsDialog, setShowCardDetailsDialog] = useState(false);
  const [showAddAttachmentDialog, setShowAddAttachmentDialog] = useState(false);
  
  // Estados para cards e listas
  const [cardAtual, setCardAtual] = useState<DefinicaoCard | null>(null);
  const [listaAtual, setListaAtual] = useState<DefinicaoLista | null>(null);
  
  // Estado para novo card
  const [novoCard, setNovoCard] = useState({
    title: '',
    description: '',
    attachments: [] as string[]
  });
  
  // Estados para checklists
  const [novoChecklistNome, setNovoChecklistNome] = useState('');
  const [novoChecklistItem, setNovoChecklistItem] = useState('');
  const [checklistAtual, setChecklistAtual] = useState<DefinicaoCard['checklists'][0] | null>(null);

  // Estado para upload de arquivos
  const [files, setFiles] = useState<FilePondFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  
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

  // Função para editar o título do card diretamente na visualização
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');

  // Novo estado para editar a descrição do card
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');

  useEffect(() => {
    carregarDados();
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
      await carregarQuadro(obra);
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

  const carregarQuadro = async (obra: Obra) => {
    try {
      console.log('Carregando quadro de definições:', obra.id);
      
      // Verificar se já existe um quadro de definições
      if (obra.definicoes_board_id) {
        try {
          // Tentar obter o quadro existente
          const { data, error } = await supabase
            .from('definicoes_quadros')
            .select('*')
            .eq('id', obra.definicoes_board_id)
            .single();
          
          if (error) throw error;
          
          if (data) {
            setBoard(data as unknown as DefinicaoQuadro);
            console.log('Quadro de definições existente:', data);
            return;
          }
        } catch (error) {
          console.error('Erro ao buscar quadro de definições:', error);
        }
      }
      
      // Se não existir, criar um novo quadro de definições
      const quadroDefinicoes: DefinicaoQuadro = {
        id: `def_${obra.id}_${Date.now()}`,
        title: `Definições - ${obra.nome}`,
        lists: [
          {
            id: `def_list_definir_${Date.now()}`,
            title: "Definir",
            cards: []
          },
          {
            id: `def_list_definido_${Date.now()}`,
            title: "Definido",
            cards: []
          }
        ]
      };
      
      // Salvar o novo quadro no banco de dados
      const { data, error } = await supabase
        .from('definicoes_quadros')
        .insert({
          ...quadroDefinicoes,
          obra_id: obra.id
        })
        .select();
      
      if (error) throw error;
      
      // Atualizar o ID do quadro na obra
      if (data && data.length > 0) {
        await atualizarObra(obra.id, { definicoes_board_id: quadroDefinicoes.id });
      }
      
      console.log('Novo quadro de definições criado:', quadroDefinicoes);
      setBoard(quadroDefinicoes);
    } catch (error) {
      console.error('Erro detalhado ao carregar/criar quadro:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível carregar o quadro de definições.",
        variant: "destructive"
      });
    }
  };

  // Funções para operações com cards
  const handleAddCard = async () => {
    try {
      if (!listaAtual || !novoCard.title) return;

      const newCardId = `def_card_${Date.now()}`;
      const newCard: DefinicaoCard = {
        id: newCardId,
        title: capitalizarPrimeiraLetra(novoCard.title.trim()),
        description: novoCard.description ? capitalizarPrimeiraLetra(novoCard.description.trim()) : '',
        attachments: uploadedFiles,
        checklists: []
      };

      // Adicionar card ao board
      const updatedBoard = { ...board };
      const listaIndex = updatedBoard?.lists.findIndex(lista => lista.id === listaAtual.id);
      
      if (listaIndex !== undefined && listaIndex >= 0 && updatedBoard?.lists) {
        updatedBoard.lists[listaIndex].cards.push(newCard);
        
        // Atualizar o quadro no banco de dados
        const { error } = await supabase
          .from('definicoes_quadros')
          .update(updatedBoard)
          .eq('id', updatedBoard.id);
        
        if (error) throw error;
        
        setBoard(updatedBoard);
        setNovoCard({ title: '', description: '', attachments: [] });
        setUploadedFiles([]);
        setFiles([]);
        setShowAddCardDialog(false);
        
        toast({
          title: "Sucesso",
          description: "Definição adicionada com sucesso!",
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a definição. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCard = async () => {
    try {
      if (!cardAtual || !listaAtual || !board) return;
      
      const updatedBoard = { ...board };
      const listaIndex = updatedBoard.lists.findIndex(lista => lista.id === listaAtual.id);
      
      if (listaIndex !== -1) {
        const cardIndex = updatedBoard.lists[listaIndex].cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1) {
          // Remover o card da lista
          updatedBoard.lists[listaIndex].cards.splice(cardIndex, 1);
          
          // Atualizar o quadro no banco de dados
          const { error } = await supabase
            .from('definicoes_quadros')
            .update(updatedBoard)
            .eq('id', updatedBoard.id);
          
          if (error) throw error;
          
          setBoard(updatedBoard);
          setShowDeleteCardDialog(false);
          setCardAtual(null);
          
          toast({
            title: "Sucesso",
            description: "Definição removida com sucesso!",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao excluir card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a definição. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para mover um card entre listas
  const handleMoveCard = async (result: DropResult) => {
    try {
      if (!result.destination || !board) return;
      
      const { source, destination } = result;
      
      // Se não houve mudança na posição, não faz nada
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }
      
      console.log('Movendo card:', { source, destination });
      
      // Obter as listas de origem e destino
      const sourceListIndex = board.lists.findIndex(lista => lista.id === source.droppableId);
      const destListIndex = board.lists.findIndex(lista => lista.id === destination.droppableId);
      
      if (sourceListIndex === -1 || destListIndex === -1) return;
      
      // Criar uma cópia do board para manipular
      const updatedBoard = { ...board };
      
      // Remover o card da lista de origem
      const [movedCard] = updatedBoard.lists[sourceListIndex].cards.splice(source.index, 1);
      
      // Registrar a movimentação no título se for entre listas diferentes
      if (source.droppableId !== destination.droppableId) {
        // Registrar de qual lista para qual lista foi movido
        const sourceListName = updatedBoard.lists[sourceListIndex].title;
        const destListName = updatedBoard.lists[destListIndex].title;
        
        toast({
          title: "Card movido",
          description: `"${movedCard.title}" foi movido de "${sourceListName}" para "${destListName}"`,
        });
      }
      
      // Adicionar o card na lista de destino
      updatedBoard.lists[destListIndex].cards.splice(destination.index, 0, movedCard);
      
      // Atualizar o board no state imediatamente para feedback visual rápido
      setBoard(updatedBoard);
      
      // Atualizar o quadro no banco de dados
      const { error } = await supabase
        .from('definicoes_quadros')
        .update(updatedBoard)
        .eq('id', updatedBoard.id);
      
      if (error) {
        // Se houver erro, reverter a alteração no state
        console.error('Erro ao mover card:', error);
        setBoard(board); // Reverte para o estado anterior
        
        toast({
          title: "Erro",
          description: "Não foi possível mover a definição. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a definição. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para mover um card para outra lista diretamente pelo botão
  const handleMoveCardToList = async (cardId: string, sourceListId: string, destListId: string) => {
    try {
      if (!board) return;
      
      // Obter as listas de origem e destino
      const sourceListIndex = board.lists.findIndex(lista => lista.id === sourceListId);
      const destListIndex = board.lists.findIndex(lista => lista.id === destListId);
      
      if (sourceListIndex === -1 || destListIndex === -1) return;
      
      // Criar uma cópia do board para manipular
      const updatedBoard = { ...board };
      
      // Encontrar o card na lista de origem
      const cardIndex = updatedBoard.lists[sourceListIndex].cards.findIndex(card => card.id === cardId);
      
      if (cardIndex === -1) return;
      
      // Remover o card da lista de origem
      const [movedCard] = updatedBoard.lists[sourceListIndex].cards.splice(cardIndex, 1);
      
      // Adicionar o card no início da lista de destino
      updatedBoard.lists[destListIndex].cards.unshift(movedCard);
      
      // Registrar movimentação
      const sourceListName = updatedBoard.lists[sourceListIndex].title;
      const destListName = updatedBoard.lists[destListIndex].title;
      
      // Atualizar o board no state imediatamente para feedback visual rápido
      setBoard(updatedBoard);
      
      // Atualizar o quadro no banco de dados
      const { error } = await supabase
        .from('definicoes_quadros')
        .update(updatedBoard)
        .eq('id', updatedBoard.id);
      
      if (error) {
        // Se houver erro, reverter a alteração no state
        console.error('Erro ao mover card:', error);
        setBoard(board); // Reverte para o estado anterior
        
        toast({
          title: "Erro",
          description: "Não foi possível mover a definição. Tente novamente.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Card movido",
        description: `"${movedCard.title}" foi movido de "${sourceListName}" para "${destListName}"`,
      });
      
      // Fechar o diálogo se estiver aberto
      setShowCardDetailsDialog(false);
      
    } catch (error) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a definição. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Funções para manipulação de checklists
  const handleAddChecklist = async () => {
    try {
      if (!cardAtual || !novoChecklistNome || !board) return;
      
      const newChecklistId = `def_checklist_${Date.now()}`;
      const newChecklist = {
        id: newChecklistId,
        title: capitalizarPrimeiraLetra(novoChecklistNome.trim()),
        items: []
      };
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e adicionar o checklist
      for (const lista of updatedBoard.lists) {
        const cardIndex = lista.cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1) {
          if (!lista.cards[cardIndex].checklists) {
            lista.cards[cardIndex].checklists = [];
          }
          
          lista.cards[cardIndex].checklists.push(newChecklist);
          
          // Atualizar o quadro no banco de dados
          const { error } = await supabase
            .from('definicoes_quadros')
            .update(updatedBoard)
            .eq('id', updatedBoard.id);
          
          if (error) throw error;
          
          setBoard(updatedBoard);
          setNovoChecklistNome('');
          
          // Atualizar o card atual para refletir as mudanças
          setCardAtual(lista.cards[cardIndex]);
          
          toast({
            title: "Sucesso",
            description: "Checklist adicionado com sucesso!",
          });
          
          break;
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar checklist:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o checklist. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleAddChecklistItem = async () => {
    try {
      if (!cardAtual || !checklistAtual || !novoChecklistItem || !board) return;
      
      const newItemId = `checklist_item_${Date.now()}`;
      const newItem = {
        id: newItemId,
        text: capitalizarPrimeiraLetra(novoChecklistItem.trim()),
        checked: false
      };
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e o checklist
      updateLoop: for (const lista of updatedBoard.lists) {
        const cardIndex = lista.cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1 && lista.cards[cardIndex].checklists) {
          const checklistIndex = lista.cards[cardIndex].checklists.findIndex(cl => cl.id === checklistAtual.id);
          
          if (checklistIndex !== -1) {
            lista.cards[cardIndex].checklists[checklistIndex].items.push(newItem);
            
            // Atualizar o quadro no banco de dados
            const { error } = await supabase
              .from('definicoes_quadros')
              .update(updatedBoard)
              .eq('id', updatedBoard.id);
            
            if (error) throw error;
            
            setBoard(updatedBoard);
            setNovoChecklistItem('');
            
            // Atualizar o card atual e o checklist atual
            setCardAtual(lista.cards[cardIndex]);
            setChecklistAtual(lista.cards[cardIndex].checklists[checklistIndex]);
            
            toast({
              title: "Sucesso",
              description: "Item adicionado ao checklist!",
            });
            
            break updateLoop;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar item ao checklist:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o item. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string, checked: boolean) => {
    try {
      if (!cardAtual || !board) return;
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e o checklist
      updateLoop: for (const lista of updatedBoard.lists) {
        const cardIndex = lista.cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1 && lista.cards[cardIndex].checklists) {
          const checklistIndex = lista.cards[cardIndex].checklists.findIndex(cl => cl.id === checklistId);
          
          if (checklistIndex !== -1) {
            const itemIndex = lista.cards[cardIndex].checklists[checklistIndex].items.findIndex(item => item.id === itemId);
            
            if (itemIndex !== -1) {
              lista.cards[cardIndex].checklists[checklistIndex].items[itemIndex].checked = checked;
              
              // Atualizar o quadro no banco de dados
              const { error } = await supabase
                .from('definicoes_quadros')
                .update(updatedBoard)
                .eq('id', updatedBoard.id);
              
              if (error) throw error;
              
              setBoard(updatedBoard);
              
              // Atualizar o card atual
              setCardAtual(lista.cards[cardIndex]);
              
              break updateLoop;
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar checklist item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o item do checklist. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para upload de arquivos
  const handleFileUpload = async (file: File): Promise<string> => {
    try {
      console.log('Iniciando upload do arquivo:', file.name);
      
      // Nome do bucket e nome do arquivo
      const bucketName = 'arquivos';
      const fileName = `definicoes/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      console.log('Nome do arquivo para upload:', fileName);
      
      // Fazer upload do arquivo para o bucket
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Usar upsert para sobrescrever se o arquivo existir
        });
      
      if (error) {
        console.error('Erro detalhado ao fazer upload:', error);
        throw error;
      }
      
      console.log('Upload concluído com sucesso:', data);
      
      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      console.log('URL pública gerada:', urlData.publicUrl);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha ao fazer upload do arquivo.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Função para manipulação dos arquivos no FilePond
  const handleProcessFile = async (
    error: any,
    file: FilePondFile
  ) => {
    if (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro no processamento",
        description: "Falha ao processar o arquivo. Verifique o formato e tamanho.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Processando arquivo:', file);
      
      // Verificar se o arquivo é válido
      if (!file || !file.file) {
        throw new Error('Arquivo inválido');
      }
      
      const fileObj = file.file as File;
      console.log('Arquivo para upload:', fileObj.name, 'Tamanho:', fileObj.size, 'Tipo:', fileObj.type);
      
      // Verificar tamanho do arquivo (limite de 10MB)
      if (fileObj.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é de 10MB",
          variant: "destructive"
        });
        return;
      }
      
      const fileUrl = await handleFileUpload(fileObj);
      console.log('URL do arquivo após upload:', fileUrl);
      
      setUploadedFiles(prev => [...prev, fileUrl]);
      
      toast({
        title: "Upload concluído",
        description: "Arquivo carregado com sucesso",
      });
    } catch (error) {
      console.error('Erro detalhado ao fazer upload:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload do arquivo. Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFile = (file: FilePondFile) => {
    const fileIndex = files.findIndex(f => f.id === file.id);
    if (fileIndex >= 0 && fileIndex < uploadedFiles.length) {
      const newUploadedFiles = [...uploadedFiles];
      newUploadedFiles.splice(fileIndex, 1);
      setUploadedFiles(newUploadedFiles);
    }
  };

  const handleVoltar = () => {
    navigate(`/obras/${id}`);
  };

  // Função para excluir checklist
  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      if (!cardAtual || !board) return;
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e remover o checklist
      updateLoop: for (const lista of updatedBoard.lists) {
        const cardIndex = lista.cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1 && lista.cards[cardIndex].checklists) {
          const checklistIndex = lista.cards[cardIndex].checklists.findIndex(cl => cl.id === checklistId);
          
          if (checklistIndex !== -1) {
            // Remover o checklist
            lista.cards[cardIndex].checklists.splice(checklistIndex, 1);
            
            // Atualizar o quadro no banco de dados
            const { error } = await supabase
              .from('definicoes_quadros')
              .update(updatedBoard)
              .eq('id', updatedBoard.id);
            
            if (error) throw error;
            
            setBoard(updatedBoard);
            
            // Atualizar o card atual
            setCardAtual(lista.cards[cardIndex]);
            
            toast({
              title: "Sucesso",
              description: "Checklist removido com sucesso!",
            });
            
            break updateLoop;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao excluir checklist:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o checklist. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para excluir item de checklist
  const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
    try {
      if (!cardAtual || !board) return;
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e o checklist
      updateLoop: for (const lista of updatedBoard.lists) {
        const cardIndex = lista.cards.findIndex(card => card.id === cardAtual.id);
        
        if (cardIndex !== -1 && lista.cards[cardIndex].checklists) {
          const checklistIndex = lista.cards[cardIndex].checklists.findIndex(cl => cl.id === checklistId);
          
          if (checklistIndex !== -1) {
            const itemIndex = lista.cards[cardIndex].checklists[checklistIndex].items.findIndex(item => item.id === itemId);
            
            if (itemIndex !== -1) {
              // Remover o item
              lista.cards[cardIndex].checklists[checklistIndex].items.splice(itemIndex, 1);
              
              // Atualizar o quadro no banco de dados
              const { error } = await supabase
                .from('definicoes_quadros')
                .update(updatedBoard)
                .eq('id', updatedBoard.id);
              
              if (error) throw error;
              
              setBoard(updatedBoard);
              
              // Atualizar o card atual
              setCardAtual(lista.cards[cardIndex]);
              
              break updateLoop;
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao excluir item do checklist:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o item. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para atualizar o título do card
  const handleUpdateTitle = async () => {
    if (!novoTitulo || !board || !listaAtual || !cardAtual) return;
    
    try {
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e atualizar o título
      const listaIndex = updatedBoard.lists.findIndex(lista => lista.id === listaAtual.id);
      if (listaIndex !== -1) {
        const cardIndex = updatedBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual.id);
        if (cardIndex !== -1) {
          updatedBoard.lists[listaIndex].cards[cardIndex].title = capitalizarPrimeiraLetra(novoTitulo.trim());
          
          // Atualizar o quadro no banco de dados
          const { error } = await supabase
            .from('definicoes_quadros')
            .update(updatedBoard)
            .eq('id', updatedBoard.id);
          
          if (error) throw error;
          
          setBoard(updatedBoard);
          
          // Atualizar o card atual
          const updatedCard = { ...cardAtual, title: capitalizarPrimeiraLetra(novoTitulo.trim()) };
          setCardAtual(updatedCard);
          
          toast({
            title: "Sucesso",
            description: "Título atualizado com sucesso!",
          });
        }
      }
      
      setEditandoTitulo(false);
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o título. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para adicionar novos anexos a um card existente
  const handleAddAttachmentsToCard = async () => {
    try {
      if (!cardAtual || !listaAtual || !board || uploadedFiles.length === 0) return;
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card e adicionar os anexos
      const listaIndex = updatedBoard.lists.findIndex(lista => lista.id === listaAtual.id);
      if (listaIndex !== -1) {
        const cardIndex = updatedBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual.id);
        if (cardIndex !== -1) {
          // Garantir que attachments existe
          if (!updatedBoard.lists[listaIndex].cards[cardIndex].attachments) {
            updatedBoard.lists[listaIndex].cards[cardIndex].attachments = [];
          }
          
          // Adicionar novos anexos
          updatedBoard.lists[listaIndex].cards[cardIndex].attachments = [
            ...updatedBoard.lists[listaIndex].cards[cardIndex].attachments || [],
            ...uploadedFiles
          ];
          
          // Atualizar o quadro no banco de dados
          const { error } = await supabase
            .from('definicoes_quadros')
            .update(updatedBoard)
            .eq('id', updatedBoard.id);
          
          if (error) throw error;
          
          // Atualizar o board e o card atual
          setBoard(updatedBoard);
          setCardAtual(updatedBoard.lists[listaIndex].cards[cardIndex]);
          
          // Limpar estados de upload
          setFiles([]);
          setUploadedFiles([]);
          setShowAddAttachmentDialog(false);
          
          toast({
            title: "Sucesso",
            description: "Anexos adicionados com sucesso!",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar anexos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os anexos. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para excluir um anexo de um card
  const handleDeleteAttachment = async (attachmentIndex: number) => {
    try {
      if (!cardAtual || !listaAtual || !board || !cardAtual.attachments) return;
      
      // Verificar se o índice é válido
      if (attachmentIndex < 0 || attachmentIndex >= cardAtual.attachments.length) return;
      
      // Criar cópia do board para atualização
      const updatedBoard = { ...board };
      
      // Encontrar o card para atualizar
      const listaIndex = updatedBoard.lists.findIndex(lista => lista.id === listaAtual.id);
      if (listaIndex !== -1) {
        const cardIndex = updatedBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual.id);
        if (cardIndex !== -1 && updatedBoard.lists[listaIndex].cards[cardIndex].attachments) {
          // Remover o anexo pelo índice
          updatedBoard.lists[listaIndex].cards[cardIndex].attachments.splice(attachmentIndex, 1);
          
          // Atualizar o quadro no banco de dados
          const { error } = await supabase
            .from('definicoes_quadros')
            .update(updatedBoard)
            .eq('id', updatedBoard.id);
          
          if (error) throw error;
          
          // Atualizar o board e o card atual
          setBoard(updatedBoard);
          setCardAtual(updatedBoard.lists[listaIndex].cards[cardIndex]);
          
          toast({
            title: "Sucesso",
            description: "Anexo removido com sucesso!",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o anexo. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para abrir arquivo (Web: nova aba, Nativo: navegador padrão)
  const handleOpenFile = async (url: string) => {
    if (!url) {
      toast({ title: "Erro", description: "URL do arquivo inválida.", variant: "destructive" });
      return;
    }
    try {
      // presentationStyle: 'popover' é mais relevante para iOS e InAppBrowser.
      // Para web, geralmente abre nova aba. Para Android, pode abrir no app do Browser.
      await Browser.open({ url: url }); 
    } catch (error) {
      console.error("Erro ao abrir arquivo:", error);
      toast({
        title: "Erro ao Abrir",
        description: "Não foi possível abrir o link. Verifique se há um navegador ou app compatível.",
        variant: "destructive"
      });
    }
  };

  // Função para baixar arquivo (Nativo: pasta Downloads/ExternalStorage, Web: download do navegador)
  const handleDownloadFile = async (attachmentUrl: string, inputFileName: string) => {
    if (!attachmentUrl) {
      toast({ title: "Erro", description: "URL do arquivo inválida para download.", variant: "destructive" });
      return;
    }
    // Sanitização do nome do arquivo para remover caracteres inválidos ou excesso de underscores
    const fileName = inputFileName.replace(/[^a-zA-Z0-9._~-]+/g, '_').replace(/_{2,}/g, '_');
    
    toast({ title: "Download", description: `Iniciando download de ${fileName}...`, duration: 2000 });

    if (Capacitor.isNativePlatform()) {
      // Lógica de download para plataformas nativas (Android/iOS)
      try {
        if (Capacitor.getPlatform() === 'android') {
          let permStatus = await Filesystem.checkPermissions();
          if (permStatus.publicStorage !== 'granted') {
            const permissionResult = await Filesystem.requestPermissions();
            if (permissionResult.publicStorage !== 'granted') {
              toast({ title: "Permissão Negada", description: "Permissão de armazenamento é necessária para baixar o arquivo.", variant: "destructive" });
              return;
            }
          }
        }

        const tempPath = `tmp_${Date.now()}_${fileName}`;
        const downloadResult = await Filesystem.downloadFile({
          path: tempPath,
          url: attachmentUrl,
          directory: Directory.Cache,
          responseType: 'blob' 
        });

        if (!downloadResult || !downloadResult.path) {
            throw new Error("Falha ao baixar o arquivo para o cache.");
        }
        
        let finalFilePathForToast = fileName;
        let savedFileUri: string | undefined;

        try {
            const copyResult = await Filesystem.copy({
                from: downloadResult.path,
                to: fileName,
                directory: Directory.Downloads, 
            });
            finalFilePathForToast = `na pasta Downloads como ${fileName}`;
            savedFileUri = copyResult.uri;
            console.log('Arquivo salvo em Downloads:', savedFileUri);
        } catch (e) {
            console.warn("Não foi possível salvar na pasta Downloads, tentando ExternalStorage:", e);
            try {
                const copyResultExternal = await Filesystem.copy({
                    from: downloadResult.path,
                    to: fileName, 
                    directory: Directory.ExternalStorage,
                });
                finalFilePathForToast = `no armazenamento externo como ${fileName}`;
                savedFileUri = copyResultExternal.uri;
                console.log('Arquivo salvo em ExternalStorage:', savedFileUri);
            } catch (copyError) {
                console.error("Erro ao copiar arquivo para armazenamento público:", copyError);
                toast({ title: "Erro ao Salvar", description: `Falha ao salvar ${fileName} no dispositivo. Verifique as permissões.`, variant: "destructive"});
                try { await Filesystem.deleteFile({ path: downloadResult.path }); } catch (delErr) { console.warn("Falha ao limpar cache após erro de cópia", delErr);}
                return;
            }
        }

        toast({ title: "Download Concluído", description: `${fileName} salvo ${finalFilePathForToast}.`, duration: 5000});

        try {
          await Filesystem.deleteFile({ path: downloadResult.path });
        } catch (deleteError) {
          console.warn("Erro ao limpar arquivo temporário do cache:", deleteError);
        }

      } catch (error) {
        console.error("Erro durante o download nativo:", error);
        toast({
          title: "Erro no Download",
          description: `Não foi possível baixar ${fileName}. ${error instanceof Error ? error.message : 'Verifique a URL e a conexão.'}`, 
          variant: "destructive"
        });
      }
    } else {
      // Lógica de download para Web (deixa o navegador lidar)
      try {
        const response = await fetch(attachmentUrl);
        if (!response.ok) throw new Error(`Falha ao buscar o arquivo: ${response.statusText}`);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', fileName || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: "Download Iniciado", description: `${fileName} deve começar a baixar em seu navegador.`, duration: 3000 });
      } catch (error) {
        console.error("Erro durante o download na web:", error);
        toast({
          title: "Erro no Download (Web)",
          description: `Não foi possível baixar ${fileName}. ${error instanceof Error ? error.message : 'Verifique a URL.'}`, 
          variant: "destructive"
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-500">Carregando definições...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleVoltar} size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Definições: {obraNome}</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4" ref={boardRef}>
        <DragDropContext onDragEnd={handleMoveCard}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {board?.lists.map((lista) => (
              <Droppable key={lista.id} droppableId={lista.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-gray-50 rounded-lg p-4 min-h-[200px]"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-semibold text-lg">{lista.title}</h2>
                      <Button 
                        onClick={() => {
                          setListaAtual(lista);
                          setNovoCard({ title: '', description: '', attachments: [] });
                          setUploadedFiles([]);
                          setFiles([]);
                          setShowAddCardDialog(true);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>

                    {lista.cards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-400 border border-dashed border-gray-300 rounded-lg">
                        <FileUp className="w-8 h-8 mb-2" />
                        <p className="text-sm">Sem definições</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {lista.cards.map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-white p-3 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow relative group"
                                onClick={() => {
                                  setCardAtual(card);
                                  setListaAtual(lista);
                                  setShowCardDetailsDialog(true);
                                }}
                              >
                                {/* Indicador de arraste */}
                                <div className="absolute top-0 left-0 w-full h-full rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <div className="absolute top-2 right-2 bg-gray-100 rounded-full p-1 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                                      <path d="M14 3v4a1 1 0 0 0 1 1h4"></path>
                                      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"></path>
                                      <line x1="9" y1="9" x2="15" y2="9"></line>
                                      <line x1="9" y1="13" x2="15" y2="13"></line>
                                      <line x1="9" y1="17" x2="13" y2="17"></line>
                                    </svg>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-medium text-base line-clamp-2">{card.title}</h3>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {/* Opção para mover para outra lista */}
                                      {board?.lists.map((targetLista) => {
                                        if (targetLista.id !== lista.id) {
                                          return (
                                            <DropdownMenuItem
                                              key={targetLista.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveCardToList(card.id, lista.id, targetLista.id);
                                              }}
                                            >
                                              <ArrowLeft className="w-4 h-4 mr-2 rotate-45" />
                                              Mover para {targetLista.title}
                                            </DropdownMenuItem>
                                          );
                                        }
                                        return null;
                                      })}
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCardAtual(card);
                                          setListaAtual(lista);
                                          setShowDeleteCardDialog(true);
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-2">
                                  {/* Contagem de itens do checklist */}
                                  {card.checklists && card.checklists.length > 0 && (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700">
                                      <CheckSquare className="w-3 h-3 mr-1" />
                                      {card.checklists.reduce((total, cl) => total + cl.items.filter(item => item.checked).length, 0)}/
                                      {card.checklists.reduce((total, cl) => total + cl.items.length, 0)}
                                    </Badge>
                                  )}

                                  {/* Contagem de anexos */}
                                  {card.attachments && card.attachments.length > 0 && (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-700">
                                      <Paperclip className="w-3 h-3 mr-1" />
                                      {card.attachments.length}
                                    </Badge>
                                  )}
                                  
                                  {/* Indicador de lista */}
                                  <Badge variant="outline" className={lista.title === "Definido" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                                    {lista.title}
                                  </Badge>
                                </div>
                                
                                {/* Mostrar parte da descrição se existir */}
                                {card.description && (
                                  <p className="text-gray-600 text-sm line-clamp-2">
                                    {card.description}
                                  </p>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Diálogo para adicionar card */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Definição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Digite um título para a definição"
                value={novoCard.title}
                onChange={(e) => setNovoCard({ ...novoCard, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva os detalhes da definição"
                value={novoCard.description}
                onChange={(e) => setNovoCard({ ...novoCard, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Anexos (opcional)</Label>
              <FilePond
                files={files}
                onupdatefiles={setFiles}
                allowMultiple={true}
                maxFiles={5}
                server={{
                  process: (fieldName, file, metadata, load, error, progress, abort) => {
                    // Processar arquivo
                    handleProcessFile(null, { file, id: Date.now().toString() } as any);
                    load(Date.now().toString());
                    return {
                      abort: () => {
                        abort();
                      }
                    };
                  },
                  revert: (uniqueFileId, load, error) => {
                    // Remover arquivo
                    const fileToRemove = files.find(f => f.id === uniqueFileId);
                    if (fileToRemove) {
                      handleRemoveFile(fileToRemove);
                    }
                    load();
                  }
                }}
                name="files"
                labelIdle='Arraste e solte arquivos aqui ou <span class="filepond--label-action">Procure</span>'
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAddCardDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleAddCard}
              disabled={!novoCard.title}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para excluir card */}
      <Dialog open={showDeleteCardDialog} onOpenChange={setShowDeleteCardDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Definição</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Tem certeza que deseja excluir esta definição?</p>
            <p className="font-medium mt-2">{cardAtual?.title}</p>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowDeleteCardDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeleteCard}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para detalhes do card */}
      <Dialog open={showCardDetailsDialog} onOpenChange={setShowCardDetailsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {cardAtual ? (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-xl pr-8">
                    {editandoTitulo ? (
                      <Input
                        value={novoTitulo}
                        onChange={(e) => setNovoTitulo(e.target.value)}
                        className="text-xl font-semibold"
                        autoFocus
                      />
                    ) : (
                      cardAtual?.title || "Detalhes da Definição"
                    )}
                  </DialogTitle>
                  
                  {/* Botão para mover o card para a outra lista */}
                  {listaAtual && cardAtual && board?.lists && board.lists.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Mover para:</span>
                      {board.lists.map((lista) => {
                        if (lista.id !== listaAtual.id) {
                          return (
                            <Button 
                              key={lista.id}
                              variant={lista.title === "Definido" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleMoveCardToList(cardAtual.id, listaAtual.id, lista.id)}
                            >
                              {lista.title}
                            </Button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
                {!editandoTitulo && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditandoTitulo(true);
                      setNovoTitulo(cardAtual?.title || "");
                    }}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar Título
                    </Button>
                  </div>
                )}
                {editandoTitulo && (
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm" 
                      onClick={handleUpdateTitle}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Salvar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditandoTitulo(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                )}
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Descrição */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-700" />
                    <h3 className="font-medium">Descrição</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setEditandoDescricao(true);
                        setNovaDescricao(cardAtual.description || "");
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="pl-7">
                    {editandoDescricao ? (
                      <div className="space-y-2">
                        <Textarea
                          value={novaDescricao}
                          onChange={(e) => setNovaDescricao(e.target.value)}
                          rows={4}
                          className="w-full"
                        />
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              if (board && listaAtual) {
                                try {
                                  // Criar cópia do board para atualização
                                  const updatedBoard = { ...board };
                                  
                                  // Encontrar o card e atualizar a descrição
                                  const listaIndex = updatedBoard.lists.findIndex(lista => lista.id === listaAtual.id);
                                  if (listaIndex !== -1) {
                                    const cardIndex = updatedBoard.lists[listaIndex].cards.findIndex(c => c.id === cardAtual.id);
                                    if (cardIndex !== -1) {
                                      updatedBoard.lists[listaIndex].cards[cardIndex].description = capitalizarPrimeiraLetra(novaDescricao.trim());
                                      
                                      // Atualizar o quadro no banco de dados
                                      const { error } = await supabase
                                        .from('definicoes_quadros')
                                        .update(updatedBoard)
                                        .eq('id', updatedBoard.id);
                                      
                                      if (error) throw error;
                                      
                                      setBoard(updatedBoard);
                                      
                                      // Atualizar o card atual
                                      const updatedCard = { ...cardAtual, description: capitalizarPrimeiraLetra(novaDescricao.trim()) };
                                      setCardAtual(updatedCard);

                                      toast({
                                        title: "Sucesso",
                                        description: "Descrição atualizada com sucesso!",
                                      });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Erro ao atualizar descrição:', error);
                                  toast({
                                    title: "Erro",
                                    description: "Não foi possível atualizar a descrição. Tente novamente.",
                                    variant: "destructive"
                                  });
                                }
                              }
                              setEditandoDescricao(false);
                            }}
                          >
                            <Check className="w-4 h-4" />
                            Salvar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditandoDescricao(false)}
                          >
                            <X className="w-4 h-4" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      cardAtual.description ? (
                        <p className="text-gray-700 whitespace-pre-line">{cardAtual.description}</p>
                      ) : (
                        <p className="text-gray-400 italic">Sem descrição</p>
                      )
                    )}
                  </div>
                </div>

                {/* Checklists */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-gray-700" />
                      <h3 className="font-medium">Checklists</h3>
                    </div>
                    
                    {/* Form para adicionar checklist */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nome do checklist"
                        value={novoChecklistNome}
                        onChange={(e) => setNovoChecklistNome(e.target.value)}
                        className="text-sm h-8 w-48"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleAddChecklist}
                        disabled={!novoChecklistNome}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {(!cardAtual.checklists || cardAtual.checklists.length === 0) ? (
                    <p className="text-gray-400 italic pl-7">Nenhum checklist adicionado</p>
                  ) : (
                    <div className="space-y-4 pl-7">
                      {cardAtual.checklists.map((checklist) => (
                        <div key={checklist.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-700">{checklist.title}</h4>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteChecklist(checklist.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Lista de itens do checklist */}
                          <div className="space-y-2">
                            {checklist.items.map((item) => (
                              <div key={item.id} className="flex items-start gap-2">
                                <Checkbox 
                                  checked={item.checked} 
                                  onCheckedChange={(checked) => 
                                    handleToggleChecklistItem(checklist.id, item.id, checked as boolean)
                                  }
                                  id={item.id}
                                />
                                <label 
                                  htmlFor={item.id}
                                  className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                                >
                                  {item.text || item.title}
                                </label>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto p-0 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChecklistItem(checklist.id, item.id);
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          
                          {/* Form para adicionar item */}
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              placeholder="Novo item"
                              value={checklistAtual?.id === checklist.id ? novoChecklistItem : ''}
                              onChange={(e) => {
                                setChecklistAtual(checklist);
                                setNovoChecklistItem(e.target.value);
                              }}
                              className="text-sm h-8"
                            />
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setChecklistAtual(checklist);
                                handleAddChecklistItem();
                              }}
                              disabled={!novoChecklistItem || checklistAtual?.id !== checklist.id}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Anexos */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-5 h-5 text-gray-700" />
                      <h3 className="font-medium">Anexos</h3>
                    </div>
                    
                    {/* Botão para adicionar novos anexos */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setFiles([]);
                        setUploadedFiles([]);
                        setShowAddAttachmentDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  
                  {(!cardAtual.attachments || cardAtual.attachments.length === 0) ? (
                    <p className="text-gray-400 italic pl-7">Nenhum anexo adicionado</p>
                  ) : (
                    <div className="space-y-2 pl-7">
                      {cardAtual.attachments.map((attachment, index) => {
                        // Extrair nome do arquivo da URL
                        const attachmentFileNamePart = attachment.split('/').pop()?.split('?')[0];
                        const decodedFileName = attachmentFileNamePart ? decodeURIComponent(attachmentFileNamePart) : `Arquivo ${index + 1}`;
                        
                        return (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm truncate" title={decodedFileName}>
                                {decodedFileName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Botão Abrir com ícone Eye */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="p-0 h-6 w-6 text-blue-600 hover:text-blue-800"
                                title="Abrir/Visualizar arquivo"
                                onClick={() => handleOpenFile(attachment)} 
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {/* Botão Baixar */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="p-0 h-6 w-6 text-green-600 hover:text-green-800"
                                title="Baixar arquivo"
                                onClick={() => handleDownloadFile(attachment, decodedFileName)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {/* Botão Excluir Anexo */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="p-0 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAttachment(index);
                                }}
                              >
                                <X className="w-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p>Carregando detalhes...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo para adicionar anexos a um card existente */}
      <Dialog open={showAddAttachmentDialog} onOpenChange={setShowAddAttachmentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Anexos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Anexos</Label>
              <FilePond
                files={files}
                onupdatefiles={setFiles}
                allowMultiple={true}
                maxFiles={5}
                server={{
                  process: (fieldName, file, metadata, load, error, progress, abort) => {
                    // Processar arquivo
                    handleProcessFile(null, { file, id: Date.now().toString() } as any);
                    load(Date.now().toString());
                    return {
                      abort: () => {
                        abort();
                      }
                    };
                  },
                  revert: (uniqueFileId, load, error) => {
                    // Remover arquivo
                    const fileToRemove = files.find(f => f.id === uniqueFileId);
                    if (fileToRemove) {
                      handleRemoveFile(fileToRemove);
                    }
                    load();
                  }
                }}
                name="files"
                labelIdle='Arraste e solte arquivos aqui ou <span class="filepond--label-action">Procure</span>'
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowAddAttachmentDialog(false);
                setFiles([]);
                setUploadedFiles([]);
              }}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleAddAttachmentsToCard}
              disabled={uploadedFiles.length === 0}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DefinicoesObra; 