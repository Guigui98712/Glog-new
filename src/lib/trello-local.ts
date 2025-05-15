import { supabase } from './supabase';
import { TrelloBoard, TrelloList as TrelloListType, TrelloCard as TrelloCardType, TrelloChecklist as TrelloChecklistType, TrelloChecklistItem as TrelloChecklistItemType } from '@/types/trello';

interface TrelloList {
  id: number;
  board_id: number;
  nome: string;
  position: number;
  created_at: string;
  updated_at?: string;
}

interface TrelloCard {
  id: number;
  list_id: number;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  labels: TrelloLabel[];
  created_at: string;
  updated_at: string;
}

interface TrelloBoard {
  lists: (TrelloList & { cards: TrelloCard[], title?: string })[];
  nome: string;
}

interface TrelloChecklist {
  id: number;
  card_id: number;
  title: string;
  position: number;
  items: TrelloChecklistItem[];
}

interface TrelloChecklistItem {
  id: number;
  checklist_id: number;
  title: string;
  position: number;
  checked: boolean;
}

interface TrelloLabel {
  id: number;
  title: string;
  color: string;
  created_at: string;
}

// Função para obter ou criar um board para a obra
const obterOuCriarBoard = async (obraId: number): Promise<number> => {
  try {
    console.log('[DEBUG] Obtendo ou criando board para obra ID:', obraId);
    
    // Validar ID da obra
    if (!obraId || isNaN(obraId)) {
      console.error('[DEBUG] ID de obra inválido:', obraId);
      throw new Error(`ID da obra inválido: ${obraId}`);
    }
    
    // Verificar se já existe um board para esta obra
    const { data: obra, error: obraError } = await supabase
      .from('obras')
      .select('trello_board_id')
      .eq('id', obraId)
      .single();
    
    if (obraError) {
      console.error('[DEBUG] Erro ao buscar obra:', obraError);
      console.error('[DEBUG] Código:', obraError.code);
      console.error('[DEBUG] Mensagem:', obraError.message);
      throw new Error(`Erro ao buscar obra: ${obraError.message}`);
    }
    
    console.log('[DEBUG] Dados da obra:', obra);
    
    // Se a obra já tem um board_id, verificar se o board existe
    if (obra && obra.trello_board_id) {
      // Verificar se o board_id é um número válido
      if (!isNaN(Number(obra.trello_board_id))) {
        const boardId = Number(obra.trello_board_id);
        console.log('[DEBUG] Board ID existente encontrado:', boardId);
        return boardId;
      }
    }
    
    console.log('[DEBUG] Nenhum board encontrado, criando novo board');
    
    // Gerar um ID único para o board
    const boardId = `board_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log('[DEBUG] ID gerado para novo board:', boardId);
    
    // Criar um novo board
    const { data: newBoard, error: createError } = await supabase
      .from('trello_boards')
      .insert({ 
        obra_id: obraId,
        board_id: boardId
      })
      .select('id')
      .single();
    
    if (createError) {
      console.error('[DEBUG] Erro ao criar board:', createError);
      console.error('[DEBUG] Código:', createError.code);
      console.error('[DEBUG] Mensagem:', createError.message);
      throw new Error(`Erro ao criar board: ${createError.message}`);
    }
    
    if (!newBoard) {
      console.error('[DEBUG] Nenhum dado retornado após criar board');
      throw new Error('Board não foi criado: nenhum dado retornado');
    }
    
    console.log('[DEBUG] Board criado com sucesso:', newBoard);
    
    // Atualizar a obra com o novo board_id
    const { error: updateError } = await supabase
      .from('obras')
      .update({ trello_board_id: newBoard.id })
      .eq('id', obraId);
    
    if (updateError) {
      console.error('[DEBUG] Erro ao atualizar obra com board_id:', updateError);
      console.error('[DEBUG] Código:', updateError.code);
      console.error('[DEBUG] Mensagem:', updateError.message);
      throw new Error(`Erro ao atualizar obra com board_id: ${updateError.message}`);
    }
    
    console.log('[DEBUG] Obra atualizada com o novo board_id:', newBoard.id);
    return newBoard.id;
  } catch (error) {
    console.error('[DEBUG] Erro ao obter ou criar board:', error);
    if (error instanceof Error) {
      console.error('[DEBUG] Mensagem de erro:', error.message);
    }
    throw error;
  }
};

// Função para criar listas padrão para uma obra
export const criarListasPadrao = async (obraId: number): Promise<void> => {
  try {
    console.log('[DEBUG] Iniciando criação de listas padrão para obra ID:', obraId);
    
    // Obter ou criar o board para esta obra
    const boardId = await obterOuCriarBoard(obraId);
    console.log('[DEBUG] Board ID obtido para criar listas padrão:', boardId);
    
    // Array vazio - não criar nenhuma lista padrão
    const listasPadrao: { nome: string, position: number }[] = [];

    // Verificar se já existem listas para este board
    const { data: listasExistentes, error: checkError } = await supabase
      .from('trello_lists')
      .select('id, nome')
      .eq('board_id', boardId);
    
    if (checkError) {
      console.error('[DEBUG] Erro ao verificar listas existentes:', checkError);
      throw checkError;
    }

    console.log('[DEBUG] Listas existentes:', listasExistentes);
    
    // Se já existem listas, não fazer nada
    if (listasExistentes && listasExistentes.length > 0) {
      console.log('[DEBUG] Já existem listas para este board, não criando listas padrão');
      return;
    }

    console.log('[DEBUG] Nenhuma lista existente, mas não serão criadas listas padrão');
    
    // Não inserir nenhuma lista padrão
    console.log('[DEBUG] Configurado para não criar listas padrão automaticamente');
  } catch (error) {
    console.error('[DEBUG] Erro ao verificar listas:', error);
    throw error;
  }
};

// Função para obter o quadro de uma obra
export const obterQuadroObra = async (obraId: number, onProgress?: (message: string, progress: number) => void): Promise<TrelloBoard> => {
  try {
    onProgress?.('Iniciando carregamento do quadro...', 0);
    console.log('[DEBUG] Iniciando obterQuadroObra para obra ID:', obraId);
    
    if (!obraId) {
      throw new Error('ID da obra não fornecido');
    }

    // Obter o board_id da obra
    onProgress?.('Buscando informações da obra...', 10);
    const { data: obra, error: obraError } = await supabase
      .from('obras')
      .select('trello_board_id, nome')
      .eq('id', obraId)
      .single();

    if (obraError) {
      console.error('[DEBUG] Erro ao buscar obra:', obraError);
      throw new Error(`Erro ao buscar obra: ${obraError.message}`);
    }

    if (!obra || !obra.trello_board_id) {
      onProgress?.('Criando novo quadro para a obra...', 20);
      console.log('[DEBUG] Obra não tem board_id, criando board...');
      // Apenas criar o board sem criar listas padrão
      const boardId = await obterOuCriarBoard(obraId);
      
      // Buscar novamente após criar o board
      onProgress?.('Carregando listas do novo quadro...', 30);
      const { data: lists, error: listsError } = await supabase
        .from('trello_lists')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true });
      
      if (listsError) {
        console.error('[DEBUG] Erro ao buscar listas:', listsError);
        throw new Error(`Erro ao buscar listas: ${listsError.message}`);
      }
      
      onProgress?.('Quadro criado com sucesso', 100);
      // Retornar um quadro vazio ou com as listas encontradas
      return { 
        lists: lists ? lists.map(list => ({ ...list, title: list.nome, cards: [] })) : [],
        nome: obra.nome
      };
    }
    
    console.log('[DEBUG] Board ID encontrado:', obra.trello_board_id);
    
    // Buscar as listas do board
    onProgress?.('Carregando listas do quadro...', 40);
    const { data: lists, error: listsError } = await supabase
      .from('trello_lists')
      .select('*')
      .eq('board_id', obra.trello_board_id)
      .order('position', { ascending: true });

    if (listsError) {
      console.error('[DEBUG] Erro ao buscar listas:', listsError);
      throw new Error(`Erro ao buscar listas: ${listsError.message}`);
    }

    if (!lists || lists.length === 0) {
      console.log('[DEBUG] Nenhuma lista encontrada para o board');
      onProgress?.('Quadro carregado (sem listas)', 100);
      // Retornar um quadro vazio sem listas
      return { lists: [], nome: obra.nome };
    }
    
    console.log('[DEBUG] Listas encontradas:', lists.length);

    // Para cada lista, buscar os cards
    onProgress?.('Carregando cartões...', 50);
    const totalLists = lists.length;
    const listsWithCards = await Promise.all(
      lists.map(async (list, index) => {
        onProgress?.(`Carregando cartões da lista ${list.nome}...`, 50 + (30 * (index / totalLists)));
        console.log('[DEBUG] Buscando cards para lista ID:', list.id, 'Nome:', list.nome);
        
        const { data: cards, error: cardsError } = await supabase
          .from('trello_cards')
          .select('*')
          .eq('list_id', list.id)
          .order('position', { ascending: true });

        if (cardsError) {
          console.error(`[DEBUG] Erro ao buscar cards da lista ${list.id}:`, cardsError);
          return { ...list, title: list.nome, cards: [] };
        }

        // Para cada card, buscar checklists, labels, comments e attachments
        const totalCards = cards?.length || 0;
        const cardsWithDetails = await Promise.all(
          (cards || []).map(async (card, cardIndex) => {
            onProgress?.(`Carregando detalhes do cartão ${cardIndex + 1}/${totalCards} em ${list.nome}...`, 
              80 + (20 * (cardIndex / totalCards)));
            
            try {
              // Buscar etiquetas, checklists, comentários e anexos em paralelo
              const [
                cardLabelsResult,
                checklistsResult,
                commentsResult,
                attachmentsResult
              ] = await Promise.all([
                supabase
                  .from('trello_card_labels')
                  .select(`
                    label_id,
                    trello_labels (
                      id,
                      title,
                      color,
                      created_at
                    )
                  `)
                  .eq('card_id', card.id),
                  
                supabase
                  .from('trello_checklists')
                  .select('*')
                  .eq('card_id', card.id)
                  .order('position', { ascending: true }),
                  
                supabase
                  .from('trello_comments')
                  .select('*')
                  .eq('card_id', card.id)
                  .order('created_at', { ascending: false }),
                  
                supabase
                  .from('trello_attachments')
                  .select('*')
                  .eq('card_id', card.id)
                  .order('created_at', { ascending: false })
              ]);
              
              // Usar um Map para garantir unicidade das etiquetas por ID
              const labelsMap = new Map();
              cardLabelsResult.data?.forEach(relation => {
                if (relation.trello_labels) {
                  labelsMap.set(relation.trello_labels.id, relation.trello_labels);
                }
              });
              const labels = Array.from(labelsMap.values());
              
              // Buscar itens das checklists em paralelo
              const checklistsWithItems = checklistsResult.data
                ? await Promise.all(
                    checklistsResult.data.map(async (checklist) => {
                      const { data: items, error: itemsError } = await supabase
                        .from('trello_checklist_items')
                        .select('*')
                        .eq('checklist_id', checklist.id)
                        .order('position', { ascending: true });
                        
                      if (itemsError) {
                        console.error(`[DEBUG] Erro ao buscar itens para checklist ${checklist.id}:`, itemsError);
                        return { ...checklist, items: [] };
                      }
                      
                      return { ...checklist, items: items || [] };
                    })
                  )
                : [];

              return {
                ...card,
                labels,
                checklists: checklistsWithItems,
                comments: commentsResult.data || [],
                attachments: attachmentsResult.data || []
              };
            } catch (error) {
              console.error(`[DEBUG] Erro ao carregar detalhes do card ${card.id}:`, error);
              return {
                ...card,
                labels: [],
                checklists: [],
                comments: [],
                attachments: []
              };
            }
          })
        );
        
        return { ...list, title: list.nome, cards: cardsWithDetails };
      })
    );
    
    onProgress?.('Quadro carregado com sucesso', 100);
    console.log('[DEBUG] Quadro completo carregado com sucesso');
    return { lists: listsWithCards, nome: obra.nome };
  } catch (error) {
    console.error('[DEBUG] Erro ao obter quadro da obra:', error);
    onProgress?.(`Erro ao carregar quadro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 0);
    throw error;
  }
};

