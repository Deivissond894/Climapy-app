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
        
        if (lastFetch && now - lastFetch < 5 * 60 * 1000) {
          return;
        }

        set({ isLoading: true });

        try {
          const [atendimentosRes, clientesRes] = await Promise.all([
            apiService.get(`/atendimentos/${userId}`),
            apiService.get(`/clientes/${userId}`)
          ]);

          const atendimentosData = atendimentosRes.data?.data || atendimentosRes.data?.atendimentos || atendimentosRes.data || [];
          const clientesData = clientesRes.data?.data || clientesRes.data?.clientes || clientesRes.data || [];

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
