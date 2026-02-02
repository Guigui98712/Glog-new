import { supabase } from './supabase';
import type { Database } from '@/types/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RegistroDiario } from '@/types/obra';
import { createClient } from '@supabase/supabase-js';
import { differenceInDays } from 'date-fns';
import { obterQuadroObra } from './trello-local';
import heic2any from 'heic2any';

const DISABLE_GOOGLE_APIS = false; // Garantir que as APIs estejam habilitadas para permitir a listagem de obras

export type Obra = Database['public']['Tables']['obras']['Row'];
export type NovaObra = Database['public']['Tables']['obras']['Insert'];
// Tipo personalizado sem o campo data_previsao_fim
export type ObraParaEnvio = Omit<NovaObra, 'data_previsao_fim'> & { data_previsao_fim?: string | null };
export type Etapa = Database['public']['Tables']['etapas']['Row'];
type NovaEtapa = Database['public']['Tables']['etapas']['Insert'];
type Orcamento = Database['public']['Tables']['orcamentos']['Row'];
type NovoOrcamento = Database['public']['Tables']['orcamentos']['Insert'];

// Funções para Obras
export const listarObras = async () => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    // Obter o usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    console.log('[DEBUG] Listando obras para o usuário:', userId);
    
    let query = supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Se estiver autenticado, filtrar por user_id
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar obras:', error);
    throw error;
  }
};

export const buscarObra = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    // Buscar na tabela obras (dono)
    let { data, error } = await supabase
      .from('obras')
      .select('*')
      .eq('id', id)
      .single();

    if (data) return data;

    // Se não encontrou, buscar na view obras_compartilhadas (compartilhada)
    const { data: userData, error: sessionError } = await supabase.auth.getSession();
    const userId = userData?.session?.user?.id;
    const userEmail = userData?.session?.user?.email;

    let query = supabase
      .from('obras_compartilhadas')
      .select('*')
      .eq('obra_id', id)
      .order('criado_em', { ascending: false });

    if (userId && userEmail) {
      query = query.or(`colaborador_id.eq.${userId},colaborador_email.eq.${userEmail}`);
    } else if (userId) {
      query = query.eq('colaborador_id', userId);
    } else if (userEmail) {
      query = query.eq('colaborador_email', userEmail);
    }

    const { data: compartilhada, error: compartilhadaError } = await query.single();
    if (compartilhada) return compartilhada;

    if (error) throw error;
    if (compartilhadaError) throw compartilhadaError;
    return null;
  } catch (error) {
    console.error('Erro ao buscar obra:', error);
    throw error;
  }
};

export const criarObra = async (obra: ObraParaEnvio) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    // Obter o usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    
    console.log('[DEBUG] Criando obra para o usuário:', userId);
    
    // Adicionar o user_id à obra
    const obraComUserId = {
      ...obra,
      user_id: userId
    };
    
    const { data, error } = await supabase
      .from('obras')
      .insert([obraComUserId])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar obra:', error);
    throw error;
  }
};

export const atualizarObra = async (id: number, obra: Partial<Obra>) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('obras')
      .update(obra)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar obra:', error);
    throw error;
  }
};

export const excluirObra = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { error } = await supabase
      .from('obras')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao excluir obra:', error);
    throw error;
  }
};

/**
 * Exclui uma obra e todos os seus registros relacionados de forma segura
 * @param id ID da obra a ser excluída
 */
