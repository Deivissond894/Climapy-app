import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { logger } from '../services/logger';
import { setUser as setSentryUser } from '../services/sentry';
import { useDataStore } from '../stores/dataStore';

export interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

const TOKEN_KEY = '@climapy:token';
const USER_KEY = '@climapy:user';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const { fetchData, clearData } = useDataStore();

  const isAuthenticated = !!user && !!token;

  // Carregar dados salvos ao inicializar
  useEffect(() => {
    loadStoredData();
  }, []);

  // Configurar callback para erros de autenticação
  useEffect(() => {
    apiService.setOnAuthError(() => {
      logger.warn('Erro de autenticação detectado - limpando sessão');
      logout();
    });
  }, []);

  const loadStoredData = async () => {
    try {
      setIsLoading(true);
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedToken && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Validar se os dados são válidos
          if (userData && userData.id && userData.email) {
            setToken(storedToken);
            setUser(userData);
            apiService.setAuthToken(storedToken);
            
            // Configurar contexto do Sentry e Logger
            logger.setUserId(userData.id);
            setSentryUser({
              id: userData.id,
              email: userData.email,
              username: userData.username
            });
            
            logger.info('Sessão restaurada', { userId: userData.id });
            
            // Carregar dados em background
            fetchData(userData.id).catch(error => 
              logger.error('Erro ao carregar dados iniciais', error)
            );
          } else {
            logger.warn('Dados de usuário corrompidos, limpando storage');
            await clearAuthData();
          }
        } catch (parseError) {
          logger.error('Erro ao fazer parse dos dados do usuário', parseError as Error);
          await clearAuthData();
        }
      }
    } catch (error) {
      logger.error('Erro ao carregar dados salvos', error as Error);
      try {
        await clearAuthData();
      } catch (clearError) {
        logger.error('Erro ao limpar dados corrompidos', clearError as Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuthData = async (tokenData: string, userData: User) => {
    try {
      // Validar se os dados não estão undefined/null antes de salvar
      if (!tokenData || !userData || !userData.id || !userData.email) {
        console.warn('Tentativa de salvar dados inválidos:', { 
          hasToken: !!tokenData, 
          hasUser: !!userData,
          userId: userData?.id,
          userEmail: userData?.email 
        });
        return;
      }

      console.log('Salvando dados no AsyncStorage...');
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, tokenData),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
      ]);
      console.log('Dados salvos com sucesso no AsyncStorage');
    } catch (error) {
      console.error('Erro ao salvar dados de autenticação:', error);
    }
  };

  const clearAuthData = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      console.log('Dados de autenticação limpos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar dados de autenticação:', error);
    }
  };

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    setIsOperationLoading(true);
    try {
      const response = await apiService.login({ email, password, rememberMe });

      console.log('🔍 Resposta completa do backend:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log('✅ Login bem-sucedido');
        console.log('📦 Dados recebidos do backend:', JSON.stringify(response.data, null, 2));
        
        // Adaptar para o formato atual do backend - os dados estão em response.data.data
        const backendData = (response.data as any).data || response.data;
        
        console.log('🔑 Verificando propriedades essenciais:');
        console.log('customToken:', backendData.customToken ? 'PRESENTE' : 'AUSENTE');
        console.log('email:', backendData.email ? 'PRESENTE' : 'AUSENTE');
        console.log('uid:', backendData.uid ? 'PRESENTE' : 'AUSENTE');
        console.log('displayName:', backendData.displayName ? 'PRESENTE' : 'AUSENTE');
        
        // Validar se os dados essenciais existem
        if (!backendData.idToken || !backendData.email || !backendData.uid) {
          console.error('❌ Dados essenciais ausentes:', {
            hasToken: !!backendData.idToken,
            hasEmail: !!backendData.email,
            hasUid: !!backendData.uid,
            receivedData: backendData
          });
          return {
            success: false,
            message: 'Dados de autenticação incompletos recebidos do servidor.',
          };
        }
        
        // Mapear dados do backend para o formato interno do frontend
        const authToken = backendData.idToken;
        const userData: User = {
          id: backendData.uid,
          username: backendData.displayName || backendData.email.split('@')[0],
          email: backendData.email,
        };
        
        console.log('✅ Token extraído:', authToken ? 'VÁLIDO' : 'INVÁLIDO');
        console.log('✅ Dados do usuário mapeados:', userData);
        
        setToken(authToken);
        setUser(userData);
        apiService.setAuthToken(authToken);
        
        // Configurar contexto do Sentry e Logger
        logger.setUserId(userData.id);
        setSentryUser({
          id: userData.id,
          email: userData.email,
          username: userData.username
        });
        
        // SEMPRE salvar dados para manter sessão
        // O "lembrar de mim" controla apenas o tempo de expiração da sessão no backend
        await saveAuthData(authToken, userData);
        
        logger.info('Login realizado com sucesso', { 
          userId: userData.id, 
          rememberMe 
        });

        // Carregar dados em background
        fetchData(userData.id).catch(error => 
          logger.error('Erro ao carregar dados após login', error)
        );

        return { success: true };
      } else {
        return {
          success: false,
          message: response.message || 'Credenciais inválidas',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Erro de conexão. Tente novamente.',
      };
    } finally {
      setIsOperationLoading(false);
    }
  };

  const logout = async () => {
    try {
      logger.info('Logout iniciado', { userId: user?.id });
      
      setUser(null);
      setToken(null);
      apiService.removeAuthToken();
      await clearAuthData();
      clearData();
      
      // Limpar contexto do Sentry e Logger
      logger.setUserId(undefined);
      setSentryUser(null);
      
      logger.info('Logout concluído com sucesso');
    } catch (error) {
      logger.error('Erro durante logout', error as Error);
      console.error('Erro durante logout:', error);
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    setIsOperationLoading(true);
    try {
      const response = await apiService.signup({ email, password, displayName });

      if (response.success) {
        return { success: true };
      } else {
        return {
          success: false,
          message: response.message || 'Erro ao realizar cadastro',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Erro de conexão. Tente novamente.',
      };
    } finally {
      setIsOperationLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsOperationLoading(true);
    try {
      const response = await apiService.forgotPassword({ email });

      if (response.success) {
        return { 
          success: true,
          message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.',
        };
      } else {
        return {
          success: false,
          message: response.message || 'Erro ao enviar e-mail de recuperação',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Erro de conexão. Tente novamente.',
      };
    } finally {
      setIsOperationLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading: isLoading || isOperationLoading,
        isAuthenticated,
        login,
        logout,
        signup,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}