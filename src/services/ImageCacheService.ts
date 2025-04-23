import { supabase } from '@/lib/supabase';

class ImageCacheService {
  private static instance: ImageCacheService;
  private cache: Map<string, { url: string; timestamp: number }>;
  private readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutos
  private loadingPromises: Map<string, Promise<string>>;

  private constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }

  public static getInstance(): ImageCacheService {
    if (!ImageCacheService.instance) {
      ImageCacheService.instance = new ImageCacheService();
    }
    return ImageCacheService.instance;
  }

  public async getImageUrl(path: string): Promise<string> {
    if (!path) {
      console.error('[ERROR] ImageCacheService - Caminho vazio');
      throw new Error('Caminho da imagem não fornecido');
    }

    try {
      // Verifica se já existe uma requisição em andamento para este path
      const existingPromise = this.loadingPromises.get(path);
      if (existingPromise) {
        return existingPromise;
      }

      // Verifica se a URL está em cache e ainda é válida
      const cached = this.cache.get(path);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        // Verifica se a URL ainda é válida
        try {
          const response = await fetch(cached.url, { method: 'HEAD' });
          if (response.ok) {
            return cached.url;
          }
          // Se a URL não é mais válida, remove do cache
          this.cache.delete(path);
        } catch {
          // Se houver erro na verificação, remove do cache
          this.cache.delete(path);
        }
      }

      // Cria uma nova Promise para o carregamento
      const loadPromise = this.loadImageUrl(path);
      this.loadingPromises.set(path, loadPromise);

      try {
        const url = await loadPromise;
        return url;
      } finally {
        // Remove a Promise do map quando concluída (sucesso ou erro)
        this.loadingPromises.delete(path);
      }
    } catch (error) {
      console.error('[ERROR] ImageCacheService - Erro ao obter URL da imagem:', error);
      throw new Error('Não foi possível carregar a imagem');
    }
  }

  private async loadImageUrl(path: string): Promise<string> {
    console.log('[DEBUG] ImageCacheService - Carregando URL para:', path);
    
    try {
      const { data: { publicUrl }, error } = await supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(path);

      if (error) {
        console.error('[ERROR] ImageCacheService - Erro do Supabase:', error);
        throw error;
      }

      if (!publicUrl) {
        console.error('[ERROR] ImageCacheService - URL pública não encontrada');
        throw new Error('URL pública não encontrada');
      }

      // Verifica se a URL é acessível
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (!response.ok) {
        console.error('[ERROR] ImageCacheService - URL inacessível:', publicUrl);
        throw new Error('Imagem não encontrada no storage');
      }

      // Armazena no cache
      this.cache.set(path, {
        url: publicUrl,
        timestamp: Date.now()
      });

      console.log('[DEBUG] ImageCacheService - URL carregada com sucesso:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('[ERROR] ImageCacheService - Erro ao carregar URL:', error);
      throw error;
    }
  }

  public clearCache(): void {
    this.cache.clear();
    console.log('[DEBUG] ImageCacheService - Cache limpo');
  }

  public removeFromCache(path: string): void {
    this.cache.delete(path);
    console.log('[DEBUG] ImageCacheService - Removido do cache:', path);
  }
}

export default ImageCacheService; 