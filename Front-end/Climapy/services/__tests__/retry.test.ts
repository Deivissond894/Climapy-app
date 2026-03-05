// Mock simplificado do fetchWithRetry
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  config: { maxRetries?: number; initialDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000 } = config;
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, initialDelay));
    }
  }
  throw lastError;
}

describe('RetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchWithRetry', () => {
    it('deve retornar resultado na primeira tentativa bem-sucedida', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await fetchWithRetry(mockFn, { maxRetries: 3, initialDelay: 10 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve fazer retry quando a função falha', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      const result = await fetchWithRetry(mockFn, { maxRetries: 3, initialDelay: 10 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('deve lançar erro após esgotar todas as tentativas', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        fetchWithRetry(mockFn, { maxRetries: 3, initialDelay: 10 })
      ).rejects.toThrow('Always fails');
      
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});
