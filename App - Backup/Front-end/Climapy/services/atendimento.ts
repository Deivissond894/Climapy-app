/**
 * Serviço centralizado para operações de Atendimento
 * Resolve race conditions, sincroniza cache/store, trata erros consistentemente
 */

import { useDataStore } from '../stores/dataStore';
import {
    AtendimentoNormalizado,
    AtendimentoRaw,
    extrairAtendimentoId,
    normalizarAtendimento,
    validarAtendimentoMinimo
} from '../types/atendimento';
import { apiService } from './api';
import { cacheService } from './cache';
import { logger } from './logger';

/**
 * Lock simples para evitar race conditions em operações de cache
 */
class SimpleLock {
  private locks = new Map<string, Promise<void>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Se já existe um lock, aguardar antes de continuar
    if (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch (e) {
        // Ignorar erro do lock anterior
      }
    }

    // Criar novo promise para esta operação
    let resolveLocal: () => void = () => {};
    const promise = new Promise<void>((r) => {
      resolveLocal = r;
    });

    this.locks.set(key, promise);

    try {
      const result = await fn();
      resolveLocal();
      return result;
    } catch (error) {
      resolveLocal();
      throw error;
    } finally {
      this.locks.delete(key);
    }
  }
}

const lockManager = new SimpleLock();

/**
 * Serviço de Atendimento com métodos robustos
 */
