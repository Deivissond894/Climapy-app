import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
          // Buscar atendimentos
          const atendimentosRes = await fetch(
            `https://back-end-restless-darkness-2411.fly.dev/atendimentos/${userId}`
          );
          
          let atendimentosData: any = {};
          if (atendimentosRes.ok) {
            atendimentosData = await atendimentosRes.json();
          }

          // Buscar clientes
          const clientesRes = await fetch(
            `https://back-end-restless-darkness-2411.fly.dev/clientes/${userId}`
          );
          
          let clientesData: any = {};
          if (clientesRes.ok) {
            clientesData = await clientesRes.json();
          }

          set({
            atendimentos: atendimentosData.data || [],
            clientes: clientesData.data || [],
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
