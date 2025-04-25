import { supabase } from '@/lib/supabase';

class ImageCacheService {
  private static instance: ImageCacheService;
  private cache: Map<string, { url: string; timestamp: number }>;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hora

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): ImageCacheService {
    if (!ImageCacheService.instance) {
      ImageCacheService.instance = new ImageCacheService();
    }
    return ImageCacheService.instance;
  }

  public async getImageUrl(path: string): Promise<string> {
    try {
      console.log('[DEBUG] ImageCacheService - Buscando URL para:', path);

      // Verifica se existe no cache e se ainda é válido
      const cached = this.cache.get(path);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log('[DEBUG] ImageCacheService - URL encontrada no cache');
        return cached.url;
      }

      // Gera nova URL pública
      console.log('[DEBUG] ImageCacheService - Gerando nova URL pública');
      const { data, error } = await supabase.storage
        .from('notas-fiscais')
        .createSignedUrl(path, 3600); // URL válida por 1 hora

      if (error) {
        console.error('[DEBUG] ImageCacheService - Erro ao gerar URL:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        console.error('[DEBUG] ImageCacheService - URL não gerada');
        throw new Error('URL não gerada');
      }

      // Atualiza o cache
      this.cache.set(path, {
        url: data.signedUrl,
        timestamp: Date.now()
      });

      console.log('[DEBUG] ImageCacheService - Nova URL gerada e cacheada');
      return data.signedUrl;

    } catch (error) {
      console.error('[DEBUG] ImageCacheService - Erro ao obter URL:', error);
      // Em caso de erro, tenta gerar uma URL pública simples
      try {
        const { data } = await supabase.storage
          .from('notas-fiscais')
          .getPublicUrl(path);

        if (data?.publicUrl) {
          console.log('[DEBUG] ImageCacheService - URL pública gerada como fallback');
          return data.publicUrl;
        }
      } catch (fallbackError) {
        console.error('[DEBUG] ImageCacheService - Erro no fallback:', fallbackError);
      }

      throw error;
    }
  }

  public removeFromCache(path: string): void {
    console.log('[DEBUG] ImageCacheService - Removendo do cache:', path);
    this.cache.delete(path);
  }

  public clearCache(): void {
    console.log('[DEBUG] ImageCacheService - Limpando todo o cache');
    this.cache.clear();
  }
}

export default ImageCacheService; 