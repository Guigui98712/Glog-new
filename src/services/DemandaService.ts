import { supabase } from '@/lib/supabase';
import { DemandaItem } from '@/types/demanda';
import { toast } from 'sonner';
import ImageCacheService from './ImageCacheService';

class DemandaService {
  private static instance: DemandaService;
  private imageCacheService: ImageCacheService;
  private currentItems: Map<number, DemandaItem[]>;
  private loadingState: Map<number, boolean>;

  private constructor() {
    this.imageCacheService = ImageCacheService.getInstance();
    this.currentItems = new Map();
    this.loadingState = new Map();
  }

  public static getInstance(): DemandaService {
    if (!DemandaService.instance) {
      DemandaService.instance = new DemandaService();
    }
    return DemandaService.instance;
  }

  public isLoading(obraId: number): boolean {
    return this.loadingState.get(obraId) || false;
  }

  public async carregarDemandas(obraId: number): Promise<{ items: DemandaItem[], obraNome: string }> {
    try {
      console.log('[DEBUG] DemandaService - Iniciando carregamento de demandas para obra:', obraId);
      this.loadingState.set(obraId, true);

      // Carregar nome da obra
      console.log('[DEBUG] DemandaService - Buscando dados da obra');
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', obraId)
        .single();

      if (obraError) {
        console.error('[DEBUG] DemandaService - Erro ao buscar obra:', obraError);
        throw new Error('Erro ao carregar obra: ' + obraError.message);
      }

      console.log('[DEBUG] DemandaService - Obra encontrada:', obra);

      // Carregar itens de demanda
      console.log('[DEBUG] DemandaService - Buscando itens de demanda');
      const { data: demandaItens, error: demandaError } = await supabase
        .from('demanda_itens')
        .select('*')
        .eq('obra_id', obraId)
        .order('created_at', { ascending: false });

      if (demandaError) {
        console.error('[DEBUG] DemandaService - Erro ao buscar demandas:', demandaError);
        throw new Error('Erro ao carregar demandas: ' + demandaError.message);
      }

      console.log('[DEBUG] DemandaService - Itens de demanda encontrados:', demandaItens?.length || 0);

      // Converter nota_fiscal para array e validar URLs
      const itensConvertidos = await Promise.all(demandaItens.map(async item => {
        let notasFiscais: string[] = [];
        
        if (item.nota_fiscal) {
          try {
            if (typeof item.nota_fiscal === 'string') {
              // Tenta fazer parse se for uma string JSON
              if (item.nota_fiscal.startsWith('[')) {
                notasFiscais = JSON.parse(item.nota_fiscal);
              } else {
                notasFiscais = [item.nota_fiscal];
              }
            } else if (Array.isArray(item.nota_fiscal)) {
              notasFiscais = item.nota_fiscal;
            }

            // Validar cada imagem no storage
            notasFiscais = await Promise.all(
              notasFiscais.map(async (path) => {
                try {
                  const { data, error } = await supabase.storage
                    .from('notas-fiscais')
                    .download(path);

                  if (error) {
                    console.error('[DEBUG] DemandaService - Imagem não encontrada:', path, error);
                    return null;
                  }

                  return path;
                } catch (e) {
                  console.error('[DEBUG] DemandaService - Erro ao validar imagem:', path, e);
                  return null;
                }
              })
            );

            // Filtrar imagens inválidas
            notasFiscais = notasFiscais.filter(path => path !== null) as string[];
            
            // Se houver diferença entre as imagens originais e válidas, atualizar no banco
            if (notasFiscais.length !== item.nota_fiscal.length) {
              console.log('[DEBUG] DemandaService - Atualizando lista de imagens válidas no banco');
              await supabase
                .from('demanda_itens')
                .update({ nota_fiscal: notasFiscais })
                .eq('id', item.id);
            }

          } catch (e) {
            console.error('[DEBUG] DemandaService - Erro ao processar nota_fiscal:', e);
            notasFiscais = [];
          }
        }

        return {
          ...item,
          nota_fiscal: notasFiscais
        };
      }));

      console.log('[DEBUG] DemandaService - Itens convertidos:', itensConvertidos.length);
      this.currentItems.set(obraId, itensConvertidos);

      return {
        items: itensConvertidos,
        obraNome: obra.nome
      };

    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao carregar dados:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados da demanda');
      throw error;
    } finally {
      console.log('[DEBUG] DemandaService - Finalizando carregamento');
      this.loadingState.set(obraId, false);
    }
  }

