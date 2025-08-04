import { supabase } from '@/lib/supabase';

export interface ViagemObra {
  id: string;
  obra_id: number;
  data_viagem: string;
  pessoas?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface ViagemDetalhes {
  data_viagem: string;
  pessoas?: string;
}

export interface ContagemMensal {
  mes: string;
  mesNum: number;
  ano: number;
  total: number;
}

export interface Carro {
  id: number;
  nome: string;
  created_at: string;
}

export interface ContagemCarroMensal {
  mes: string;
  mesNum: number;
  ano: number;
  carros: {
    id: number;
    nome: string;
    total: number;
  }[];
}

export class ViagensService {
  
  /**
   * Busca todas as viagens de uma obra específica
   */
  async buscarViagensPorObra(obraId: string): Promise<string[]> {
    try {
      console.log(`[VIAGENS] Buscando viagens para obra: ${obraId}`);
      
      const { data, error } = await supabase
        .from('viagens')
        .select('data')
        .eq('obra_id', parseInt(obraId))
        .order('data', { ascending: true });

      if (error) {
        console.error('[VIAGENS] Erro ao buscar viagens:', error);
        throw new Error(`Erro ao buscar viagens: ${error.message}`);
      }

      const datasViagens = data?.map(v => v.data) || [];
      console.log(`[VIAGENS] Encontradas ${datasViagens.length} viagens`);
      
      return datasViagens;
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao buscar viagens:', error);
      throw error;
    }
  }

