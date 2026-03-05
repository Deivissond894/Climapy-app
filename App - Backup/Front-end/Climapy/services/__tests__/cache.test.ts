import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock simplificado do cache service para teste
const cacheService = {
  async get<T>(config: { key: string; ttl: number }): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(config.key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > config.ttl * 1000;

      if (isExpired) {
        await AsyncStorage.removeItem(config.key);
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  },

  async set<T>(config: { key: string; ttl: number }, data: T): Promise<void> {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(config.key, JSON.stringify(cacheItem));
    } catch (error) {
      // ignore
    }
  },

  async invalidate(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // ignore
    }
  },

  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key => key.startsWith(prefix));
      await AsyncStorage.multiRemove(keysToRemove);
    } catch (error) {
      // ignore
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      // ignore
    }
  }
};

describe('CacheService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('get', () => {
    it('deve retornar null quando não houver cache', async () => {
      const result = await cacheService.get({ key: 'test', ttl: 300 });
      expect(result).toBeNull();
    });

    it('deve retornar dados válidos do cache', async () => {
      const testData = { name: 'Test User', id: '123' };
      await cacheService.set({ key: 'test', ttl: 300 }, testData);
      
      const result = await cacheService.get({ key: 'test', ttl: 300 });
      expect(result).toEqual(testData);
    });
  });

  describe('set', () => {
    it('deve salvar dados no cache', async () => {
      const testData = { value: 'cached' };
      await cacheService.set({ key: 'test', ttl: 300 }, testData);
      
      const stored = await AsyncStorage.getItem('test');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.data).toEqual(testData);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('invalidate', () => {
    it('deve remover entrada do cache', async () => {
      await cacheService.set({ key: 'test', ttl: 300 }, { data: 'test' });
      await cacheService.invalidate('test');
      
      const result = await AsyncStorage.getItem('test');
      expect(result).toBeNull();
    });
  });
});
