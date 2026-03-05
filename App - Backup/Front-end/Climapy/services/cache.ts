import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Configuração de cache
 */
interface CacheConfig {
  key: string;
  ttl: number; // Time to live em segundos
}

/**
 * Item armazenado no cache
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Serviço de cache para otimizar requisições
 * Reduz chamadas ao servidor armazenando dados temporariamente
 */
class CacheService {
  /**
   * Busca dados do cache
   * @returns Dados se válidos, null se expirados ou não existentes
   */
  async get<T>(config: CacheConfig): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(config.key);
      if (!cached) return null;

      const { data, timestamp }: CacheItem<T> = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > config.ttl * 1000;

      if (isExpired) {
        await this.invalidate(config.key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar do cache:', error);
      return null;
    }
  }

  /**
   * Salva dados no cache
   */
  async set<T>(config: CacheConfig, data: T): Promise<void> {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem(
        config.key,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Erro ao salvar no cache:', error);
    }
  }

  /**
   * Invalida (remove) uma entrada do cache
   */
  async invalidate(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Erro ao invalidar cache:', error);
    }
  }

  /**
   * Invalida múltiplas entradas que começam com um prefixo
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key => key.startsWith(prefix));
      await AsyncStorage.multiRemove(keysToRemove);
    } catch (error) {
      console.error('Erro ao invalidar cache por prefixo:', error);
    }
  }

  /**
   * Limpa todo o cache
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }
}

export const cacheService = new CacheService();