export const excluirObraSegura = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    console.log('[DEBUG] Iniciando exclusão segura da obra:', id);
    
    // Primeiro, excluímos todos os registros do diário de obra
    console.log('[DEBUG] Excluindo registros do diário de obra...');
    const { error: diarioError } = await supabase
      .from('diario_obra')
      .delete()
      .eq('obra_id', id);
    
    if (diarioError) {
      console.error('[DEBUG] Erro ao excluir registros do diário:', diarioError);
      throw diarioError;
    }
    
    // Excluir orçamentos relacionados
    console.log('[DEBUG] Excluindo orçamentos...');
    const { error: orcamentosError } = await supabase
      .from('orcamentos')
      .delete()
      .eq('obra_id', id);
    
    if (orcamentosError) {
      console.error('[DEBUG] Erro ao excluir orçamentos:', orcamentosError);
      throw orcamentosError;
    }
    
    // Excluir etapas relacionadas
    console.log('[DEBUG] Excluindo etapas...');
    const { error: etapasError } = await supabase
      .from('etapas')
      .delete()
      .eq('obra_id', id);
    
    if (etapasError) {
      console.error('[DEBUG] Erro ao excluir etapas:', etapasError);
      throw etapasError;
    }
    
    // Excluir relatórios relacionados
    console.log('[DEBUG] Excluindo relatórios...');
    const { error: relatoriosError } = await supabase
      .from('relatorios')
      .delete()
      .eq('obra_id', id);
    
    if (relatoriosError) {
      console.error('[DEBUG] Erro ao excluir relatórios:', relatoriosError);
      throw relatoriosError;
    }

    // Primeiro, precisamos obter o ID do quadro do Trello associado a esta obra
    console.log('[DEBUG] Buscando quadro do Trello associado à obra...');
    const { data: trelloBoard, error: trelloBoardFetchError } = await supabase
      .from('trello_boards')
      .select('id')
      .eq('obra_id', id)
      .single();
    
    if (trelloBoardFetchError && trelloBoardFetchError.code !== 'PGRST116') {
      console.error('[DEBUG] Erro ao buscar quadro do Trello:', trelloBoardFetchError);
      throw trelloBoardFetchError;
    }
    
    // Se encontramos um quadro do Trello, excluímos suas listas
    if (trelloBoard) {
      console.log('[DEBUG] Excluindo listas do Trello para o quadro:', trelloBoard.id);
      
      // Primeiro, obter todas as listas do quadro
      const { data: trelloLists, error: trelloListsFetchError } = await supabase
        .from('trello_lists')
        .select('id')
        .eq('board_id', trelloBoard.id);
      
      if (trelloListsFetchError) {
        console.error('[DEBUG] Erro ao buscar listas do Trello:', trelloListsFetchError);
        throw trelloListsFetchError;
      }
      
      // Para cada lista, excluir os cartões associados e seus relacionamentos
      if (trelloLists && trelloLists.length > 0) {
        console.log('[DEBUG] Excluindo cartões do Trello e relacionamentos para as listas encontradas...');
        
        for (const list of trelloLists) {
          // Obter todos os cartões da lista
          const { data: trelloCards, error: trelloCardsFetchError } = await supabase
            .from('trello_cards')
            .select('id')
            .eq('list_id', list.id);
          
          if (trelloCardsFetchError) {
            console.error('[DEBUG] Erro ao buscar cartões do Trello para a lista:', list.id, trelloCardsFetchError);
            throw trelloCardsFetchError;
          }
          
          // Para cada cartão, excluir seus relacionamentos
          if (trelloCards && trelloCards.length > 0) {
            for (const card of trelloCards) {
              // Excluir checklists e seus itens
              const { data: checklists, error: checklistsFetchError } = await supabase
                .from('trello_checklists')
                .select('id')
                .eq('card_id', card.id);
              
              if (checklistsFetchError) {
                console.error('[DEBUG] Erro ao buscar checklists para o cartão:', card.id, checklistsFetchError);
                throw checklistsFetchError;
              }
              
              if (checklists && checklists.length > 0) {
                for (const checklist of checklists) {
                  // Excluir itens do checklist
                  const { error: checklistItemsError } = await supabase
                    .from('trello_checklist_items')
                    .delete()
                    .eq('checklist_id', checklist.id);
                  
                  if (checklistItemsError) {
                    console.error('[DEBUG] Erro ao excluir itens do checklist:', checklist.id, checklistItemsError);
                    throw checklistItemsError;
                  }
                }
                
                // Excluir checklists
                const { error: checklistsError } = await supabase
                  .from('trello_checklists')
                  .delete()
                  .eq('card_id', card.id);
                
                if (checklistsError) {
                  console.error('[DEBUG] Erro ao excluir checklists para o cartão:', card.id, checklistsError);
                  throw checklistsError;
                }
              }
              
              // Excluir comentários
              const { error: commentsError } = await supabase
                .from('trello_comments')
                .delete()
                .eq('card_id', card.id);
              
              if (commentsError) {
                console.error('[DEBUG] Erro ao excluir comentários para o cartão:', card.id, commentsError);
                throw commentsError;
              }
              
              // Excluir anexos
              const { error: attachmentsError } = await supabase
                .from('trello_attachments')
                .delete()
                .eq('card_id', card.id);
              
              if (attachmentsError) {
                console.error('[DEBUG] Erro ao excluir anexos para o cartão:', card.id, attachmentsError);
                throw attachmentsError;
              }
              
              // Excluir associações de etiquetas
              const { error: cardLabelsError } = await supabase
                .from('trello_card_labels')
                .delete()
                .eq('card_id', card.id);
              
              if (cardLabelsError) {
                console.error('[DEBUG] Erro ao excluir associações de etiquetas para o cartão:', card.id, cardLabelsError);
                throw cardLabelsError;
              }
            }
            
            // Excluir os cartões
            const { error: trelloCardsError } = await supabase
              .from('trello_cards')
              .delete()
              .eq('list_id', list.id);
            
            if (trelloCardsError) {
              console.error('[DEBUG] Erro ao excluir cartões do Trello para a lista:', list.id, trelloCardsError);
              throw trelloCardsError;
            }
          }
        }
        
        // Agora excluir as listas
        const { error: trelloListsError } = await supabase
          .from('trello_lists')
          .delete()
          .eq('board_id', trelloBoard.id);
        
        if (trelloListsError) {
          console.error('[DEBUG] Erro ao excluir listas do Trello:', trelloListsError);
          throw trelloListsError;
        }
      }
    } else {
      console.log('[DEBUG] Nenhum quadro do Trello encontrado para esta obra');
    }

    // Depois, excluir os quadros do Trello relacionados
    console.log('[DEBUG] Excluindo quadros do Trello...');
    const { error: trelloBoardsError } = await supabase
      .from('trello_boards')
      .delete()
      .eq('obra_id', id);
    
    if (trelloBoardsError) {
      console.error('[DEBUG] Erro ao excluir quadros do Trello:', trelloBoardsError);
      throw trelloBoardsError;
    }
    
    // Finalmente, excluir a obra
    console.log('[DEBUG] Excluindo a obra...');
    const { error: obraError } = await supabase
      .from('obras')
      .delete()
      .eq('id', id);
    
    if (obraError) {
      console.error('[DEBUG] Erro ao excluir obra:', obraError);
      throw obraError;
    }
    
    console.log('[DEBUG] Obra excluída com sucesso!');
  } catch (error) {
    console.error('Erro ao excluir obra de forma segura:', error);
    throw error;
  }
};

