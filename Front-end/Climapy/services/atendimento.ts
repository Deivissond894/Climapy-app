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

      // Extrair dados do response
      // Backend retorna estrutura aninhada:
      // {
      //   data: {
      //     codigo: "Atend-13",
      //     data: { clienteNome, Produto, ... },
      //     message: "...",
      //     success: true
      //   },
      //   success: true
      // }
      
      // Primeiro nível: response.data contém { codigo, data, message, success }
      const firstLevel = response?.data || response;
      
      // Segundo nível: response.data.data contém o objeto real do atendimento
      let rawAtendimento: AtendimentoRaw | undefined = firstLevel?.data;
      
      // Se firstLevel.data não tem clienteNome, pode ser que rawAtendimento está no lugar errado
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
        `/atendimentos/${userId}/${atendimentoId}`,
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

    // Usar lock para evitar race condition
    await lockManager.acquire(cacheKey, async () => {
      try {
        // Pegar lista atual do cache
        const cached = await cacheService.get<AtendimentoRaw[]>({
          key: cacheKey,
          ttl: 5 * 60,
        });

        const currentList = Array.isArray(cached) ? cached : [];
        const novoId = extrairAtendimentoId(atendimento);

        if (!novoId) {
          logger.warn('Atendimento sem ID, não sincronizando', { atendimento });
          return;
        }

        // Filtrar duplicatas (remove se já existe com mesmo ID)
        const filtrado = currentList.filter((item) => extrairAtendimentoId(item) !== novoId);

        // Adicionar novo no topo
        const updated = [atendimento, ...filtrado];

        // Salvar no cache
        await cacheService.set({ key: cacheKey, ttl: 5 * 60 }, updated as any);

        // Atualizar store Zustand
        const { setAtendimentos } = useDataStore.getState();
        setAtendimentos(updated as any);
      } catch (cacheError: any) {
        // Registrar erro mas não lançar - deixar que a operação continue
        logger.error('Erro ao sincronizar atendimento no cache', cacheError, { userId });

        // Tentar atualizar store mesmo se cache falhar
        try {
          const { setAtendimentos } = useDataStore.getState();
          const normalizado = normalizarAtendimento(atendimento);
          if (normalizado) {
            const newList = [atendimento, ...((prevList: any) => {
              return Array.isArray(prevList) ? prevList.filter(
                (item: any) => extrairAtendimentoId(item) !== extrairAtendimentoId(atendimento)
              ) : [];
            })(useDataStore.getState().atendimentos)];
            setAtendimentos(newList as any);
          }
        } catch (storeError: any) {
          logger.error('Erro ao atualizar store após falha de cache', storeError as Error);
        }
      }
    });
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
};
