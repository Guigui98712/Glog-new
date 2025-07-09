import { supabase } from '@/lib/supabase';

export interface Projeto {
  id: string;
  nome: string;
  tipo: string;
  data_upload: string;
  url: string;
  obra_id: string;
  pasta_id?: string; // Nova propriedade para associar projeto a uma pasta
}

export interface Pasta {
  id: string;
  nome: string;
  tipo: string;
  obra_id: number;
  data_criacao: string;
  projeto_count?: number; // Número de projetos na pasta
}

export class ProjetoService {
  private readonly BUCKET_NAME = 'projetos';

  // Métodos para gerenciar pastas
  async criarPasta(nome: string, tipo: string, obraId: string): Promise<Pasta> {
    try {
      console.log(`Criando pasta: ${nome}, Tipo: ${tipo}, Obra: ${obraId}`);
      
      const { data: pasta, error } = await supabase
        .from('pastas_projetos')
        .insert({
          nome: nome,
          tipo: tipo,
          obra_id: obraId,
          data_criacao: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar pasta:', error);
        throw new Error(`Erro ao criar pasta: ${error.message}`);
      }

      console.log('Pasta criada com sucesso:', pasta);
      return pasta;
    } catch (error) {
      console.error('Erro completo ao criar pasta:', error);
      throw error;
    }
  }

  async listarPastas(tipo: string, obraId: string): Promise<Pasta[]> {
    try {
      const { data, error } = await supabase
        .from('pastas_projetos')
        .select(`
          *,
          projetos:projetos(count)
        `)
        .eq('tipo', tipo)
        .eq('obra_id', obraId)
        .order('nome', { ascending: true });

      if (error) throw error;

      // Processar contagem de projetos
      const pastas = data?.map(pasta => ({
        ...pasta,
        projeto_count: pasta.projetos?.[0]?.count || 0
      })) || [];

      return pastas;
    } catch (error) {
      console.error('Erro ao listar pastas:', error);
      throw error;
    }
  }

  async renomearPasta(id: string, novoNome: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pastas_projetos')
        .update({ nome: novoNome })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao renomear pasta: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao renomear pasta:', error);
      throw error;
    }
  }

  async excluirPasta(id: string): Promise<void> {
    try {
      // Verificar se há projetos na pasta
      const { data: projetos, error: projetosError } = await supabase
        .from('projetos')
        .select('id')
        .eq('pasta_id', id);

      if (projetosError) {
        throw new Error(`Erro ao verificar projetos na pasta: ${projetosError.message}`);
      }

      if (projetos && projetos.length > 0) {
        throw new Error('Não é possível excluir uma pasta que contém projetos. Mova ou exclua os projetos primeiro.');
      }

      // Excluir a pasta
      const { error } = await supabase
        .from('pastas_projetos')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao excluir pasta: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
      throw error;
    }
  }