// Funções para Etapas
export const listarEtapas = async (obraId: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .eq('obra_id', obraId)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar etapas:', error);
    throw error;
  }
};

export const criarEtapa = async (etapa: Partial<Etapa>) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('etapas')
      .insert([etapa])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar etapa:', error);
    throw error;
  }
};

export const atualizarEtapa = async (id: number, etapa: Partial<Etapa>) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('etapas')
      .update(etapa)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar etapa:', error);
    throw error;
  }
};

// Função para upload de fotos
export const uploadFoto = async (file: File): Promise<string> => {
  try {
    console.log('[DEBUG] Iniciando upload de foto:', {
      nome: file.name,
      tipo: file.type,
      tamanho: file.size
    });

    // Validar se é uma imagem
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(heic|heif)$/)) {
      throw new Error('O arquivo deve ser uma imagem');
    }

    let fileToUpload = file;
    
    // Verificar se é uma imagem HEIC/HEIF
    const isHeic = file.type === 'image/heic' || 
                   file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
      console.log('[DEBUG] Detectada imagem HEIC/HEIF, convertendo para JPEG...');
      
      try {
        // Converter HEIC para JPEG usando heic2any
        const blob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9
        });

        // Criar um novo arquivo com o mesmo nome mas extensão .jpg
        const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        fileToUpload = new File([blob as Blob], fileName, { type: 'image/jpeg' });
        
        console.log('[DEBUG] Conversão HEIC para JPEG concluída:', {
          nomeOriginal: file.name,
          nomeConvertido: fileName,
          tamanhoOriginal: file.size,
          tamanhoConvertido: fileToUpload.size
        });
      } catch (error) {
        // Verificar se o erro é o específico da heic2any para arquivos já legíveis
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 1) {
          console.warn('[DEBUG] Conversão HEIC pulada: heic2any detectou arquivo já legível (provavelmente JPEG).');
          // O navegador provavelmente já converteu para JPEG, mas vamos garantir que o nome e o tipo estejam corretos para o upload.
          const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpeg'); // Renomear para .jpeg
          fileToUpload = new File([file], fileName, { type: 'image/jpeg' }); // Criar novo File com tipo JPEG
          console.log('[DEBUG] Arquivo ajustado para upload como JPEG:', {
            nome: fileToUpload.name,
            tipo: fileToUpload.type,
            tamanho: fileToUpload.size
          });
        } else {
          // Se for qualquer outro erro, logar e lançar a exceção
          console.error('[DEBUG] Erro na conversão HEIC - Mensagem:', error instanceof Error ? error.message : error);
          console.error('[DEBUG] Erro na conversão HEIC - Stack:', error instanceof Error ? error.stack : 'N/A');
          console.error('[DEBUG] Erro na conversão HEIC - Objeto Completo:', error);
          throw new Error('Não foi possível converter a imagem HEIC. Por favor, tente converter para JPEG antes de enviar.');
        }
      }
    }

    // Verificar tamanho do arquivo (máximo 10MB)
    if (fileToUpload.size > 10 * 1024 * 1024) {
      throw new Error('O arquivo é muito grande. O tamanho máximo permitido é 10MB.');
    }

    // Gerar nome único para o arquivo
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;

    console.log('[DEBUG] Fazendo upload do arquivo:', {
      nomeFinal: fileName,
      tipo: fileToUpload.type,
      tamanho: fileToUpload.size
    });

    const { data, error } = await supabase.storage
      .from('fotos')
      .upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[ERROR] Erro no upload:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('fotos')
      .getPublicUrl(fileName);

    console.log('[DEBUG] Upload concluído com sucesso:', {
      url: publicUrl
    });

    return publicUrl;
  } catch (error) {
    console.error('[ERROR] Erro ao fazer upload da foto:', error);
    throw error;
  }
};

// Funções para Registros Diários
export const listarRegistrosDiario = async (obraId: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('diario_obra')
      .select('*')
      .eq('obra_id', obraId)
      .order('data', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar registros diários:', error);
    throw error;
  }
};