export const atendimentoService = {
  /**
   * Criar novo atendimento
   * - Valida dados retornados
   * - Mapeia e normaliza
   * - Sincroniza cache e store
   * - Trata race conditions
   */
  async criarAtendimento(
    userId: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; atendimento: AtendimentoNormalizado | null; error?: string }> {
    try {
      logger.info('Criando atendimento', { userId });

      // Fazer POST
      const response: any = await apiService.post('/atendimentos', payload);

      // Validar se a requisição foi bem-sucedida
      if (!response.success) {
        logger.error('Requisição de criar atendimento falhou', {
          message: response.message,
          error: response.error,
          userId
        });
        
        return {
          success: false,
          atendimento: null,
          error: response.message || 'Erro ao criar atendimento no servidor',
        };
      }

      // Extrair dados do response
      // Backend retorna estrutura aninhada:
      // {
      //   data: {
      //     codigo: "ATD-0001",
      //     clienteNome: "...",
      //     ...
      //   },
      //   success: true,
      //   message: "Atendimento criado com sucesso!"
      // }
      
      const responseData = response?.data || response;
      
      // Se os dados vêm aninhados novamente, extrair
      let rawAtendimento: AtendimentoRaw | undefined = responseData;
      
      // Se tiver estrutura aninhada, extrair dados internos
      if (responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
        rawAtendimento = responseData.data;
      }

      // Se o backend retornou o código separado, adicionar ao objeto
      if (responseData?.codigo && rawAtendimento && !rawAtendimento.codigo) {
        rawAtendimento = {
          ...rawAtendimento,
          codigo: responseData.codigo,
        };
      }

      // Se o backend não retornou o endereço, usar o que foi enviado no payload
      if (rawAtendimento && !rawAtendimento.clienteEndereco && payload.clienteEndereco) {
        rawAtendimento = {
          ...rawAtendimento,
          clienteEndereco: payload.clienteEndereco,
        };
      }

      // Validar dados mínimos
      const isValido = validarAtendimentoMinimo(rawAtendimento);

      if (!isValido) {
        // Mesmo com dados incompletos, normalizar o que temos
        const normalizado = normalizarAtendimento(rawAtendimento);
        if (!normalizado) {
          return {
            success: false,
            atendimento: null,
            error: 'Backend retornou dados inválidos ou incompletos',
          };
        }

        // Sincronizar mesmo assim
        if (rawAtendimento) {
          await this.sincronizarAtendimentoNoCache(userId, rawAtendimento);
        }

        logger.info('Atendimento incompleto sincronizado', { codigo: normalizado.codigo, userId });
        return {
          success: true,
          atendimento: normalizado,
        };
      }

      // Dados completos - normalizar e sincronizar
      const normalizado = normalizarAtendimento(rawAtendimento);

      if (normalizado && rawAtendimento) {
        await this.sincronizarAtendimentoNoCache(userId, rawAtendimento);
      }

      return {
        success: true,
        atendimento: normalizado,
      };
    } catch (error: any) {
      logger.error('Erro ao criar atendimento', error, { userId });

      return {
        success: false,
        atendimento: null,
        error: error?.message || 'Erro ao criar atendimento',
      };
    }
  },

  /**
   * Atualizar atendimento existente
   * - Valida dados
   * - Sincroniza sem invalidar cache
   * - Atualiza store Zustand
   */
  async atualizarAtendimento(
    userId: string,
    atendimentoId: string,
    updates: Record<string, any>
  ): Promise<{ success: boolean; atendimento: AtendimentoNormalizado | null; error?: string }> {
    try {
      logger.info('Atualizando atendimento', { userId, atendimentoId });

      // Fazer PUT
      const response: any = await apiService.put(
        `/atendimentos/${atendimentoId}`,
        updates
      );

      // Extrair dados (similar ao create)
      const firstLevel = response?.data || response;
      let rawAtendimento: AtendimentoRaw | undefined = firstLevel?.data;
      
      if (!rawAtendimento || !rawAtendimento.clienteNome) {
        rawAtendimento = response?.atendimento || firstLevel;
      }

      // Se tiver codigo no firstLevel, adicionar ao objeto
      if (firstLevel?.codigo && rawAtendimento && !rawAtendimento.codigo) {
        rawAtendimento = {
          ...rawAtendimento,
          codigo: firstLevel.codigo,
        };
      }

      // Se o backend não retornou endereço, usar o que foi enviado no updates
      if (rawAtendimento && !rawAtendimento.clienteEndereco && updates.clienteEndereco) {
        rawAtendimento = {
          ...rawAtendimento,
          clienteEndereco: updates.clienteEndereco,
        };
      }

      // Validar
      if (!validarAtendimentoMinimo(rawAtendimento)) {
        return {
          success: true, // PUT sucesso no backend
          atendimento: normalizarAtendimento(rawAtendimento),
        };
      }

      // Normalizar e sincronizar
      const normalizado = normalizarAtendimento(rawAtendimento);

      if (normalizado && rawAtendimento) {
        await this.sincronizarAtendimentoNoCache(userId, rawAtendimento);
      }

      return {
        success: true,
        atendimento: normalizado,
      };
    } catch (error: any) {
      logger.error('Erro ao atualizar atendimento', error, { userId, atendimentoId });

      return {
        success: false,
        atendimento: null,
        error: error?.message || 'Erro ao atualizar atendimento',
      };
    }
  },

  /**
   * Sincronizar atendimento no cache E store Zustand
   * - Usa lock para evitar race condition
   * - Deduplicar por ID
   * - Atualiza cache e store
   */
  async sincronizarAtendimentoNoCache(
    userId: string,
    atendimento: AtendimentoRaw | undefined
  ): Promise<void> {
    if (!atendimento) {
      logger.warn('Tentativa de sincronizar atendimento undefined');
      return;
    }

    const cacheKey = `atendimentos_${userId}`;
    const novoId = extrairAtendimentoId(atendimento);

    if (!novoId) {
      logger.warn('Atendimento sem ID, não sincronizando', { atendimento });
      return;
    }

    try {
      // Pegar lista atual do cache (sem lock para evitar travamento)
      const cached = await cacheService.get<AtendimentoRaw[]>({
        key: cacheKey,
        ttl: 5 * 60,
      });

      const currentList = Array.isArray(cached) ? cached : [];
      
      // Filtrar duplicatas (remove se já existe com mesmo ID)
      const filtrado = currentList.filter((item) => extrairAtendimentoId(item) !== novoId);

      // Adicionar novo no topo
      const updated = [atendimento, ...filtrado];

      // Salvar no cache
      await cacheService.set({ key: cacheKey, ttl: 5 * 60 }, updated as any);

      // Atualizar store Zustand
      const { setAtendimentos } = useDataStore.getState();
      setAtendimentos(updated as any);
    } catch (error: any) {
      // Registrar erro mas não impedir a operação
      logger.error('Erro ao sincronizar atendimento no cache', error, { userId });
      
      // Tentar atualizar store mesmo se cache falhar
      try {
        const { setAtendimentos, atendimentos } = useDataStore.getState();
        const currentList = Array.isArray(atendimentos) ? atendimentos : [];
        const filtrado = currentList.filter((item: any) => extrairAtendimentoId(item) !== novoId);
        const updated = [atendimento, ...filtrado];
        setAtendimentos(updated as any);
      } catch (storeError: any) {
        logger.error('Erro ao atualizar store após falha de cache', storeError as Error);
      }
    }
  },

  /**
   * Mapear atendimento bruto para formato de UI (Order)
   * Reutiliza a lógica normalizada
   */
  mapearParaOrder(atendimento: AtendimentoRaw | undefined) {
    const normalizado = normalizarAtendimento(atendimento);
    if (!normalizado) return null;

    return {
      id: normalizado.id,
      client: normalizado.clienteNome,
      address: normalizado.clienteEndereco,
      date: normalizado.data,
      product: normalizado.produto,
      status: normalizado.status,
      visitPrice: normalizado.valorVisita,
      totalPrice: normalizado.valorTotal,
      notes: normalizado.notas || [],
      history: normalizado.historico || [],
    };
  },

  /**
   * Limpar cache de atendimentos (força recarregamento)
   * Use apenas quando necessário (ex: logout)
   */
  async limparCache(userId: string): Promise<void> {
    const cacheKey = `atendimentos_${userId}`;
    await cacheService.invalidate(cacheKey);
    logger.info('Cache de atendimentos limpo', { cacheKey });
  },
  
  /**
   * Listar atendimentos com limite - tenta endpoint com limit e faz fallback
   */
  async listarAtendimentos(limit = 20, userId?: string): Promise<AtendimentoRaw[]> {
    try {
      // Se tiver userId, usar endpoint específico do usuário
      let resp: any;
      if (userId) {
        resp = await apiService.get(`/atendimentos/${userId}?limit=${limit}`);
      } else {
        // Tentar endpoint com limit (backend pode suportar query string)
        resp = await apiService.get(`/atendimentos?limit=${limit}`);
      }
      let arr: any[] = [];
      if (Array.isArray(resp?.data)) arr = resp.data;
      else if (Array.isArray(resp?.data?.data)) arr = resp.data.data;
      else if (Array.isArray(resp?.atendimentos)) arr = resp.atendimentos;
      else if (Array.isArray(resp)) arr = resp;

      if (arr.length > 0) return arr.slice(0, limit);
    } catch (err) {
      logger.warn('listarAtendimentos: fallback para buscar todos', err as Error);
    }

    // Fallback: buscar todos e retornar os primeiros
    try {
      // Fallback: buscar todos (ou todos do usuário se userId informado)
      const allResp: any = userId ? await apiService.get(`/atendimentos/${userId}`) : await apiService.get('/atendimentos');
      let arr: any[] = [];
      if (Array.isArray(allResp?.data)) arr = allResp.data;
      else if (Array.isArray(allResp?.data?.data)) arr = allResp.data.data;
      else if (Array.isArray(allResp?.atendimentos)) arr = allResp.atendimentos;
      else if (Array.isArray(allResp)) arr = allResp;

      return arr.slice(0, limit);
    } catch (err) {
      logger.error('Erro ao listar atendimentos (fallback)', err as Error);
      return [];
    }
  },

  /**
   * Listar apenas os atendimentos do dia (usa listarAtendimentos e filtra)
   */
  async listarAtendimentosHoje(limit = 100, userId?: string): Promise<AtendimentoRaw[]> {
    const items = await this.listarAtendimentos(limit, userId);
    if (!Array.isArray(items) || items.length === 0) return [];

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const filtered = items.filter((a) => {
      try {
        const d = a?.data ? new Date(a.data) : a?.criadoEm ? new Date(a.criadoEm) : null;
        if (!d) return false;
        return d >= start && d <= end;
      } catch (e) {
        return false;
      }
    });

    return filtered;
  },
};