  public async atualizarStatus(
    item: DemandaItem, 
    novoStatus: 'demanda' | 'pedido' | 'entregue' | 'pago'
  ): Promise<void> {
    try {
      console.log('[DEBUG] DemandaService - Iniciando atualização de status:', { 
        itemId: item?.id,
        statusAtual: item?.status,
        novoStatus,
        obra_id: item?.obra_id 
      });
      
      // Validações iniciais
      if (!item || !item.id) {
        console.error('[DEBUG] DemandaService - Item inválido:', item);
        throw new Error('Item inválido');
      }

      // Validar transição de status
      const statusValidos = {
        demanda: ['pedido'],
        pedido: ['demanda', 'entregue'],
        entregue: ['pedido', 'pago'],
        pago: ['entregue']
      };

      if (!statusValidos[item.status]?.includes(novoStatus)) {
        console.error('[DEBUG] DemandaService - Transição inválida:', {
          de: item.status,
          para: novoStatus,
          transicoesPermitidas: statusValidos[item.status]
        });
        throw new Error(`Transição de status inválida: ${item.status} -> ${novoStatus}`);
      }

      // Prepara os dados para atualização
      const updateData: any = { 
        status: novoStatus,
        updated_at: new Date().toISOString()
      };

      // Adiciona campos específicos baseado no novo status
      if (novoStatus === 'pago') {
        updateData.data_pagamento = new Date().toISOString();
        console.log('[DEBUG] DemandaService - Adicionando data de pagamento:', updateData.data_pagamento);
      } else if (novoStatus === 'pedido') {
        updateData.nota_fiscal = [];
        updateData.data_entrega = null;
        updateData.tempo_entrega = null;
        updateData.observacao_entrega = null;
      }

      console.log('[DEBUG] DemandaService - Dados para atualização:', updateData);

      // Atualiza o item no banco de dados
      const { data, error: updateError } = await supabase
        .from('demanda_itens')
        .update(updateData)
        .eq('id', item.id)
        .select();

      console.log('[DEBUG] DemandaService - Resposta do Supabase:', { data, error: updateError });

      if (updateError) {
        console.error('[DEBUG] DemandaService - Erro ao atualizar status:', updateError);
        throw new Error('Erro ao atualizar status do item: ' + updateError.message);
      }

      // Atualiza o cache local
      const obraId = item.obra_id;
      const items = this.currentItems.get(obraId) || [];
      const index = items.findIndex(i => i.id === item.id);
      
      if (index !== -1) {
        items[index] = { ...items[index], ...updateData };
        this.currentItems.set(obraId, [...items]);
        console.log('[DEBUG] DemandaService - Cache local atualizado:', {
          itemAtualizado: items[index],
          totalItens: items.length
        });
      } else {
        console.warn('[DEBUG] DemandaService - Item não encontrado no cache local:', {
          itemId: item.id,
          obraId,
          totalItensCache: items.length
        });
      }

      console.log('[DEBUG] DemandaService - Status atualizado com sucesso');
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao atualizar status:', error);
      throw error;
    }
  }