// Função para criar um novo card
export const criarCard = async (
  listId: number,
  title: string,
  description: string | null = null,
  dueDate: string | null = null,
  labels: string[] = []
): Promise<TrelloCardType> => {
  try {
    console.log('[DEBUG] Criando card na lista:', listId);
    console.log('[DEBUG] Dados do card:', { title, description, dueDate, labels });
    
    // Validar ID da lista
    if (!listId || isNaN(listId)) {
      console.error('[DEBUG] ID de lista inválido:', listId);
      throw new Error(`ID da lista inválido: ${listId}`);
    }
    
    // Encontrar a posição do novo card
    const { data: existingCards, error: cardsError } = await supabase
      .from('trello_cards')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1);
    
    if (cardsError) {
      console.error('[DEBUG] Erro ao buscar cards existentes:', cardsError);
      throw cardsError;
    }
    
    // Determinar a posição do novo card
    const position = existingCards && existingCards.length > 0 
      ? (existingCards[0].position || 0) + 1000 
      : 1000;
    
    console.log('[DEBUG] Usando posição para o card:', position);
    
    // Garantir que due_date seja null quando for uma string vazia
    const formattedDueDate = dueDate && dueDate.trim() !== '' ? dueDate : null;
    
    // Gerar um ID único para o card
    const card_id = `card_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const cardData = { 
      list_id: listId,
      card_id: card_id,
      nome: title,
      title: title,
      description, 
      position, 
      due_date: formattedDueDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('[DEBUG] Inserindo card com campos:', cardData);
    
    // Inserir o novo card
    const { data: card, error: createError } = await supabase
      .from('trello_cards')
      .insert(cardData)
      .select()
      .single();
    
    if (createError) {
      console.error('[DEBUG] Erro ao criar card:', createError);
      console.error('[DEBUG] Código:', createError.code);
      console.error('[DEBUG] Mensagem:', createError.message);
      console.error('[DEBUG] Detalhes:', createError.details);
      throw new Error(`Falha ao criar card: ${createError.message}`);
    }
    
    if (!card) {
      console.error('[DEBUG] Nenhum card retornado após a criação');
      throw new Error('Falha ao criar o card: nenhum dado retornado');
    }
    
    console.log('[DEBUG] Card criado com sucesso:', card);
    
    // Criar relações de etiquetas se houver labels
    if (labels && labels.length > 0) {
      console.log('[DEBUG] Adicionando etiquetas ao card:', labels);
      
      // Remover duplicatas dos nomes de etiquetas
      const uniqueLabels = [...new Set(labels)];
      console.log('[DEBUG] Etiquetas após remover duplicatas:', uniqueLabels);
      
      // Buscar IDs das etiquetas pelos nomes
      const { data: labelData, error: labelError } = await supabase
        .from('trello_labels')
        .select('id, title')
        .in('title', uniqueLabels);
      
      if (labelError) {
        console.error('[DEBUG] Erro ao buscar etiquetas:', labelError);
      } else if (labelData) {
        // Criar relações entre o card e as etiquetas
        const labelRelations = labelData.map(label => ({
          card_id: card.id,
          label_id: label.id,
          created_at: new Date().toISOString()
        }));
        
        const { error: relationError } = await supabase
          .from('trello_card_labels')
          .insert(labelRelations);
        
        if (relationError) {
          console.error('[DEBUG] Erro ao criar relações de etiquetas:', relationError);
        }
      }
    }
    
    // Retornar o card com os campos necessários
    return {
      ...card,
      title: card.title || card.nome,
      labels: [], // Inicializar com array vazio
      checklists: [], // Inicializar com array vazio
      comments: [], // Inicializar com array vazio
      attachments: [] // Inicializar com array vazio
    } as TrelloCardType;
  } catch (error) {
    console.error('[DEBUG] Erro ao criar card:', error);
    if (error instanceof Error) {
      console.error('[DEBUG] Mensagem de erro:', error.message);
    }
    throw error;
  }
};

// Função para mover um card para outra lista
export const moverCard = async (
  cardId: number,
  novaListaId: number
): Promise<void> => {
  try {
    // Obter todos os cards da lista de destino para calcular a posição de forma inteligente
    const { data: cardsDestino } = await supabase
      .from('trello_cards')
      .select('id, position')
      .eq('list_id', novaListaId)
      .order('position', { ascending: true });
    
    let newPosition = 1000; // Posição padrão inicial
    
    if (cardsDestino && cardsDestino.length > 0) {
      // Inserir no início (mais importante em Kanban)
      // Calcular posição entre 0 e o primeiro card
      const firstCardPosition = cardsDestino[0]?.position || 1000;
      newPosition = firstCardPosition / 2;
    }

    // Atualizar card
    const { error } = await supabase
      .from('trello_cards')
      .update({
        list_id: novaListaId,
        position: newPosition,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    if (error) {
      console.error('Erro ao mover card:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao mover card:', error);
    throw error;
  }
};

// Função para excluir um card
export const excluirCard = async (cardId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trello_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Erro ao excluir card:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir card:', error);
    throw error;
  }
};

// Função para atualizar um card
export const atualizarCard = async (
  cardId: number,
  updates: {
    title?: string;
    description?: string | null;
    position?: number;
    due_date?: string | null;
    labels?: string[];
  }
): Promise<TrelloCardType> => {
  try {
    console.log('[DEBUG] Atualizando card:', { cardId, updates });
    
    const { data, error } = await supabase
      .from('trello_cards')
      .update(updates)
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error('[DEBUG] Erro ao atualizar card:', error);
      throw error;
    }

    if (!data) {
      console.error('[DEBUG] Card não foi atualizado, retorno vazio');
      throw new Error('Card não foi atualizado');
    }

    console.log('[DEBUG] Card atualizado com sucesso:', data);

    return {
      ...data,
      labels: data.labels || [],
      checklists: [],
      comments: [],
      attachments: []
    };
  } catch (error) {
    console.error('[DEBUG] Erro detalhado ao atualizar card:', error);
    throw error;
  }
};

// Função para reordenar cards em uma lista
export const reordenarCards = async (
  listId: number,
  cardIds: number[]
): Promise<void> => {
  try {
    // Atualizar posição de cada card
    await Promise.all(
      cardIds.map((cardId, index) =>
        supabase
          .from('trello_cards')
          .update({ position: index + 1 })
          .eq('id', cardId)
      )
    );
  } catch (error) {
    console.error('Erro ao reordenar cards:', error);
    throw error;
  }
};

// Função para criar um novo checklist
export const criarChecklist = async (
  cardId: number,
  title: string
): Promise<TrelloChecklistType> => {
  try {
    // Obter a última posição
    const { data: lastChecklist } = await supabase
      .from('trello_checklists')
      .select('position')
      .eq('card_id', cardId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const newPosition = (lastChecklist?.position || 0) + 1;

    // Criar checklist
    const { data, error } = await supabase
      .from('trello_checklists')
      .insert({
        card_id: cardId,
        title,
        position: newPosition
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar checklist:', error);
      throw error;
    }

    return { ...data, items: [] };
  } catch (error) {
    console.error('Erro ao criar checklist:', error);
    throw error;
  }
};

// Função para adicionar um item ao checklist
export const adicionarItemChecklist = async (
  checklistId: number,
  title: string
): Promise<TrelloChecklistItemType> => {
  try {
    // Obter a última posição
    const { data: lastItem } = await supabase
      .from('trello_checklist_items')
      .select('position')
      .eq('checklist_id', checklistId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const newPosition = (lastItem?.position || 0) + 1;

    // Criar item
    const { data, error } = await supabase
      .from('trello_checklist_items')
      .insert({
        checklist_id: checklistId,
        title,
        position: newPosition,
        checked: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar item do checklist:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao criar item do checklist:', error);
    throw error;
  }
};

// Função para atualizar um item do checklist
export const atualizarItemChecklist = async (
  itemId: number,
  updates: Partial<TrelloChecklistItemType>
): Promise<TrelloChecklistItemType> => {
  try {
    const { data, error } = await supabase
      .from('trello_checklist_items')
      .update(updates)
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar item do checklist:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao atualizar item do checklist:', error);
    throw error;
  }
};

// Função para excluir um item do checklist
export const excluirItemChecklist = async (itemId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trello_checklist_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Erro ao excluir item do checklist:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir item do checklist:', error);
    throw error;
  }
};

// Função para excluir um checklist
export const excluirChecklist = async (checklistId: number): Promise<void> => {
  try {
    // Primeiro exclui todos os itens do checklist
    const { error: itemsError } = await supabase
      .from('trello_checklist_items')
      .delete()
      .eq('checklist_id', checklistId);

    if (itemsError) {
      console.error('Erro ao excluir itens do checklist:', itemsError);
      throw itemsError;
    }

    // Depois exclui o checklist
    const { error } = await supabase
      .from('trello_checklists')
      .delete()
      .eq('id', checklistId);

    if (error) {
      console.error('Erro ao excluir checklist:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir checklist:', error);
    throw error;
  }
};

// Função para adicionar um comentário
export const adicionarComentario = async (
  cardId: number,
  content: string,
  userId: string
): Promise<TrelloComment> => {
  try {
    const { data, error } = await supabase
      .from('trello_comments')
      .insert({
        card_id: cardId,
        user_id: userId,
        content
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao adicionar comentário:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao adicionar comentário:', error);
    throw error;
  }
};

// Função para excluir um comentário
export const excluirComentario = async (commentId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trello_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Erro ao excluir comentário:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir comentário:', error);
    throw error;
  }
};

// Função para adicionar um anexo
export const adicionarAnexo = async (
  cardId: number,
  file: File
): Promise<TrelloAttachment> => {
  try {
    // Upload do arquivo para o storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Erro ao fazer upload do arquivo:', uploadError);
      throw uploadError;
    }

    // Obter URL pública do arquivo
    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);

    // Criar registro do anexo
    const { data, error } = await supabase
      .from('trello_attachments')
      .insert({
        card_id: cardId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size
      })
      .select('*')
      .single();

    if (error) {
      // Se houver erro ao criar o registro, tentar excluir o arquivo
      await supabase.storage
        .from('attachments')
        .remove([fileName]);
      
      console.error('Erro ao criar registro do anexo:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao adicionar anexo:', error);
    throw error;
  }
};

// Função para excluir um anexo
export const excluirAnexo = async (attachmentId: number): Promise<void> => {
  try {
    // Primeiro, buscar o anexo para obter o nome do arquivo
    const { data: attachment, error: fetchError } = await supabase
      .from('trello_attachments')
      .select('file_url')
      .eq('id', attachmentId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar anexo:', fetchError);
      throw fetchError;
    }

    // Extrair o nome do arquivo da URL
    const fileName = attachment.file_url.split('/').pop();

    // Excluir o arquivo do storage
    const { error: storageError } = await supabase.storage
      .from('attachments')
      .remove([fileName]);

    if (storageError) {
      console.error('Erro ao excluir arquivo do storage:', storageError);
      throw storageError;
    }

    // Excluir o registro do anexo
    const { error } = await supabase
      .from('trello_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      console.error('Erro ao excluir registro do anexo:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    throw error;
  }
};

// Função para buscar etiquetas disponíveis
export const buscarEtiquetas = async (): Promise<TrelloLabel[]> => {
  try {
    // Buscar etiquetas existentes
    const { data: etiquetasExistentes, error: selectError } = await supabase
      .from('trello_labels')
      .select('*');

    if (selectError) {
      console.error('[DEBUG] Erro ao buscar etiquetas:', selectError);
      throw selectError;
    }

    // Usar um Map para garantir unicidade das etiquetas existentes por título (case insensitive)
    const etiquetasMap = new Map();
    if (etiquetasExistentes) {
      etiquetasExistentes.forEach(etiqueta => {
        etiquetasMap.set(etiqueta.title.toLowerCase(), etiqueta);
      });
    }

    // Retornar todas as etiquetas do Map, garantindo unicidade
    return Array.from(etiquetasMap.values());
  } catch (error) {
    console.error('[DEBUG] Erro ao buscar etiquetas:', error);
    throw error;
  }
};

// Função para buscar etiquetas de um card específico
export const buscarEtiquetasDoCard = async (cardId: number): Promise<TrelloLabel[]> => {
  try {
    console.log('[DEBUG] Buscando etiquetas do card:', cardId);
    
    const { data, error } = await supabase
      .from('trello_card_labels')
      .select(`
        label_id,
        trello_labels (
          id,
          title,
          color,
          created_at
        )
      `)
      .eq('card_id', cardId);

    if (error) {
      console.error('[DEBUG] Erro ao buscar etiquetas do card:', error);
      throw error;
    }

    // Usar um Map para garantir unicidade das etiquetas por ID
    const labelsMap = new Map();
    data?.forEach(relation => {
      if (relation.trello_labels) {
        labelsMap.set(relation.trello_labels.id, relation.trello_labels);
      }
    });
    
    // Converter o Map de volta para array
    const labels = Array.from(labelsMap.values());
    console.log('[DEBUG] Etiquetas encontradas para o card (após remoção de duplicatas):', labels);
    
    return labels;
  } catch (error) {
    console.error('[DEBUG] Erro ao buscar etiquetas do card:', error);
    throw error;
  }
};

// Função para adicionar uma etiqueta a um card
export const adicionarEtiqueta = async (
  cardId: number,
  labelId: number
): Promise<void> => {
  try {
    console.log('[DEBUG] Iniciando adição de etiqueta:', { cardId, labelId });
    
    // Validar parâmetros
    if (!cardId || !labelId) {
      console.error('[DEBUG] cardId ou labelId inválidos:', { cardId, labelId });
      throw new Error('cardId e labelId são obrigatórios');
    }

    // 1. Verificar se o card existe
    const { data: card, error: cardError } = await supabase
      .from('trello_cards')
      .select('id')
      .eq('id', cardId)
      .single();
    
    if (cardError) {
      console.error('[DEBUG] Erro ao verificar card:', cardError);
      throw cardError;
    }

    if (!card) {
      console.error('[DEBUG] Card não encontrado:', cardId);
      throw new Error(`Card ${cardId} não encontrado`);
    }

    // 2. Verificar se a etiqueta existe
    const { data: label, error: labelError } = await supabase
      .from('trello_labels')
      .select('*')
      .eq('id', labelId)
      .single();
    
    if (labelError) {
      console.error('[DEBUG] Erro ao verificar etiqueta:', labelError);
      throw labelError;
    }

    if (!label) {
      console.error('[DEBUG] Etiqueta não encontrada:', labelId);
      throw new Error(`Etiqueta ${labelId} não encontrada`);
    }

    console.log('[DEBUG] Card e etiqueta verificados com sucesso');
    
    // 3. Verificar se a relação já existe
    const { data: existingLabel, error: checkError } = await supabase
      .from('trello_card_labels')
      .select('*')
      .eq('card_id', cardId)
      .eq('label_id', labelId)
      .maybeSingle();
    
    if (checkError) {
      console.error('[DEBUG] Erro ao verificar relação existente:', checkError);
      throw checkError;
    }
    
    if (existingLabel) {
      console.log('[DEBUG] Relação já existe, não é necessário criar novamente');
      return;
    }

    // 4. Criar a relação entre card e etiqueta
    const { error: insertError } = await supabase
      .from('trello_card_labels')
      .insert({
        card_id: cardId,
        label_id: labelId,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[DEBUG] Erro ao criar relação:', insertError);
      console.error('[DEBUG] Detalhes:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details
      });
      throw insertError;
    }

    // 5. Atualizar o timestamp do card
    const { error: updateError } = await supabase
      .from('trello_cards')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);
      
    if (updateError) {
      console.error('[DEBUG] Erro ao atualizar timestamp do card:', updateError);
      // Não lançar erro aqui, pois a etiqueta já foi adicionada
    }
    
    console.log('[DEBUG] Etiqueta adicionada com sucesso:', {
      cardId,
      labelId,
      label: label.title
    });
  } catch (error) {
    console.error('[DEBUG] Erro ao adicionar etiqueta:', error);
    throw error;
  }
};

// Função para remover uma etiqueta de um card
export const removerEtiqueta = async (
  cardId: number,
  labelId: number
): Promise<void> => {
  try {
    console.log('[DEBUG] Iniciando remoção de etiqueta:', { cardId, labelId });
    
    // Validar parâmetros
    if (!cardId || !labelId) {
      console.error('[DEBUG] cardId ou labelId inválidos:', { cardId, labelId });
      throw new Error('cardId e labelId são obrigatórios');
    }

    // 1. Verificar se a relação existe
    const { data: existingLabel, error: checkError } = await supabase
      .from('trello_card_labels')
      .select('*')
      .eq('card_id', cardId)
      .eq('label_id', labelId)
      .maybeSingle();
    
    if (checkError) {
      console.error('[DEBUG] Erro ao verificar relação:', checkError);
      throw checkError;
    }

    if (!existingLabel) {
      console.log('[DEBUG] Relação não encontrada, nada a fazer');
      return;
    }

    // 2. Remover a relação
    const { error: deleteError } = await supabase
      .from('trello_card_labels')
      .delete()
      .eq('card_id', cardId)
      .eq('label_id', labelId);

    if (deleteError) {
      console.error('[DEBUG] Erro ao remover relação:', deleteError);
      console.error('[DEBUG] Detalhes:', {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details
      });
      throw deleteError;
    }

    // 3. Atualizar o timestamp do card
    const { error: updateError } = await supabase
      .from('trello_cards')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);
      
    if (updateError) {
      console.error('[DEBUG] Erro ao atualizar timestamp do card:', updateError);
      // Não lançar erro aqui, pois a etiqueta já foi removida
    }
    
    console.log('[DEBUG] Etiqueta removida com sucesso:', { cardId, labelId });
  } catch (error) {
    console.error('[DEBUG] Erro ao remover etiqueta:', error);
    throw error;
  }
};

// Função para criar uma nova lista
export const criarLista = async (
  obraId: number,
  title: string
): Promise<TrelloListType & { cards: TrelloCardType[] }> => {
  try {
    console.log('[DEBUG] Criando lista para obra:', obraId, 'com título:', title);
    
    // Validar ID da obra
    if (!obraId || isNaN(obraId)) {
      console.error('[DEBUG] ID de obra inválido:', obraId);
      throw new Error(`ID da obra inválido: ${obraId}`);
    }
    
    // Obter o board_id para esta obra
    const boardId = await obterOuCriarBoard(obraId);
    console.log('[DEBUG] Board ID obtido:', boardId);
    
    // Buscar a última posição para ordenar a nova lista
    let position = 0;
    try {
      const { data: lastList, error: positionError } = await supabase
        .from('trello_lists')
        .select('position')
        .eq('board_id', boardId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      if (!positionError && lastList && lastList.position !== undefined) {
        position = lastList.position + 1;
        console.log('[DEBUG] Posição baseada na última lista:', position);
      } else {
        console.log('[DEBUG] Usando posição padrão (0) para nova lista');
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar última posição:', error);
      console.log('[DEBUG] Continuando com position = 0');
      // Continuar com position = 0 se houver erro
    }
    
    // Gerar ID único para a lista
    const listId = `list_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log('[DEBUG] ID gerado para nova lista:', listId);
    
    // Dados da nova lista
    const listData = {
      board_id: boardId,
      list_id: listId,
      nome: title,
      position: position
    };
    console.log('[DEBUG] Dados da nova lista:', listData);
    
    // Criar nova lista
    const { data, error } = await supabase
      .from('trello_lists')
      .insert([listData])
      .select()
      .single();

    if (error) {
      console.error('[DEBUG] Erro ao criar lista:', error);
      console.error('[DEBUG] Código:', error.code);
      console.error('[DEBUG] Mensagem:', error.message);
      console.error('[DEBUG] Detalhes:', error.details);
      throw new Error(`Falha ao criar lista: ${error.message}`);
    }

    if (!data) {
      console.error('[DEBUG] Nenhum dado retornado após criar lista');
      throw new Error('Lista não foi criada: nenhum dado retornado');
    }
    
    console.log('[DEBUG] Lista criada com sucesso:', data);

    return {
      ...data,
      title: data.nome, // Para compatibilidade com a interface TrelloList
      cards: []
    };
  } catch (error) {
    console.error('[DEBUG] Erro ao criar lista:', error);
    if (error instanceof Error) {
      console.error('[DEBUG] Mensagem de erro:', error.message);
    }
    throw error;
  }
};

