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
  
  setAtendimentos: (atendimentos: Atendimento[]) => void;
  setClientes: (clientes: Cliente[]) => void;
  setLoading: (loading: boolean) => void;
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

      setAtendimentos: (atendimentos) => set({ atendimentos }),
      setClientes: (clientes) => set({ clientes }),
      setLoading: (loading) => set({ isLoading: loading }),

      fetchData: async (userId: string) => {
        const { lastFetch } = get();
        const now = Date.now();
        
        // Cache de 5 minutos
        if (lastFetch && now - lastFetch < 5 * 60 * 1000) {
          return;
        }

        set({ isLoading: true });

        try {
          // Buscar atendimentos usando apiService (já inclui Token e Retentativas)
          const atendimentosRes = await apiService.get(`/atendimentos/user/${userId}`);

          // Buscar clientes
          const clientesRes = await apiService.get(`/clientes/user/${userId}`);

          set({
            atendimentos: atendimentosRes.data?.atendimentos || atendimentosRes.data || [],
            clientes: clientesRes.data?.clientes || clientesRes.data || [],
            lastFetch: now,
            isLoading: false,
          });
        } catch (error) {
          console.error('Erro ao buscar dados:', error);
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
