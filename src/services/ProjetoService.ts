import { supabase } from '@/lib/supabase';

export interface Projeto {
  id: string;
  nome: string;
  tipo: string;
  dataUpload: string;
  url: string;
  obra_id: string;
}

export class ProjetoService {
  private readonly BUCKET_NAME = 'projetos';

  async uploadProjeto(file: File, tipo: string, obraId: string): Promise<Projeto> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${obraId}/${tipo.toLowerCase()}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      const { data: projeto, error: insertError } = await supabase
        .from('projetos')
        .insert({
          nome: file.name,
          tipo: tipo,
          url: publicUrl,
          dataUpload: new Date().toISOString(),
          obra_id: obraId
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return projeto;
    } catch (error) {
      console.error('Erro ao fazer upload do projeto:', error);
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
        .order('dataUpload', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      throw error;
    }
  }

  async excluirProjeto(id: string): Promise<void> {
    try {
      const { data: projeto } = await supabase
        .from('projetos')
        .select('url')
        .eq('id', id)
        .single();

      if (projeto) {
        const filePath = new URL(projeto.url).pathname.split('/').pop();
        
        if (filePath) {
          await supabase.storage
            .from(this.BUCKET_NAME)
            .remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('projetos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      throw error;
    }
  }

  async downloadProjeto(url: string): Promise<Blob> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao baixar arquivo');
      return await response.blob();
    } catch (error) {
      console.error('Erro ao fazer download do projeto:', error);
      throw error;
    }
  }
} 