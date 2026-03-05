/**
 * Níveis de log disponíveis
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Estrutura de uma entrada de log
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  userId?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Serviço de logging estruturado
 * Em desenvolvimento: exibe logs no console
 * Em produção: envia logs para o backend
 */
class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private userId?: string;

  /**
   * Define o ID do usuário para contexto dos logs
   */
  setUserId(userId: string | undefined) {
    this.userId = userId;
  }

  /**
   * Método interno para criar e processar logs
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    // Armazenar log em memória (buffer circular)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Em desenvolvimento: console.log
    // Em produção: enviar para backend
    if (__DEV__) {
      this.logToConsole(entry);
    } else {
      this.sendToBackend(entry);
    }
  }

  /**
   * Exibe log formatado no console (desenvolvimento)
   */
  private logToConsole(entry: LogEntry) {
    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌'
    }[entry.level];

    console.log(`${emoji} [${entry.level}] ${entry.message}`);
    
    if (entry.context) {
      console.log('Context:', entry.context);
    }
    
    if (entry.error) {
      console.error('Error:', entry.error);
    }
  }

  /**
   * Envia log para o backend (produção)
   */
  private async sendToBackend(entry: LogEntry) {
    try {
      // Não bloquear a execução se o log falhar
      fetch('https://climapp-1hxc.onrender.com/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      }).catch(() => {
        // Silenciar erro de logging
      });
    } catch (e) {
      // Silenciar erro de logging
    }
  }

  /**
   * Log de nível DEBUG
   */
  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log de nível INFO
   */
  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log de nível WARN
   */
  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log de nível ERROR
   */
  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Retorna todos os logs em memória
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Limpa logs em memória
   */
  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();
