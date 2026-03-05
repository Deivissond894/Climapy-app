import * as Sentry from '@sentry/react-native';
import { logger } from './logger';

/**
 * Inicializa o Sentry para monitoramento de erros em produção
 * 
 * Configuração:
 * 1. Criar conta em https://sentry.io
 * 2. Criar novo projeto React Native
 * 3. Copiar o DSN e substituir abaixo
 * 4. Configurar variáveis de ambiente
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export function initSentry() {
  // Só inicializar em produção
  if (__DEV__) {
    logger.info('Sentry desabilitado em desenvolvimento');
    return;
  }

  if (!SENTRY_DSN) {
    logger.warn('Sentry DSN não configurado. Monitoramento de erros desabilitado.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Rastrear transações de performance (reduzir para economizar cota)
    tracesSampleRate: 0.2, // 20% das transações
    
    // Ambiente
    environment: __DEV__ ? 'development' : 'production',
    
    // Informações de release
    // release: `climapy@${version}`, // Adicionar versão do app
    
    // Antes de enviar o evento, você pode modificá-lo
    beforeSend(event, hint) {
      // Não enviar erros específicos que não são relevantes
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignorar erros de rede comuns que não podemos controlar
          if (error.message.includes('Network request failed')) {
            return null;
          }
        }
      }
      return event;
    },
    
    // Integrar com breadcrumbs do logger
    integrations: [
      new Sentry.ReactNativeTracing({
        // Rastrear navegação
        routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
      }),
    ],
  });

  logger.info('Sentry inicializado', {
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2
  });
}

/**
 * Captura exceção manualmente
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (__DEV__) {
    logger.error('Exceção capturada (dev)', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Captura mensagem de erro
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'error') {
  if (__DEV__) {
    logger.warn('Mensagem capturada (dev)', { message, level });
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Define contexto do usuário
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  Sentry.setUser(user);
}

/**
 * Adiciona breadcrumb (rastro de navegação)
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * ErrorBoundary do Sentry para React
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