  public async uploadImagem(
    file: File, 
    item: DemandaItem
  ): Promise<string> {
    try {
      console.log('[DEBUG] Iniciando upload de imagem:', {
        nome: file.name,
        tipo: file.type,
        tamanho: file.size
      });

      // Validações
      if (!file.type.startsWith('image/')) {
        throw new Error('O arquivo deve ser uma imagem');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('A imagem deve ter no máximo 5MB');
      }

      // Criar nome único para o arquivo
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${item.id}_${timestamp}_${randomString}.${fileExtension}`;

      console.log('[DEBUG] Nome do arquivo gerado:', fileName);

      // Comprimir imagem se necessário
      let fileToUpload = file;
      if (file.size > 1 * 1024 * 1024) { // Se maior que 1MB
        console.log('[DEBUG] Comprimindo imagem...');
        fileToUpload = await this.comprimirImagem(file);
        console.log('[DEBUG] Imagem comprimida:', {
          tamanhoOriginal: file.size,
          tamanhoComprimido: fileToUpload.size
        });
      }

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.error('[ERROR] Erro no upload:', uploadError);
        throw uploadError;
      }

      // Verificar se o arquivo foi realmente enviado
      const { data: checkData, error: checkError } = await supabase.storage
        .from('notas-fiscais')
        .download(fileName);

      if (checkError || !checkData) {
        console.error('[ERROR] Erro na verificação do upload:', checkError);
        throw new Error('Erro na verificação do upload');
      }

      // Atualiza o item com o novo arquivo
      const notas = Array.isArray(item.nota_fiscal) ? item.nota_fiscal : [];
      const { error: updateError } = await supabase
        .from('demanda_itens')
        .update({ 
          nota_fiscal: [...notas, fileName] 
        })
        .eq('id', item.id);

      if (updateError) {
        console.error('[ERROR] Erro ao atualizar item:', updateError);
        // Remove o arquivo se falhar ao atualizar o item
        await supabase.storage
          .from('notas-fiscais')
          .remove([fileName]);
        throw updateError;
      }

      // Atualiza o cache local
      const obraId = item.obra_id;
      const items = this.currentItems.get(obraId) || [];
      const index = items.findIndex(i => i.id === item.id);
      
      if (index !== -1) {
        items[index] = { 
          ...items[index], 
          nota_fiscal: [...notas, fileName] 
        };
        this.currentItems.set(obraId, [...items]);
      }

      // Pré-carrega a URL no cache de imagens
      await this.imageCacheService.getImageUrl(fileName);

      console.log('[DEBUG] Upload concluído com sucesso');
      return fileName;
    } catch (error) {
      console.error('[ERROR] Erro ao fazer upload da imagem:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer upload da imagem');
      throw error;
    }
  }

  private async comprimirImagem(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar se muito grande
          if (width > 1920) {
            height = Math.round((height * 1920) / width);
            width = 1920;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const novoArquivo = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(novoArquivo);
              } else {
                reject(new Error('Erro ao comprimir imagem'));
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem para compressão'));
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo para compressão'));
    });
  }

  public async removerImagem(
    item: DemandaItem, 
    index: number
  ): Promise<void> {
    try {
      console.log('[DEBUG] DemandaService - Iniciando remoção de imagem:', { item, index });
      
      // Validações iniciais
      if (!item || !item.id) {
        throw new Error('Item inválido');
      }

      if (!Array.isArray(item.nota_fiscal)) {
        throw new Error('Lista de notas fiscais inválida');
      }

      const notas = [...item.nota_fiscal];
      const removedPath = notas[index];
      
      if (!removedPath) {
        throw new Error('Imagem não encontrada');
      }

      // Remove do array primeiro
      notas.splice(index, 1);

      // Atualiza o banco antes de tentar remover do storage
      const { error: updateError } = await supabase
        .from('demanda_itens')
        .update({ nota_fiscal: notas })
        .eq('id', item.id);

      if (updateError) {
        console.error('[DEBUG] DemandaService - Erro ao atualizar banco de dados:', updateError);
        throw new Error('Erro ao atualizar lista de imagens no banco de dados');
      }

      // Atualiza o cache local imediatamente após o sucesso do banco
      const obraId = item.obra_id;
      const items = this.currentItems.get(obraId) || [];
      const itemIndex = items.findIndex(i => i.id === item.id);
      
      if (itemIndex !== -1) {
        items[itemIndex] = { ...items[itemIndex], nota_fiscal: notas };
        this.currentItems.set(obraId, [...items]);
      }

      // Remove do storage em segundo plano
      try {
        const { error: storageError } = await supabase.storage
          .from('notas-fiscais')
          .remove([removedPath]);

        if (storageError) {
          console.error('[DEBUG] DemandaService - Erro ao remover do storage:', storageError);
          // Não lança erro aqui pois o banco já foi atualizado
        }
      } catch (storageError) {
        console.error('[DEBUG] DemandaService - Erro ao remover do storage:', storageError);
        // Não lança erro aqui pois o banco já foi atualizado
      }

      // Remove do cache de imagens
      this.imageCacheService.removeFromCache(removedPath);

      console.log('[DEBUG] DemandaService - Imagem removida com sucesso');
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao remover imagem:', error);
      throw error;
    }
  }

  async uploadImagens(files: File[]): Promise<string[]> {
    try {
      const paths: string[] = [];
      
      for (const file of files) {
        const path = `notas-fiscais/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('demandas')
          .upload(path, file);

        if (uploadError) {
          console.error('[DEBUG] DemandaService - Erro no upload:', uploadError);
          throw uploadError;
        }

        paths.push(path);
      }

      console.log('[DEBUG] DemandaService - Paths das imagens:', paths);
      return paths;
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao fazer upload:', error);
      throw error;
    }
  }

  async salvarDemanda(demanda: DemandaDTO): Promise<void> {
    try {
      console.log('[DEBUG] DemandaService - Salvando demanda:', demanda);
      
      const { data: demandaData, error: demandaError } = await supabase
        .from('demanda')
        .insert([
          {
            titulo: demanda.titulo,
            descricao: demanda.descricao,
            status: demanda.status,
            data_criacao: new Date().toISOString(),
            data_atualizacao: new Date().toISOString(),
            usuario_id: demanda.usuario_id,
            prioridade: demanda.prioridade
          }
        ])
        .select()
        .single();

      if (demandaError) {
        console.error('[DEBUG] DemandaService - Erro ao salvar demanda:', demandaError);
        throw demandaError;
      }

      if (demanda.itens && demanda.itens.length > 0) {
        const itensParaInserir = demanda.itens.map(item => ({
          demanda_id: demandaData.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          nota_fiscal: Array.isArray(item.nota_fiscal) ? item.nota_fiscal : (item.nota_fiscal ? [item.nota_fiscal] : [])
        }));

        const { error: itensError } = await supabase
          .from('demanda_item')
          .insert(itensParaInserir);

        if (itensError) {
          console.error('[DEBUG] DemandaService - Erro ao salvar itens:', itensError);
          throw itensError;
        }
      }

      console.log('[DEBUG] DemandaService - Demanda salva com sucesso');
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao salvar demanda:', error);
      throw error;
    }
  }

  async buscarDemandas(): Promise<DemandaDTO[]> {
    try {
      console.log('[DEBUG] DemandaService - Buscando demandas');
      
      const { data: demandas, error: demandasError } = await supabase
        .from('demanda')
        .select(`
          *,
          demanda_item (
            id,
            descricao,
            quantidade,
            valor_unitario,
            nota_fiscal
          )
        `)
        .order('data_criacao', { ascending: false });

      if (demandasError) {
        console.error('[DEBUG] DemandaService - Erro ao buscar demandas:', demandasError);
        throw demandasError;
      }

      const demandasFormatadas = demandas.map(demanda => ({
        ...demanda,
        itens: demanda.demanda_item.map(item => ({
          ...item,
          nota_fiscal: Array.isArray(item.nota_fiscal) ? item.nota_fiscal : (item.nota_fiscal ? [item.nota_fiscal] : [])
        }))
      }));

      console.log('[DEBUG] DemandaService - Demandas encontradas:', demandasFormatadas);
      return demandasFormatadas;
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao buscar demandas:', error);
      throw error;
    }
  }

  async buscarDemandaPorId(id: string): Promise<DemandaDTO | null> {
    try {
      console.log('[DEBUG] DemandaService - Buscando demanda por ID:', id);
      
      const { data: demanda, error: demandaError } = await supabase
        .from('demanda')
        .select(`
          *,
          demanda_item (
            id,
            descricao,
            quantidade,
            valor_unitario,
            nota_fiscal
          )
        `)
        .eq('id', id)
        .single();

      if (demandaError) {
        console.error('[DEBUG] DemandaService - Erro ao buscar demanda:', demandaError);
        throw demandaError;
      }

      if (!demanda) {
        console.log('[DEBUG] DemandaService - Demanda não encontrada');
        return null;
      }

      const demandaFormatada = {
        ...demanda,
        itens: demanda.demanda_item.map(item => ({
          ...item,
          nota_fiscal: Array.isArray(item.nota_fiscal) ? item.nota_fiscal : (item.nota_fiscal ? [item.nota_fiscal] : [])
        }))
      };

      console.log('[DEBUG] DemandaService - Demanda encontrada:', demandaFormatada);
      return demandaFormatada;
    } catch (error) {
      console.error('[DEBUG] DemandaService - Erro ao buscar demanda:', error);
      throw error;
    }
  }
}

export default DemandaService; 