  /**
   * Busca viagens com detalhes (incluindo pessoas) de uma obra específica
   */
  async buscarViagensDetalhesPorObra(obraId: string): Promise<ViagemDetalhes[]> {
    try {
      console.log(`[VIAGENS] Buscando detalhes das viagens para obra: ${obraId}`);
      
      const { data, error } = await supabase
        .from('viagens_obra')
        .select('data_viagem, pessoas')
        .eq('obra_id', parseInt(obraId))
        .order('data_viagem', { ascending: true });

      if (error) {
        console.error('[VIAGENS] Erro ao buscar detalhes das viagens:', error);
        throw new Error(`Erro ao buscar detalhes das viagens: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao buscar detalhes das viagens:', error);
      throw error;
    }
  }

  /**
   * Marca um dia como tendo viagem
   */
  async marcarViagem(obraId: string, dataViagem: string, pessoas?: string): Promise<void> {
    try {
      console.log(`[VIAGENS] Marcando viagem - Obra: ${obraId}, Data: ${dataViagem}, Pessoas: ${pessoas}`);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('viagens_obra')
        .insert({
          obra_id: parseInt(obraId),
          data_viagem: dataViagem,
          pessoas: pessoas || null,
          user_id: user.user.id
        });

      if (error) {
        // Se o erro for de duplicata, ignoramos (já existe)
        if (error.code === '23505') {
          console.log('[VIAGENS] Viagem já existe para esta data');
          return;
        }
        console.error('[VIAGENS] Erro ao marcar viagem:', error);
        throw new Error(`Erro ao marcar viagem: ${error.message}`);
      }

      console.log('[VIAGENS] Viagem marcada com sucesso');
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao marcar viagem:', error);
      throw error;
    }
  }

  /**
   * Remove a marcação de viagem de um dia
   */
  async desmarcarViagem(obraId: string, dataViagem: string): Promise<void> {
    try {
      console.log(`[VIAGENS] Desmarcando viagem - Obra: ${obraId}, Data: ${dataViagem}`);
      
      const { error } = await supabase
        .from('viagens')
        .delete()
        .eq('obra_id', parseInt(obraId))
        .eq('data', dataViagem);

      if (error) {
        console.error('[VIAGENS] Erro ao desmarcar viagem:', error);
        throw new Error(`Erro ao desmarcar viagem: ${error.message}`);
      }

      console.log('[VIAGENS] Viagem desmarcada com sucesso');
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao desmarcar viagem:', error);
      throw error;
    }
  }

  /**
   * Verifica se um dia específico tem viagem marcada
   */
  async verificarViagem(obraId: string, dataViagem: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('viagens_obra')
        .select('id')
        .eq('obra_id', parseInt(obraId))
        .eq('data_viagem', dataViagem)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
        console.error('[VIAGENS] Erro ao verificar viagem:', error);
        throw new Error(`Erro ao verificar viagem: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao verificar viagem:', error);
      return false;
    }
  }

  /**
   * Alterna o status de viagem de um dia (marca se não existe, desmarca se existe)
   */
  async alternarViagem(obraId: string, dataViagem: string): Promise<boolean> {
    try {
      const temViagem = await this.verificarViagem(obraId, dataViagem);
      
      if (temViagem) {
        await this.desmarcarViagem(obraId, dataViagem);
        return false;
      } else {
        await this.marcarViagem(obraId, dataViagem);
        return true;
      }
    } catch (error) {
      console.error('[VIAGENS] Erro ao alternar viagem:', error);
      throw error;
    }
  }

  /**
   * Busca detalhes de uma viagem específica
   */
  async buscarDetalhesViagem(obraId: string, dataViagem: string): Promise<ViagemDetalhes | null> {
    try {
      const { data, error } = await supabase
        .from('viagens_obra')
        .select('data_viagem, pessoas')
        .eq('obra_id', parseInt(obraId))
        .eq('data_viagem', dataViagem)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
        console.error('[VIAGENS] Erro ao buscar detalhes da viagem:', error);
        throw new Error(`Erro ao buscar detalhes da viagem: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao buscar detalhes da viagem:', error);
      return null;
    }
  }

  /**
   * Atualiza os detalhes de uma viagem existente
   */
  async atualizarViagem(obraId: string, dataViagem: string, pessoas?: string): Promise<void> {
    try {
      console.log(`[VIAGENS] Atualizando viagem - Obra: ${obraId}, Data: ${dataViagem}, Pessoas: ${pessoas}`);
      
      const { error } = await supabase
        .from('viagens_obra')
        .update({
          pessoas: pessoas || null
        })
        .eq('obra_id', parseInt(obraId))
        .eq('data_viagem', dataViagem);

      if (error) {
        console.error('[VIAGENS] Erro ao atualizar viagem:', error);
        throw new Error(`Erro ao atualizar viagem: ${error.message}`);
      }

      console.log('[VIAGENS] Viagem atualizada com sucesso');
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao atualizar viagem:', error);
      throw error;
    }
  }

  /**
   * Busca contagem simples de viagens por mês
   */
  async buscarContagemMensal(obraId: string): Promise<ContagemMensal[]> {
    try {
      console.log(`[VIAGENS] Buscando contagem mensal simples para obra: ${obraId}`);
      
      const { data, error } = await supabase
        .from('viagens')
        .select('data')
        .eq('obra_id', parseInt(obraId))
        .order('data', { ascending: true });

      if (error) {
        console.error('[VIAGENS] Erro ao buscar viagens:', error);
        throw new Error(`Erro ao buscar viagens: ${error.message}`);
      }

      console.log(`[VIAGENS] Encontradas ${data?.length || 0} viagens para contagem mensal`);

      // Agrupar por mês/ano
      const contagemPorMes: { [key: string]: number } = {};
      
      data?.forEach(viagem => {
        const data = new Date(viagem.data);
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1; // JavaScript months are 0-based
        const chave = `${ano}-${mes.toString().padStart(2, '0')}`;
        
        contagemPorMes[chave] = (contagemPorMes[chave] || 0) + 1;
      });

      // Converter para array de ContagemMensal
      const resultado: ContagemMensal[] = Object.entries(contagemPorMes).map(([chave, total]) => {
        const [ano, mes] = chave.split('-');
        const mesNomes = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        return {
          mes: mesNomes[parseInt(mes) - 1],
          mesNum: parseInt(mes),
          ano: parseInt(ano),
          total
        };
      }).sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mesNum - b.mesNum;
      });

      console.log(`[VIAGENS] Contagem mensal calculada: ${resultado.length} meses`);
      resultado.forEach(item => {
        console.log(`[VIAGENS] ${item.mes} ${item.ano}: ${item.total} viagens`);
      });
      
      return resultado;
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao buscar contagem mensal:', error);
      throw error;
    }
  }

  // ===== MÉTODOS PARA GESTÃO DE CARROS =====

  /**
   * Lista todos os carros cadastrados
   */
  async listarCarros(): Promise<Carro[]> {
    try {
      console.log('[CARROS] Buscando lista de carros');
      
      const { data, error } = await supabase
        .from('carros')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error('[CARROS] Erro ao buscar carros:', error);
        throw new Error(`Erro ao buscar carros: ${error.message}`);
      }

      console.log(`[CARROS] Encontrados ${data?.length || 0} carros`);
      return data || [];
    } catch (error) {
      console.error('[CARROS] Erro completo ao buscar carros:', error);
      throw error;
    }
  }

  /**
   * Adiciona um novo carro
   */
  async adicionarCarro(nome: string): Promise<Carro> {
    try {
      console.log(`[CARROS] Adicionando carro: ${nome}`);
      
      const { data, error } = await supabase
        .from('carros')
        .insert({ nome: nome.trim() })
        .select()
        .single();

      if (error) {
        console.error('[CARROS] Erro ao adicionar carro:', error);
        throw new Error(`Erro ao adicionar carro: ${error.message}`);
      }

      console.log('[CARROS] Carro adicionado com sucesso');
      return data;
    } catch (error) {
      console.error('[CARROS] Erro completo ao adicionar carro:', error);
      throw error;
    }
  }

  /**
   * Atualiza o nome de um carro
   */
  async atualizarCarro(id: number, nome: string): Promise<void> {
    try {
      console.log(`[CARROS] Atualizando carro ${id}: ${nome}`);
      
      const { error } = await supabase
        .from('carros')
        .update({ nome: nome.trim() })
        .eq('id', id);

      if (error) {
        console.error('[CARROS] Erro ao atualizar carro:', error);
        throw new Error(`Erro ao atualizar carro: ${error.message}`);
      }

      console.log('[CARROS] Carro atualizado com sucesso');
    } catch (error) {
      console.error('[CARROS] Erro completo ao atualizar carro:', error);
      throw error;
    }
  }

  /**
   * Remove um carro
   */
  async removerCarro(id: number): Promise<void> {
    try {
      console.log(`[CARROS] Removendo carro ${id}`);
      
      const { error } = await supabase
        .from('carros')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[CARROS] Erro ao remover carro:', error);
        throw new Error(`Erro ao remover carro: ${error.message}`);
      }

      console.log('[CARROS] Carro removido com sucesso');
    } catch (error) {
      console.error('[CARROS] Erro completo ao remover carro:', error);
      throw error;
    }
  }

  /**
   * Marca um dia como tendo viagem (versão atualizada com carros)
   */
  async marcarViagemComCarros(obraId: string, dataViagem: string, pessoas?: string, carrosIds?: number[]): Promise<void> {
    try {
      console.log(`[VIAGENS] Marcando viagem com carros - Obra: ${obraId}, Data: ${dataViagem}, Pessoas: ${pessoas}, Carros: ${carrosIds}`);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('viagens')
        .insert({
          obra_id: parseInt(obraId),
          data: dataViagem,
          pessoas: pessoas || null,
          carros_ids: carrosIds || null
        });

      if (error) {
        // Se o erro for de duplicata, ignoramos (já existe)
        if (error.code === '23505') {
          console.log('[VIAGENS] Viagem já existe para esta data');
          return;
        }
        console.error('[VIAGENS] Erro ao marcar viagem:', error);
        throw new Error(`Erro ao marcar viagem: ${error.message}`);
      }

      console.log('[VIAGENS] Viagem marcada com sucesso');
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao marcar viagem:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma viagem existente (versão atualizada com carros)
   */
  async atualizarViagemComCarros(obraId: string, dataViagem: string, pessoas?: string, carrosIds?: number[]): Promise<void> {
    try {
      console.log(`[VIAGENS] Atualizando viagem com carros - Obra: ${obraId}, Data: ${dataViagem}, Pessoas: ${pessoas}, Carros: ${carrosIds}`);
      
      const { error } = await supabase
        .from('viagens')
        .update({
          pessoas: pessoas || null,
          carros_ids: carrosIds || null
        })
        .eq('obra_id', parseInt(obraId))
        .eq('data', dataViagem);

      if (error) {
        console.error('[VIAGENS] Erro ao atualizar viagem:', error);
        throw new Error(`Erro ao atualizar viagem: ${error.message}`);
      }

      console.log('[VIAGENS] Viagem atualizada com sucesso');
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao atualizar viagem:', error);
      throw error;
    }
  }

  /**
   * Busca contagem de viagens por carro por mês
   */
  async buscarContagemCarrosMensal(obraId: string): Promise<ContagemCarroMensal[]> {
    try {
      console.log(`[VIAGENS] Buscando contagem de carros mensal para obra: ${obraId}`);
      
      // Buscar TODAS as viagens da obra (usando a mesma lógica dos outros métodos)
      const { data: viagens, error: viagensError } = await supabase
        .from('viagens')
        .select('data, carros_ids')
        .eq('obra_id', parseInt(obraId))
        .order('data', { ascending: true });

      if (viagensError) {
        console.error('[VIAGENS] Erro ao buscar viagens para contagem de carros:', viagensError);
        throw new Error(`Erro ao buscar viagens: ${viagensError.message}`);
      }

      // Buscar todos os carros
      const { data: carros, error: carrosError } = await supabase
        .from('carros')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (carrosError) {
        console.error('[CARROS] Erro ao buscar carros:', carrosError);
        throw new Error(`Erro ao buscar carros: ${carrosError.message}`);
      }

      console.log(`[VIAGENS] Encontradas ${viagens?.length || 0} viagens e ${carros?.length || 0} carros`);

      // Se não há carros, retornar array vazio
      if (!carros?.length) {
        console.log('[VIAGENS] Nenhum carro encontrado');
        return [];
      }

      // Se não há viagens, retornar array vazio
      if (!viagens?.length) {
        console.log('[VIAGENS] Nenhuma viagem encontrada');
        return [];
      }

      // Agrupar por mês/ano e contar carros
      const contagemPorMes: { [key: string]: ContagemCarroMensal } = {};
      
      viagens.forEach(viagem => {
        const data = new Date(viagem.data);
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const chave = `${ano}-${mes.toString().padStart(2, '0')}`;
        
        // Criar entrada do mês se não existir
        if (!contagemPorMes[chave]) {
          const nomesMeses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          
          contagemPorMes[chave] = {
            mes: nomesMeses[mes - 1],
            mesNum: mes,
            ano: ano,
            carros: carros.map(carro => ({
              id: carro.id,
              nome: carro.nome,
              total: 0
            }))
          };
        }
        
        // Contar cada carro usado na viagem (se houver carros selecionados)
        if (viagem.carros_ids && Array.isArray(viagem.carros_ids)) {
          console.log(`[VIAGENS] Viagem ${viagem.data} tem carros:`, viagem.carros_ids);
          viagem.carros_ids.forEach((carroId: number) => {
            const carroIndex = contagemPorMes[chave].carros.findIndex(c => c.id === carroId);
            if (carroIndex !== -1) {
              contagemPorMes[chave].carros[carroIndex].total++;
              console.log(`[VIAGENS] Incrementando carro ${carroId} no mês ${chave}`);
            }
          });
        } else {
          console.log(`[VIAGENS] Viagem ${viagem.data} sem carros selecionados`);
        }
      });

      // Converter para array e ordenar por data
      const resultado = Object.values(contagemPorMes).sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mesNum - b.mesNum;
      });

      console.log(`[VIAGENS] Contagem de carros mensal calculada: ${resultado.length} meses`);
      resultado.forEach(mes => {
        const totalCarros = mes.carros.reduce((sum, carro) => sum + carro.total, 0);
        console.log(`[VIAGENS] ${mes.mes} ${mes.ano}: ${totalCarros} viagens com carros`);
        mes.carros.forEach(carro => {
          if (carro.total > 0) {
            console.log(`[VIAGENS]   - ${carro.nome}: ${carro.total} viagens`);
          }
        });
      });
      
      return resultado;
    } catch (error) {
      console.error('[VIAGENS] Erro completo ao buscar contagem de carros mensal:', error);
      throw error;
    }
  }
}