// Função para excluir uma lista
export const excluirLista = async (listId: number): Promise<void> => {
  try {
    console.log('[DEBUG] Iniciando exclusão da lista ID:', listId);
    
    // Primeiro, excluir todos os cards da lista
    const { data: cards, error: cardsError } = await supabase
      .from('trello_cards')
      .select('id')
      .eq('list_id', listId);
    
    if (cardsError) {
      console.error('[DEBUG] Erro ao buscar cards da lista:', cardsError);
      throw cardsError;
    }
    
    console.log(`[DEBUG] Encontrados ${cards?.length || 0} cards para excluir`);
    
    if (cards && cards.length > 0) {
      // Excluir todos os cards da lista
      console.log('[DEBUG] Excluindo cards da lista...');
      for (const card of cards) {
        console.log('[DEBUG] Excluindo card ID:', card.id);
        await excluirCard(card.id);
      }
      console.log('[DEBUG] Todos os cards foram excluídos');
    }

    // Excluir a lista
    console.log('[DEBUG] Excluindo a lista ID:', listId);
    const { error } = await supabase
      .from('trello_lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('[DEBUG] Erro ao excluir lista:', error);
      throw error;
    }
    
    console.log('[DEBUG] Lista excluída com sucesso');
  } catch (error) {
    console.error('[DEBUG] Erro ao excluir lista:', error);
    throw error;
  }
};

