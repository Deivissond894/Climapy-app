import { logger } from './logger';

/**
 * Estatísticas de uma operação
 */
interface OperationStats {
  avg: number;
  max: number;
  min: number;
  count: number;
  total: number;
}

/**
 * Serviço de métricas de performance
 * Rastreia tempo de execução de operações críticas
 */
class MetricsService {
  private metrics: Map<string, number[]> = new Map();
  private readonly slowOperationThreshold = 2000; // 2 segundos

  /**
   * Rastreia o tempo de uma operação
   * @param operation - Nome da operação
   * @param startTime - Timestamp inicial (Date.now())
   */
  trackTime(operation: string, startTime: number) {
    const duration = Date.now() - startTime;
    
    // Armazenar métrica
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    this.metrics.get(operation)!.push(duration);
    
    // Alertar se operação demorar muito
    if (duration > this.slowOperationThreshold) {
      logger.warn('Operação lenta detectada', {
        operation,
        duration: `${duration}ms`,
        threshold: `${this.slowOperationThreshold}ms`
      });
    }

    // Log de debug em desenvolvimento
    if (__DEV__) {
      logger.debug(`Operação: ${operation}`, {
        duration: `${duration}ms`
      });
    }
  }

  /**
   * Retorna estatísticas de uma operação
   */
  getStats(operation: string): OperationStats | null {
    const times = this.metrics.get(operation);
    
    if (!times || times.length === 0) {
      return null;
    }

    const total = times.reduce((a, b) => a + b, 0);
    const avg = total / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    return {
      avg: Math.round(avg),
      max,
      min,
      count: times.length,
      total: Math.round(total)
    };
  }

  /**
   * Retorna estatísticas de todas as operações
   */
  getAllStats(): Record<string, OperationStats> {
    const stats: Record<string, OperationStats> = {};

    this.metrics.forEach((_, operation) => {
      const operationStats = this.getStats(operation);
      if (operationStats) {
        stats[operation] = operationStats;
      }
    });

    return stats;
  }

  /**
   * Limpa métricas de uma operação específica
   */
  clear(operation: string) {
    this.metrics.delete(operation);
  }

  /**
   * Limpa todas as métricas
   */
  clearAll() {
    this.metrics.clear();
  }

  /**
   * Helper para rastrear uma função async
   */
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

export const metrics = new MetricsService();