  async buscarProjetosPorPasta(tipo: string, obraId: string, pastaId?: string): Promise<Projeto[]> {
    try {
      let query = supabase
        .from('projetos')
        .select('*')
        .eq('tipo', tipo)
        .eq('obra_id', obraId);

      if (pastaId) {
        query = query.eq('pasta_id', pastaId);
      } else {
        query = query.is('pasta_id', null); // Projetos sem pasta
      }

      const { data, error } = await query.order('data_upload', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar projetos por pasta:', error);
      throw error;
    }
  }

  async moverProjetoParaPasta(projetoId: string, pastaId: string | null): Promise<void> {
    try {
      const { error } = await supabase
        .from('projetos')
        .update({ pasta_id: pastaId })
        .eq('id', projetoId);

      if (error) {
        throw new Error(`Erro ao mover projeto: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao mover projeto:', error);
      throw error;
    }
  }

  async uploadProjeto(file: File, tipo: string, obraId: string, pastaId?: string): Promise<Projeto> {
    try {
      console.log(`Iniciando upload - Arquivo: ${file.name}, Tipo: ${tipo}, Pasta: ${pastaId || 'Raiz'}, Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      
      // Verificar tamanho do arquivo (limite de 50MB)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error(`O arquivo é muito grande. O tamanho máximo é 50MB.`);
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${obraId}/${tipo.toLowerCase()}/${fileName}`;

      console.log(`Preparando para upload no caminho: ${filePath}`);
      
      // Verificar se o bucket existe, se não, tenta criar
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Erro ao listar buckets:', bucketsError);
        throw new Error(`Erro ao verificar buckets: ${bucketsError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === this.BUCKET_NAME);
      
      if (!bucketExists) {
        console.log(`Bucket ${this.BUCKET_NAME} não existe, tentando criar...`);
        const { error: createBucketError } = await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: true
        });
        
        if (createBucketError) {
          console.error(`Erro detalhado ao criar bucket: ${JSON.stringify(createBucketError)}`);
          throw new Error(`Não foi possível criar o local de armazenamento: ${createBucketError.message}`);
        }
      }
      
      // Criar pasta se não existir
      try {
        const dirPath = `${obraId}/${tipo.toLowerCase()}`;
        await supabase.storage.from(this.BUCKET_NAME).upload(`${dirPath}/.keep`, new Blob([''], { type: 'text/plain' }), {
          upsert: true
        });
      } catch (dirError) {
        console.error('Erro ao criar diretório:', dirError);
        // Ignora erro se já existir
        console.log('Verificação de diretório concluída ou já existe');
      }
      
      // Fazer upload do arquivo
      console.log('Enviando arquivo para o servidor...');
      const { error: uploadError, data } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error(`Erro detalhado de upload: ${JSON.stringify(uploadError)}`);
        throw new Error(`Erro ao enviar arquivo: ${uploadError.message}`);
      }

      console.log('Upload concluído com sucesso, obtendo URL pública');
      
      const { data: { publicUrl } } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      console.log(`URL pública: ${publicUrl}`);
      console.log('Registrando no banco de dados...');
      
      const { data: projeto, error: insertError } = await supabase
        .from('projetos')
        .insert({
          nome: file.name,
          tipo: tipo,
          url: publicUrl,
          data_upload: new Date().toISOString(),
          obra_id: obraId,
          pasta_id: pastaId || null
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Erro detalhado ao inserir registro: ${JSON.stringify(insertError)}`);
        // Se falhar ao inserir no banco, remover o arquivo enviado
        await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
        throw new Error(`Erro ao registrar projeto no banco de dados: ${insertError.message}`);
      }

      console.log('Projeto registrado com sucesso:', projeto);
      return projeto;
    } catch (error) {
      console.error('Erro completo ao fazer upload do projeto:', error);
      throw error;
    }
  }

  async buscarProjetos(tipo: string, obraId: string): Promise<Projeto[]> {
    try {
      const { data, error } = await supabase
        .from('projetos')
        .select('*')
        .eq('tipo', tipo)
        .eq('obra_id', obraId)
        .order('data_upload', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      throw error;
    }
  }

  async excluirProjeto(id: string): Promise<void> {
    try {
      // Buscar o projeto para obter a URL do arquivo
      const { data: projeto, error: selectError } = await supabase
        .from('projetos')
        .select('url')
        .eq('id', id)
        .single();

      if (selectError) {
        throw new Error(`Erro ao buscar projeto: ${selectError.message}`);
      }

      if (projeto) {
        // Extrair o caminho do arquivo da URL
        try {
          // Obter o caminho relativo do arquivo a partir da URL
          const url = new URL(projeto.url);
          const pathname = url.pathname;
          // O caminho no storage é o que vem após o nome do bucket na URL
          const pathParts = pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
          
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            const storagePath = pathParts.slice(bucketIndex + 1).join('/');
            
            console.log(`Removendo arquivo: ${storagePath}`);
            const { error: removeError } = await supabase.storage
              .from(this.BUCKET_NAME)
              .remove([storagePath]);
            
            if (removeError) {
              console.error(`Erro ao remover arquivo: ${removeError.message}`);
            }
          }
        } catch (parseError) {
          console.error('Erro ao processar URL do arquivo:', parseError);
        }
      }

      // Remover o registro do banco de dados
      const { error: deleteError } = await supabase
        .from('projetos')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Erro ao excluir registro: ${deleteError.message}`);
      }

      console.log('Projeto excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      throw error;
    }
  }

  async downloadProjeto(url: string): Promise<Blob> {
    try {
      console.log(`Iniciando download do arquivo: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao baixar arquivo (${response.status}): ${errorText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Erro ao fazer download do projeto:', error);
      throw error;
    }
  }
} 