// Função para renomear uma lista
export const renomearLista = async (
  listId: number,
  newTitle: string
): Promise<void> => {
  try {
    console.log('[DEBUG] Renomeando lista:', { listId, newTitle });
    
    // Verificar se a lista existe antes de tentar renomear
    const { data: lista, error: checkError } = await supabase
      .from('trello_lists')
      .select('*')
      .eq('id', listId)
      .single();
      
    if (checkError) {
      console.error('[DEBUG] Erro ao verificar lista:', checkError);
      throw checkError;
    }
    
    if (!lista) {
      console.error('[DEBUG] Lista não encontrada com ID:', listId);
      throw new Error(`Lista com ID ${listId} não encontrada`);
    }
    
    console.log('[DEBUG] Lista encontrada:', lista);
    
    // Atualizar apenas o campo 'nome' que existe no banco de dados
    const { data, error } = await supabase
      .from('trello_lists')
      .update({
        nome: newTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .select();

    if (error) {
      console.error('[DEBUG] Erro ao renomear lista:', error);
      throw error;
    }
    
    console.log('[DEBUG] Lista renomeada com sucesso:', data);
  } catch (error) {
    console.error('[DEBUG] Erro detalhado ao renomear lista:', error);
    throw error;
  }
};

// Função para atualizar a posição de um card
export const atualizarPosicaoCard = async (
  cardId: number,
  novaListaId: number,
  novaPosicao: number
): Promise<void> => {
  try {
    console.log('[DEBUG] Atualizando posição do card:', { cardId, novaListaId, novaPosicao });

    // Verificar se o card existe 
    const { data: cardExistente, error: cardExistenteError } = await supabase
      .from('trello_cards')
      .select('id, list_id, position')
      .eq('id', cardId)
      .single();
      
    if (cardExistenteError) {
      console.error('[DEBUG] Erro ao verificar existência do card:', cardExistenteError);
      throw cardExistenteError;
    }
    
    if (!cardExistente) {
      console.error('[DEBUG] Card não encontrado com id:', cardId);
      throw new Error(`Card com ID ${cardId} não encontrado`);
    }
    
    console.log('[DEBUG] Card encontrado:', cardExistente);
    console.log('[DEBUG] Atualizando para nova posição:', novaPosicao);
    
    // Verificar se a lista de destino existe
    const { data: listaExistente, error: listaExistenteError } = await supabase
      .from('trello_lists')
      .select('id')
      .eq('id', novaListaId)
      .single();
      
    if (listaExistenteError && listaExistenteError.code !== 'PGRST116') {
      console.error('[DEBUG] Erro ao verificar existência da lista:', listaExistenteError);
      throw listaExistenteError;
    }
    
    if (!listaExistente) {
      console.error('[DEBUG] Lista de destino não encontrada com id:', novaListaId);
      throw new Error(`Lista com ID ${novaListaId} não encontrada`);
    }
    
    // Atualizar posição do card
    const { error } = await supabase
      .from('trello_cards')
      .update({
        list_id: novaListaId,
        position: novaPosicao,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    if (error) {
      console.error('[DEBUG] Erro ao atualizar posição do card:', error);
      throw error;
    }
    
    console.log('[DEBUG] Posição do card atualizada com sucesso para:', novaPosicao);
  } catch (error) {
    console.error('[DEBUG] Erro ao atualizar posição do card:', error);
    // Rethrow para tratamento adequado no front-end
    throw error;
  }
}; 