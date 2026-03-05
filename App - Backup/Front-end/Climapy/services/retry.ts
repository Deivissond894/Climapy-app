import { logger } from './logger';

/**
 * Configurações de retry
 */
interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Executa uma função async com retry automático em caso de falha
 * Implementa exponential backoff para evitar sobrecarga
 * 
 * @param fn - Função a ser executada
 * @param config - Configurações de retry
 * @returns Resultado da função
 * 
 * @example
 * const data = await fetchWithRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = config;

  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Tentar executar a função
      const result = await fn();
      
      // Se teve retry anteriormente, logar sucesso
      if (attempt > 0) {
        logger.info('Requisição bem-sucedida após retry', {
          attempt: attempt + 1,
          maxRetries
        });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Se for a última tentativa, não fazer retry
      if (attempt === maxRetries - 1) {
        logger.error('Todas as tentativas de retry falharam', error as Error, {
          attempts: maxRetries
        });
        throw error;
      }

      // Calcular delay com exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      logger.warn('Tentativa falhou, fazendo retry...', {
        attempt: attempt + 1,
        maxRetries,
        nextRetryIn: `${delay}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Aguardar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Nunca deve chegar aqui, mas TypeScript precisa de garantia
  throw lastError;
}

/**
 * Versão específica para fetch com tratamento de erros HTTP
 */
export async function fetchWithRetryHttp(
  url: string,
  options?: RequestInit,
  retryConfig?: RetryConfig
): Promise<Response> {
  return fetchWithRetry(async () => {
    const response = await fetch(url, options);
    
    // Não fazer retry em erros 4xx (exceto 429 - Too Many Requests)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Fazer retry em erros 5xx e 429
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, retryConfig);
}