export const salvarRegistroDiario = async (registro: Partial<RegistroDiario>) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    console.log('[API] Tentando salvar registro diário:', JSON.stringify(registro, null, 2));
    
    // Verificar se os campos obrigatórios estão presentes
    if (!registro.obra_id) {
      throw new Error('Campo obra_id é obrigatório');
    }
    if (!registro.data) {
      throw new Error('Campo data é obrigatório');
    }
    if (!registro.descricao) {
      throw new Error('Campo descricao é obrigatório');
    }
    
    // Criar um objeto com apenas os campos básicos garantidos
    const registroBasico = {
      obra_id: registro.obra_id,
      data: registro.data,
      descricao: registro.descricao,
      observacoes: registro.observacoes || null
    };
    
    try {
      // Primeiro, tentar inserir com todos os campos
      const { data, error } = await supabase
        .from('diario_obra')
        .insert([registro])
        .select()
        .single();

      if (error) {
        console.error('[API] Erro do Supabase ao salvar registro diário completo:', error);
        
        // Se falhar, tentar inserir apenas com os campos básicos
        console.log('[API] Tentando salvar apenas campos básicos:', registroBasico);
        const { data: dataBasico, error: errorBasico } = await supabase
          .from('diario_obra')
          .insert([registroBasico])
          .select()
          .single();
          
        if (errorBasico) {
          console.error('[API] Erro do Supabase ao salvar registro básico:', errorBasico);
          throw errorBasico;
        }
        
        console.log('[API] Registro diário básico salvo com sucesso:', dataBasico);
        return dataBasico;
      }
      
      console.log('[API] Registro diário completo salvo com sucesso:', data);
      return data;
    } catch (error) {
      console.error('[API] Erro do Supabase ao salvar registro diário:', error);
      throw error;
    }
  } catch (error) {
    console.error('[API] Erro ao salvar registro diário:', error);
    throw error;
  }
};

export const atualizarRegistroDiario = async (id: number, registro: Partial<RegistroDiario>) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { data, error } = await supabase
      .from('diario_obra')
      .update(registro)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar registro diário:', error);
    throw error;
  }
};

export const excluirRegistroDiario = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { error } = await supabase
      .from('diario_obra')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao excluir registro diário:', error);
    throw error;
  }
};

