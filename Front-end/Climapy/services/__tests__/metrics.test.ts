// Mock simplificado do MetricsService
class MetricsService {
  private metrics: Map<string, number[]> = new Map();

  trackTime(operation: string, startTime: number) {
    const duration = Date.now() - startTime;
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  getStats(operation: string) {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) return null;
    
    const total = times.reduce((a, b) => a + b, 0);
    const avg = total / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    
    return { avg: Math.round(avg), max, min, count: times.length, total: Math.round(total) };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    this.metrics.forEach((_, operation) => {
      const operationStats = this.getStats(operation);
      if (operationStats) stats[operation] = operationStats;
    });
    return stats;
  }

  clear(operation: string) {
    this.metrics.delete(operation);
  }

  clearAll() {
    this.metrics.clear();
  }

  async track<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      this.trackTime(operation, startTime);
      return result;
    } catch (error) {
      this.trackTime(operation, startTime);
      throw error;
    }
  }
}

const metrics = new MetricsService();

describe('MetricsService', () => {
  beforeEach(() => {
    metrics.clearAll();
  });

  describe('trackTime', () => {
    it('deve rastrear tempo de operação', () => {
      const startTime = Date.now() - 1000;
      metrics.trackTime('test_operation', startTime);
      
      const stats = metrics.getStats('test_operation');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBeGreaterThan(900);
    });

    it('deve rastrear múltiplas operações', () => {
      const startTime1 = Date.now() - 500;
      const startTime2 = Date.now() - 1000;
      
      metrics.trackTime('test_op', startTime1);
      metrics.trackTime('test_op', startTime2);
      
      const stats = metrics.getStats('test_op');
      expect(stats?.count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('deve retornar null para operação não rastreada', () => {
      const stats = metrics.getStats('nonexistent');
      expect(stats).toBeNull();
    });
  });

  describe('track', () => {
    it('deve rastrear função async bem-sucedida', async () => {
      const testFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      };
      
      const result = await metrics.track('async_op', testFn);
      
      expect(result).toBe('success');
      const stats = metrics.getStats('async_op');
      expect(stats?.count).toBe(1);
    });
  });
});
