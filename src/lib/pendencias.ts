import { supabase } from './supabase';

// Tipos para pendências
export interface Pendencia {
  id: number;
  obra_id: number;
  titulo: string;
  descricao: string | null;
  status: 'pendente' | 'em_andamento' | 'concluida';
  prioridade: 'baixa' | 'media' | 'alta';
  data_criacao: string;
  data_atualizacao: string;
  data_conclusao: string | null;
  responsavel: string | null;
}

export interface SecaoPendencias {
  id: string;
  titulo: string;
  pendencias: Pendencia[];
}

// Função para listar todas as pendências de uma obra
export const listarPendencias = async (obraId: number): Promise<Pendencia[]> => {
  try {
    const { data, error } = await supabase
      .from('pendencias')
      .select('*')
      .eq('obra_id', obraId)
      .order('data_criacao', { ascending: false });
    
    if (error) {
      console.error('Erro ao listar pendências:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro ao listar pendências:', error);
    throw error;
  }
};

// Função para criar uma nova pendência
export const criarPendencia = async (pendencia: Omit<Pendencia, 'id' | 'data_criacao' | 'data_atualizacao'>): Promise<Pendencia> => {
  try {
    const { data, error } = await supabase
      .from('pendencias')
      .insert([{
        ...pendencia,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar pendência:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao criar pendência:', error);
    throw error;
  }
};

// Função para atualizar uma pendência
export const atualizarPendencia = async (id: number, updates: Partial<Pendencia>): Promise<Pendencia> => {
  try {
    const { data, error } = await supabase
      .from('pendencias')
      .update({
        ...updates,
        data_atualizacao: new Date().toISOString(),
        ...(updates.status === 'concluida' ? { data_conclusao: new Date().toISOString() } : {})
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar pendência:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao atualizar pendência:', error);
    throw error;
  }
};

// Função para excluir uma pendência
export const excluirPendencia = async (id: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pendencias')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao excluir pendência:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao excluir pendência:', error);
    throw error;
  }
};

// Função para obter pendências agrupadas por status
export const obterPendenciasAgrupadas = async (obraId: number): Promise<SecaoPendencias[]> => {
  try {
    const pendencias = await listarPendencias(obraId);
    
    // Agrupar pendências por status
    const pendentesSection: SecaoPendencias = {
      id: 'pendentes',
      titulo: 'A Fazer',
      pendencias: pendencias.filter(p => p.status === 'pendente')
    };
    
    const emAndamentoSection: SecaoPendencias = {
      id: 'em_andamento',
      titulo: 'Em Andamento',
      pendencias: pendencias.filter(p => p.status === 'em_andamento')
    };
    
    const concluidasSection: SecaoPendencias = {
      id: 'concluidas',
      titulo: 'Concluído',
      pendencias: pendencias.filter(p => p.status === 'concluida')
    };
    
    return [pendentesSection, emAndamentoSection, concluidasSection];
  } catch (error) {
    console.error('Erro ao obter pendências agrupadas:', error);
    throw error;
  }
}; 