// Função para gerar relatório semanal
export const gerarRelatorioSemanal = async (obraId: number, dataInicio: string, dataFim: string, presencas: any[] = []) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  // Versão atualizada: inclui atividades, pendências e etapas em andamento
  console.log('[DEBUG] Iniciando geração de relatório semanal (versão atualizada)...');
  console.log('[DEBUG] Parâmetros:', { obraId, dataInicio, dataFim, presencas });

  try {
    // Buscar informações da obra
    const { data: obra, error: obraError } = await supabase
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .single();

    if (obraError) {
      console.error('[DEBUG] Erro ao buscar obra:', obraError);
      throw new Error('Não foi possível encontrar a obra');
    }

    if (!obra) {
      console.error('[DEBUG] Obra não encontrada');
      throw new Error('Obra não encontrada');
    }

    // Buscar o primeiro registro do diário
    const { data: primeiroRegistro, error: erroRegistro } = await supabase
      .from('diario_obra')
      .select('data')
      .eq('obra_id', obraId)
      .order('data', { ascending: true })
      .limit(1)
      .single();

    // Buscar registros do período
    const { data: registros = [], error: registrosError } = await supabase
      .from('diario_obra')
      .select('*')
      .eq('obra_id', obraId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: true });

    if (registrosError) {
      console.error('[DEBUG] Erro ao buscar registros:', registrosError);
    }

    console.log('[DEBUG] Registros encontrados:', registros.length);
    console.log('[DEBUG] Registros:', registros);

    // Buscar pendências da obra (quadro Trello)
    let pendencias = { lists: [] };
    try {
      pendencias = await obterQuadroObra(obraId);
      console.log('[DEBUG] Pendências encontradas:', pendencias);
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar pendências:', error);
    }

    // Buscar etapas em andamento
    const etapasEmAndamento = [];
    const etapasConcluidas = [];
    const etapasInfo = new Map();

    try {
      // Buscar todos os registros do diário para análise de etapas
      const { data: todosRegistros = [] } = await supabase
        .from('diario_obra')
        .select('data, etapas_iniciadas, etapas_concluidas')
        .eq('obra_id', obraId)
        .order('data', { ascending: true });

      // Processar etapas iniciadas e concluídas
      todosRegistros.forEach(registro => {
        const data = registro.data;
        
        // Registrar etapas iniciadas
        registro.etapas_iniciadas?.forEach(etapa => {
          if (!etapasInfo.has(etapa)) {
            etapasInfo.set(etapa, {
              nome: etapa,
              data_inicio: data,
              status: 'em_andamento'
            });
          }
        });
        
        // Registrar etapas concluídas
        registro.etapas_concluidas?.forEach(etapa => {
          const info = etapasInfo.get(etapa);
          if (info) {
            info.data_fim = data;
            info.status = 'concluida';
          }
        });
      });

      // Separar etapas em andamento e concluídas
      etapasInfo.forEach(info => {
        if (info.status === 'em_andamento') {
          etapasEmAndamento.push(info);
        } else {
          etapasConcluidas.push(info);
        }
      });

      console.log('[DEBUG] Etapas em andamento:', etapasEmAndamento);
      console.log('[DEBUG] Etapas concluídas:', etapasConcluidas);
    } catch (error) {
      console.error('[DEBUG] Erro ao processar etapas:', error);
    }

    // Ajustar as datas
    const dataInicioObj = parseISO(dataInicio);
    const dataFimObj = parseISO(dataFim);

    // Gerar HTML do relatório
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório Semanal - ${obra.nome}</title>
        <style>
          @page {
            margin: 15mm;
            size: A4;
          }
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: white;
            font-size: 11pt;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
          }
          h1, h2, h3 {
            color: #2c3e50;
            font-weight: 600;
            margin: 0;
            padding: 0;
          }
          h1 { font-size: 18pt; }
          h2 { font-size: 16pt; }
          h3 { 
            font-size: 14pt;
            margin-bottom: 8px;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .header p {
            margin: 5px 0 0 0;
          }
          .content {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .info-block {
            margin-bottom: 10px;
            background-color: white;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 12px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .info-card {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            width: 100%;
          }
          .info-item {
            padding: 8px;
            border: 1px solid #eee;
            border-radius: 4px;
          }
          .info-label {
            font-size: 0.9em;
            color: #6c757d;
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-value {
            font-size: 1em;
            font-weight: 500;
          }
          .atividade-item {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }
          .registro-descricao {
            margin: 5px 0;
            font-size: 0.95em;
            line-height: 1.3;
          }
          .foto-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 10px;
          }
          .foto {
            width: 100%;
            height: auto;
            border-radius: 4px;
          }
          @media print {
            body {
              background-color: white;
            }
            .info-block {
              break-inside: avoid;
            }
            .atividade-item {
              break-inside: avoid;
            }
            .foto-container {
              break-inside: avoid;
            }
          }
          .etapa-inicio {
            color: #15803d;
            background-color: #dcfce7;
            padding: 8px 12px;
            margin: 4px 0;
            font-size: 1.1em;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            min-height: 40px;
            line-height: 1.2;
            border-radius: 4px;
            font-weight: 500;
          }
          .etapa-fim {
            color: #9a3412;
            background-color: #ffedd5;
            padding: 8px 12px;
            margin: 4px 0;
            font-size: 1.1em;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            min-height: 40px;
            line-height: 1.2;
            border-radius: 4px;
            font-weight: 500;
          }
          .presenca-table {
            margin-top: 10px;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: table;
            width: 100%;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid #eee;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          th, td {
            border: 1px solid #eee;
            padding: 8px;
            text-align: left;
            font-size: 0.9em;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 0.8em;
            color: #777;
            border-top: 1px solid #eee;
            padding-top: 10px;
            padding-bottom: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .footer p {
            margin: 5px 0;
          }
          .registro-observacoes {
            font-style: italic;
            color: #555;
            background-color: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-bottom: 8px;
          }
          .presente {
            background-color: #d4edda;
            color: #155724;
            text-align: center;
            font-weight: bold;
          }
          .ausente {
            background-color: #f8d7da;
            color: #721c24;
            text-align: center;
            font-weight: bold;
          }
          .meio-periodo {
            background-color: #fff3cd;
            color: #856404;
            text-align: center;
            font-weight: bold;
          }
          .pendencia-item {
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 4px;
            background-color: #f8f9fa;
          }
          .pendencia-titulo {
            font-weight: 600;
            margin-bottom: 4px;
          }
          .pendencia-descricao {
            font-size: 0.9em;
            color: #555;
          }
          .etapa-andamento {
            background-color: #e9f5fe;
            color: #0369a1;
            padding: 8px 12px;
            margin: 4px 0;
            font-size: 1.1em;
            border-radius: 4px;
            font-weight: 500;
          }
          .data-inicio {
            font-size: 0.8em;
            color: #555;
            margin-top: 2px;
          }
          .lista-titulo {
            font-weight: 600;
            color: #333;
            margin-top: 12px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Relatório Semanal de Obra</h1>
            <h2>${obra.nome}</h2>
            <p>Período: ${format(dataInicioObj, 'dd/MM/yyyy')} a ${format(dataFimObj, 'dd/MM/yyyy')}</p>
          </div>

          <div class="content">
            <div class="info-block">
              <div class="info-card">
                <div class="info-item">
                  <div class="info-label">ENDEREÇO</div>
                  <div class="info-value">${obra.endereco || 'Não informado'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">RESPONSÁVEL</div>
                  <div class="info-value">${obra.responsavel || 'Não informado'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">DATA DE INÍCIO</div>
                  <div class="info-value">${primeiroRegistro ? format(parseISO(primeiroRegistro.data), 'dd/MM/yyyy') : 'Não informado'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">PREVISÃO DE TÉRMINO</div>
                  <div class="info-value">${obra.data_previsao_fim ? format(parseISO(obra.data_previsao_fim), 'MM/yyyy') : 'Não informado'}</div>
                </div>
              </div>
            </div>

            <div class="info-block">
              <h3>Atividades Realizadas</h3>
              <div class="atividades-container">
                ${registros.length > 0 ? registros.map((registro) => {
                  const dataFormatada = format(parseISO(registro.data), 'dd/MM/yyyy (EEEE)', { locale: ptBR });
                  const descricaoLinhas = registro.descricao
                    .split('\n')
                    .filter(linha => 
                      !linha.trim().startsWith('Iniciada a etapa:') && 
                      !linha.trim().startsWith('Concluída a etapa:')
                    );
                  
                  return `
                    <div class="atividade-item">
                      <div style="font-weight: 600; color: #0369a1; margin-bottom: 5px;">${dataFormatada}</div>
                      <div class="registro-descricao">
                        ${descricaoLinhas.join('<br>')}
                        
                        ${registro.etapas_iniciadas?.length ? `
                          <div style="margin-top: 8px">
                            ${registro.etapas_iniciadas.map(etapa => 
                              `<div class="etapa-inicio">Etapa iniciada: ${etapa}</div>`
                            ).join('')}
                          </div>
                        ` : ''}
                        
                        ${registro.etapas_concluidas?.length ? `
                          <div style="margin-top: 8px">
                            ${registro.etapas_concluidas.map(etapa => 
                              `<div class="etapa-fim">Etapa concluída: ${etapa}</div>`
                            ).join('')}
                          </div>
                        ` : ''}
                      </div>
                      
                      ${registro.fotos?.length ? `
                        <div class="foto-container">
                          ${registro.fotos.map(foto => 
                            `<img src="${foto}" alt="Foto da atividade" class="foto" onerror="this.style.display='none'">`
                          ).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('') : '<p>Nenhuma atividade registrada para o período.</p>'}
              </div>
            </div>

            <div class="info-block">
              <h3>Etapas em Andamento</h3>
              ${etapasEmAndamento.length > 0 ? `
                <div>
                  ${etapasEmAndamento.map(etapa => `
                    <div class="etapa-andamento">
                      ${etapa.nome}
                      <div class="data-inicio">Iniciada em: ${format(parseISO(etapa.data_inicio), 'dd/MM/yyyy')}</div>
                    </div>
                  `).join('')}
                </div>
              ` : '<p>Nenhuma etapa em andamento no momento.</p>'}
            </div>

            <div class="info-block">
              <h3>Pendências da Obra</h3>
              ${pendencias.lists.length > 0 ? `
                <div>
                  ${pendencias.lists.map(lista => `
                    <div class="lista-titulo">${lista.title}</div>
                    ${lista.cards && lista.cards.length > 0 ? 
                      lista.cards.map(card => `
                        <div class="pendencia-item">
                          <div class="pendencia-titulo">${card.title}</div>
                          ${card.description ? `<div class="pendencia-descricao">${card.description}</div>` : ''}
                        </div>
                      `).join('') : '<p>Nenhuma pendência nesta lista.</p>'
                    }
                  `).join('')}
                </div>
              ` : '<p>Nenhuma pendência registrada para esta obra.</p>'}
            </div>

            <div class="info-block">
              <h3>Observações</h3>
              ${registros
                .filter(registro => registro.observacoes?.trim())
                .map(registro => `
                  <div class="registro-observacoes">
                    ${registro.observacoes.replace(/\n/g, '<br>')}
                  </div>
                `).join('<br>') || '<p>Nenhuma observação registrada para o período.</p>'
              }
            </div>

            ${presencas?.length ? `
              <div class="info-block">
                <h3>Controle de Presença</h3>
                <table class="presenca-table">
                  <tr>
                    <th>Funcionário</th>
                    ${presencas[0].presencas.map((p: any) => {
                      const dataObj = parseISO(p.data);
                      return `<th>${format(dataObj, 'EEE, dd/MM', { locale: ptBR })}</th>`;
                    }).join('')}
                  </tr>
                  ${presencas.map((funcionario: any) => `
                    <tr>
                      <td>${funcionario.nome}</td>
                      ${funcionario.presencas.map((p: any) => {
                        if (p.presente === 1) {
                          return `<td class="presente">✓</td>`;
                        } else if (p.presente === 0.5) {
                          return `<td class="meio-periodo">½</td>`;
                        } else {
                          return `<td class="ausente">✗</td>`;
                        }
                      }).join('')}
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
            <p>${obra.nome} - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  } catch (error) {
    console.error('[DEBUG] Erro ao gerar relatório:', error);
    throw error;
  }
};

// Função para excluir relatório
export const excluirRelatorio = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    const { error } = await supabase
      .from('relatorios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao excluir relatório:', error);
    throw error;
  }
};

// Funções para Orçamentos
export const listarOrcamentos = async (obraId: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  if (!obraId || isNaN(Number(obraId))) {
    console.error('[DEBUG] ID da obra inválido:', obraId);
    throw new Error('ID da obra é obrigatório e deve ser um número válido');
  }

  try {
    console.log('[DEBUG] Listando orçamentos para obra:', obraId);
    
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    console.log('[DEBUG] Orçamentos encontrados:', data?.length || 0);
    return data;
  } catch (error) {
    console.error('[DEBUG] Erro ao listar orçamentos:', error);
    throw error;
  }
};

export const excluirOrcamento = async (id: number) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    console.log('[DEBUG] Excluindo orçamento:', id);
    
    const { error } = await supabase
      .from('orcamentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    console.log('[DEBUG] Orçamento excluído com sucesso');
  } catch (error) {
    console.error('[DEBUG] Erro ao excluir orçamento:', error);
    throw error;
  }
};

export const atualizarTrelloBoardId = async (obraId: number, boardId: string) => {
  if (DISABLE_GOOGLE_APIS) {
    console.warn('APIs do Google desabilitadas temporariamente');
    return { success: false, message: 'APIs do Google desabilitadas' };
  }

  try {
    console.log('Atualizando ID do quadro do Trello:', { obraId, boardId });
    
    const { data, error } = await supabase
      .from('obras')
      .update({ trello_board_id: boardId })
      .eq('id', obraId)
      .select()
      .single();

    if (error) {
      console.error('Erro do Supabase:', error);
      throw error;
    }

    console.log('Atualização bem-sucedida:', data);
    return data;
  } catch (error) {
    console.error('Erro detalhado ao atualizar ID do quadro do Trello:', error);
    throw error;
  }
};

export const listarObrasCompartilhadas = async () => {
  try {
    // Obter o usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    if (!userId && !userEmail) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar obras compartilhadas com o usuário logado (por id ou email)
    let query = supabase
      .from('obras_compartilhadas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (userId && userEmail) {
      query = query.or(`colaborador_id.eq.${userId},colaborador_email.eq.${userEmail}`);
    } else if (userId) {
      query = query.eq('colaborador_id', userId);
    } else if (userEmail) {
      query = query.eq('colaborador_email', userEmail);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar obras compartilhadas:', error);
    throw error;
  }
};

export const compartilharObra = async (obraId: number, colaboradorEmail: string, permissao: string = 'editar') => {
  try {
    // Obter o usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('compartilhamentos')
      .insert([
        {
          obra_id: obraId,
          user_id: userId,
          colaborador_email: colaboradorEmail,
          permissao,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao compartilhar obra:', error);
    throw error;
  }
};

export const listarCompartilhamentosEnviados = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    // Buscar todos os compartilhamentos enviados pelo usuário logado
    const { data, error } = await supabase
      .from('compartilhamentos')
      .select('id, obra_id, colaborador_email, colaborador_id, permissao, criado_em, obras(nome, endereco)')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar compartilhamentos enviados:', error);
    throw error;
  }
};

export const excluirCompartilhamento = async (compartilhamentoId: number) => {
  try {
    const { error } = await supabase
      .from('compartilhamentos')
      .delete()
      .eq('id', compartilhamentoId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao excluir compartilhamento:', error);
    throw error;
  }
};

// -----------------------------
// Funções para Cronogramas
// -----------------------------
export const listarCronogramasObra = async (obraId: number) => {
  try {
    const { data, error } = await supabase
      .from('cronogramas')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    console.log('[API] listarCronogramasObra', obraId, 'count=', (data||[]).length);
    return data;
  } catch (error) {
    console.error('Erro ao listar cronogramas:', error);
    throw error;
  }
};

export const criarCronograma = async (obraId: number, nome: string, data: any, tipo: 'weeks'|'months' = 'weeks') => {
  try {
    console.log('[API] criarCronograma start', { obraId, nome, tipo });

    // Prevent accidental duplicate creations: check for same name+tipo created very recently (last 60s)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    // Try to check using the 'tipo' column (migration may not have run yet). If the typed query errors, fall back to name-only check.
    let existing: any[] | null = null;
    let errCheck: any = null;
    try {
      const q = supabase
        .from('cronogramas')
        .select('*')
        .eq('obra_id', obraId)
        .eq('nome', nome)
        .eq('tipo', tipo)
        .gte('created_at', oneMinuteAgo)
        .order('created_at', { ascending: false });
      const resp = await q;
      existing = resp.data as any[] | null;
      errCheck = resp.error;
    } catch (err) {
      // fallback: try without tipo filter (legacy schema)
      console.warn('[API] criarCronograma: tipo filter failed, retrying without tipo', err);
      const resp2 = await supabase
        .from('cronogramas')
        .select('*')
        .eq('obra_id', obraId)
        .eq('nome', nome)
        .gte('created_at', oneMinuteAgo)
        .order('created_at', { ascending: false });
      existing = resp2.data as any[] | null;
      errCheck = resp2.error;
    }

    if (errCheck) {
      console.warn('[API] criarCronograma: erro ao checar duplicatas', errCheck);
    } else if (existing && existing.length > 0) {
      console.warn('[API] criarCronograma: duplicate prevented - returning existing', { existingId: existing[0].id, tipo });
      return existing[0];
    }

    const record: any = {
      obra_id: obraId,
      nome,
      data,
      tipo
    };

    const { data: res, error } = await supabase
      .from('cronogramas')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    console.log('[API] criarCronograma inserted', res?.id, 'tipo=', res?.tipo);
    return res;
  } catch (error) {
    console.error('Erro ao criar cronograma:', error);
    throw error;
  }
};

export const buscarCronograma = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('cronogramas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao buscar cronograma:', error);
    throw error;
  }
};

export const atualizarCronograma = async (id: string, dataObj: any) => {
  try {
    if (!id) throw new Error('Invalid id for atualizarCronograma');
    console.debug('[API] atualizarCronograma', id);
    const { data, error } = await supabase
      .from('cronogramas')
      .update({ data: dataObj })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar cronograma:', error);
    throw error;
  }
};

export const atualizarCronogramaFull = async (id: string, dataObj: any, nome?: string) => {
  try {
    if (!id) throw new Error('Invalid id for atualizarCronogramaFull');
    console.debug('[API] atualizarCronogramaFull', id, nome);
    const payload: any = { data: dataObj };
    if (nome !== undefined) payload.nome = nome;
    const { data, error } = await supabase
      .from('cronogramas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar cronograma (full):', error);
    throw error;
  }
};

export const atualizarCronogramaNome = async (id: string, nome: string) => {
  try {
    if (!id) throw new Error('Invalid id for atualizarCronogramaNome');
    console.debug('[API] atualizarCronogramaNome', id, nome);
    const { data, error } = await supabase
      .from('cronogramas')
      .update({ nome })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar nome do cronograma:', error);
    throw error;
  }
};

export const excluirCronograma = async (id: string) => {
  try {
    if (!id) throw new Error('Invalid id for excluirCronograma');
    console.log('[API] excluirCronograma', id);
    const { data, error } = await supabase
      .from('cronogramas')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    console.debug('[API] excluirCronograma deleted', data);
    return data;
  } catch (error) {
    console.error('Erro ao excluir cronograma:', error);
    throw error;
  }
};

export const listarEtapasFluxograma = async (obraId: number) => {
  try {
    const { data, error } = await supabase
      .from('etapas_fluxograma')
      .select('nome')
      .eq('obra_id', obraId);
    if (error) throw error;
    return (data || []).map((d: any) => d.nome);
  } catch (error) {
    console.error('Erro ao listar etapas do fluxograma:', error);
    throw error;
  }
};

// ===== Almoxarifado (itens e movimentos) =====
export const listarItens = async (obraId: number) => {
  if (DISABLE_GOOGLE_APIS) return [];
  try {
    const { data, error } = await supabase
      .from('almox_items')
      .select('*')
      .eq('obra_id', obraId)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro listarItens', err);
    throw err;
  }
};

export const searchItems = async (obraId: number, q: string) => {
  if (DISABLE_GOOGLE_APIS) return [];
  try {
    const term = q.trim();
    const { data, error } = await supabase
      .from('almox_items')
      .select('*')
      .ilike('nome', `${term}%`)
      .eq('obra_id', obraId)
      .order('nome', { ascending: true })
      .limit(20);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro searchItems', err);
    throw err;
  }
};

export const getItemById = async (obraId: number, id: number) => {
  if (DISABLE_GOOGLE_APIS) return null;
  try {
    const { data, error } = await supabase
      .from('almox_items')
      .select('*')
      .eq('obra_id', obraId)
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data || null;
  } catch (err) {
    console.error('Erro getItemById', err);
    throw err;
  }
};

export const createItem = async (item: { nome: string; unidade?: string | null; categoria?: string | null; quantidade?: number | null; obra_id?: number | null }) => {
  if (DISABLE_GOOGLE_APIS) return null;
  try {
    const payload = { ...item };
    const { data, error } = await supabase
      .from('almox_items')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro createItem', err);
    throw err;
  }
};

export const registerMovement = async (obraId: number, itemId: number, type: 'entrada' | 'saida', quantidade: number) => {
  if (DISABLE_GOOGLE_APIS) return null;
  try {
    // inserir movimento
    const movimento = {
      obra_id: obraId,
      item_id: itemId,
      tipo: type,
      quantidade: quantidade,
      criado_em: new Date().toISOString()
    } as any;

    const { data: mov, error: movErr } = await supabase
      .from('almox_movements')
      .insert([movimento])
      .select()
      .single();
    if (movErr) throw movErr;

    // atualizar quantidade no item com operação atômica
    const delta = type === 'entrada' ? quantidade : -quantidade;
    const { data: updated, error: updErr } = await supabase.rpc('almox_adjust_item_quantity', { p_item_id: itemId, p_delta: delta });
    if (updErr) {
      // fallback: tentar update simples
      const { data: getItem } = await supabase.from('almox_items').select('quantidade').eq('id', itemId).single();
      const nova = (getItem?.quantidade || 0) + delta;
      const { error: e2 } = await supabase.from('almox_items').update({ quantidade: nova }).eq('id', itemId);
      if (e2) throw e2;
    }

    return mov;
  } catch (err) {
    console.error('Erro registerMovement', err);
    throw err;
  }
};

export const getAlmoxarifadoHistorico = async (obraId: number) => {
  if (DISABLE_GOOGLE_APIS) return [];
  try {
    const { data, error } = await supabase
      .from('almox_movements')
      .select(`
        id,
        tipo,
        quantidade,
        criado_em,
        item_id,
        almox_items(nome)
      `)
      .eq('obra_id', obraId)
      .order('criado_em', { ascending: false });
    
    if (error) throw error;
    
    // Mapear resultado para formato esperado
    return (data || []).map((mov: any) => ({
      id: mov.id,
      tipo: mov.tipo,
      quantidade: mov.quantidade,
      data: mov.criado_em,
      item_nome: mov.almox_items?.nome || 'Item deletado'
    }));
  } catch (err) {
    console.error('Erro getAlmoxarifadoHistorico', err);
    throw err;
  }
};