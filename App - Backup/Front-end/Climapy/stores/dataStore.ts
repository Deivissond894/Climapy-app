import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiService } from '../services/api';

interface Atendimento {
  id: string;
  [key: string]: any;
}

interface Cliente {
  id: string;
  [key: string]: any;
}

interface DataStore {
  atendimentos: Atendimento[];
  clientes: Cliente[];
  isLoading: boolean;
  lastFetch: number | null;
  atendimentosCache: any[];
  atendimentosCachedAt: number | null;
  atendimentosTTL?: number;
  
  setAtendimentos: (atendimentos: Atendimento[]) => void;
  setClientes: (clientes: Cliente[]) => void;
  setLoading: (loading: boolean) => void;
  fetchAtendimentosCached: (userId: string, limit?: number, force?: boolean) => Promise<void>;
  getAtendimentosHoje: () => Atendimento[];
  fetchToday: (userId: string, force?: boolean) => Promise<void>;
  fetchData: (userId: string) => Promise<void>;
  clearData: () => void;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      atendimentos: [],
      clientes: [],
      isLoading: false,
      lastFetch: null,
  atendimentosCache: [],
  atendimentosCachedAt: null,
  atendimentosTTL: 5 * 60 * 1000, // 5 minutos

      setAtendimentos: (atendimentos) => set({ atendimentos }),
      setClientes: (clientes) => set({ clientes }),
      setLoading: (loading) => set({ isLoading: loading }),

      fetchAtendimentosCached: async (userId: string, limit = 20, force = false) => {
        const { atendimentosCache, atendimentosCachedAt, atendimentosTTL } = get();
        const now = Date.now();

        if (!force && atendimentosCache && atendimentosCache.length > 0 && atendimentosCachedAt && (now - atendimentosCachedAt) < (atendimentosTTL || 5 * 60 * 1000)) {
          // cache válido
          return;
        }

        set({ isLoading: true });
        try {
          // importar dinamicamente para evitar loop circular
          const { atendimentoService } = await import('../services/atendimento');
          const items = await atendimentoService.listarAtendimentos(limit, userId);
          if (Array.isArray(items)) {
            set({ atendimentosCache: items, atendimentosCachedAt: Date.now() });
            // Se a lista principal não estiver populada, popular para que telas como os-panel possam usar imediatamente
            const current = get();
            if (!current.atendimentos || current.atendimentos.length === 0) {
              // Items vem do backend e pode não ter o id exatamente como string; cast para any para evitar erro de tipagem
              set({ atendimentos: items as any });
            }
          }
        } catch (error) {
          console.error('Erro ao buscar atendimentos (cached):', error);
        } finally {
          set({ isLoading: false });
        }
      },

      getAtendimentosHoje: () => {
        const { atendimentosCache } = get();
        if (!Array.isArray(atendimentosCache) || atendimentosCache.length === 0) return [];

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        return atendimentosCache.filter((a: any) => {
          try {
            const d = a?.data ? new Date(a.data) : a?.criadoEm ? new Date(a.criadoEm) : null;
            if (!d) return false;
            return d >= start && d <= end;
          } catch (e) {
            return false;
          }
        });
      },

      fetchToday: async (userId: string, force = false) => {
        const { atendimentosCache, atendimentosCachedAt, atendimentosTTL } = get();
        const now = Date.now();

        // Validar cache
        if (!force && atendimentosCache && atendimentosCache.length > 0 && atendimentosCachedAt && (now - atendimentosCachedAt) < (atendimentosTTL || 5 * 60 * 1000)) {
          // Cache válido, apenas retornar os de hoje
          return;
        }

        set({ isLoading: true });
        try {
          // Buscar atendimentos dinamicamente
          const { atendimentoService } = await import('../services/atendimento');
          
          // Buscar todos os atendimentos (backend filtrará se possível)
          const items = await atendimentoService.listarAtendimentos(100, userId);
          
          if (Array.isArray(items)) {
            // Armazenar todos em cache
            set({ atendimentosCache: items, atendimentosCachedAt: Date.now() });
            
            // Também popular o array principal com os de hoje
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const atendimentosHoje = items.filter((a: any) => {
              try {
                const d = a?.data ? new Date(a.data) : a?.criadoEm ? new Date(a.criadoEm) : null;
                if (!d) return false;
                return d >= start && d <= end;
              } catch (e) {
                return false;
              }
            });

            set({ atendimentos: atendimentosHoje as any });
          }
        } catch (error) {
          console.error('Erro ao buscar atendimentos de hoje:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchData: async (userId: string) => {
        const { lastFetch } = get();
        const now = Date.now();
        
        if (lastFetch && now - lastFetch < 5 * 60 * 1000) {
          return;
        }

        set({ isLoading: true });

        try {
          const [atendimentosRes, clientesRes] = await Promise.all([
            apiService.get(`/atendimentos/${userId}`),
            apiService.get(`/clientes/${userId}`)
          ]);

          const aRes: any = atendimentosRes;
          const cRes: any = clientesRes;
          const atendimentosData = aRes.data?.data || aRes.data?.atendimentos || aRes.data || [];
          const clientesData = cRes.data?.data || cRes.data?.clientes || cRes.data || [];

          set({
            atendimentos: Array.isArray(atendimentosData) ? atendimentosData : [],
            clientes: Array.isArray(clientesData) ? clientesData : [],
            lastFetch: now,
            isLoading: false,
          });
        } catch (error) {
          console.error('Erro ao buscar dados na store:', error);
          set({ isLoading: false });
        }
      },

      clearData: () =>
        set({
          atendimentos: [],
          clientes: [],
          lastFetch: null,
          isLoading: false,
        }),
    }),
    {
      name: 'climapy-data-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
