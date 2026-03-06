/**
 * Serviço centralizado para comunicação com a API
 * Gerencia todas as requisições HTTP da aplicação
 */

import { logger } from './logger';
import { metrics } from './metrics';
import { fetchWithRetry } from './retry';

const API_BASE_URL = 'https://back-end-restless-darkness-2411.fly.dev';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  emailVerified: boolean;
  rememberMe: boolean;
  sessionType: string;
  suggestedExpiry: string;
  note?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface GoogleSignInRequest {
  idToken: string;
  accessToken?: string;
  serverAuthCode?: string;
}

class ApiService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private onAuthError?: () => void;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Configurar callback para erros de autenticação
   */
  setOnAuthError(callback: () => void): void {
    this.onAuthError = callback;
  }

  /**
   * Método privado para fazer requisições HTTP
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const operationName = `API_${options.method || 'GET'}_${endpoint}`;

    try {
      logger.info('API Request', {
        method: options.method || 'GET',
        endpoint,
        hasBody: !!options.body
      });
      
      const config: RequestInit = {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
      };

      // Usar fetchWithRetry para requisições importantes
      const response = await fetchWithRetry(
        () => fetch(`${this.baseUrl}${endpoint}`, config),
        { maxRetries: 3, initialDelay: 1000 }
      );
      
      let data: any;
      const contentType = response.headers.get('content-type');
      
      try {
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          logger.warn('Resposta não é JSON', {
            status: response.status,
            endpoint,
            contentType,
            body: text.substring(0, 100)
          });
          data = { message: text };
        }
      } catch (parseError) {
        logger.error('Erro ao fazer parse da resposta', parseError as Error, {
          endpoint,
          status: response.status
        });
        data = { message: 'Erro ao processar resposta do servidor' };
      }

      logger.info('API Response', {
        status: response.status,
        endpoint,
        success: response.ok
      });

      // Rastrear tempo da operação
      metrics.trackTime(operationName, startTime);

      if (response.ok) {
        return {
          success: true,
          data,
        };
      } else {
        // Tratar erros de autenticação
        if (response.status === 401 || response.status === 403) {
          logger.warn('Erro de autenticação', {
            status: response.status,
            endpoint,
          });
          
          // Chamar callback se configurado
          if (this.onAuthError) {
            this.onAuthError();
          }
        }

        logger.warn('API retornou erro', {
          status: response.status,
          endpoint,
          message: data.message
        });

        return {
          success: false,
          message: data.message || 'Erro na requisição',
          error: data.error,
        };
      }
    } catch (error) {
      logger.error('Erro na requisição API', error as Error, {
        endpoint,
        method: options.method || 'GET'
      });

      // Rastrear tempo mesmo em caso de erro
      metrics.trackTime(operationName, startTime);

      return {
        success: false,
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Acordar o servidor (útil para VPS gratuitos)
   */
  async wakeUpServer(): Promise<ApiResponse> {
    return this.makeRequest('/', { method: 'GET' });
  }

  /**
   * Realizar login
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * Realizar cadastro
   */
  async signup(userData: SignupRequest): Promise<ApiResponse> {
    return this.makeRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Recuperar senha
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse> {
    return this.makeRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Adicionar token de autenticação aos headers
   */
  setAuthToken(token: string): void {
    console.log('🔑 [API] Configurando novo token:', token ? `${token.substring(0, 50)}...` : 'NENHUM');
    
    this.defaultHeaders = {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`,
    };
    
    console.log('🔑 [API] Authorization header agora é:', (this.defaultHeaders as any).Authorization ? 'PRESENTE' : 'AUSENTE');
  }

  /**
   * Remover token de autenticação
   */
  removeAuthToken(): void {
    const { Authorization, ...headersWithoutAuth } = this.defaultHeaders as any;
    this.defaultHeaders = headersWithoutAuth;
  }

  /**
   * Fazer requisição GET genérica
   */
  async get<T>(endpoint: string, headers?: HeadersInit): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'GET',
      headers: { ...this.defaultHeaders, ...headers },
    });
  }

  /**
   * Fazer requisição POST genérica
   */
  /**
   * Fazer requisição POST genérica
   */
  async post<T>(
    endpoint: string,
    data?: any,
    headers?: HeadersInit
  ): Promise<ApiResponse<T>> {
    // Se for FormData, não fazer JSON.stringify e não setar Content-Type
    // (o navegador/Expo faz isso automaticamente)
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const body = isFormData ? data : data ? JSON.stringify(data) : undefined;
    
    // Para FormData, manter o Authorization header mas deixar Content-Type vazio
    // Para o navegador adicionar o boundary automaticamente
    let requestHeaders: HeadersInit;
    if (isFormData) {
      const authHeader = (this.defaultHeaders as any).Authorization;
      requestHeaders = {
        ...headers,
        ...(authHeader && { Authorization: authHeader })
      };
    } else {
      requestHeaders = { ...this.defaultHeaders, ...headers };
    }

    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body,
      headers: requestHeaders,
    });
  }

  /**
   * Fazer requisição PUT genérica
   */
  async put<T>(
    endpoint: string,
    data?: any,
    headers?: HeadersInit
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: { ...this.defaultHeaders, ...headers },
    });
  }

  /**
   * Fazer requisição DELETE genérica
   */
  async delete<T>(endpoint: string, headers?: HeadersInit): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
      headers: { ...this.defaultHeaders, ...headers },
    });
  }
}

// Exportar instância única do serviço
export const apiService = new ApiService();