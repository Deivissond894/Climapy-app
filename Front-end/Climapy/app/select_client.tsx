import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { cacheService } from '../services/cache';
import { metrics } from '../services/metrics';
import { useDebounce } from '../hooks/useDebounce';

const { width, height } = Dimensions.get('window');

interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  referencia?: string;
  observacoes?: string;
  criadoEm?: any;
}

const SelectClientScreen: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Debounce da busca
  const debouncedQuery = useDebounce(query, 300);

  // Função para buscar clientes da API com cache
  const fetchClientes = async (forceRefresh = false) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      setIsLoading(false);
      return;
    }

    const startTime = Date.now();

    try {
      setIsLoading(true);
      setError(null);

      // Tentar buscar do cache primeiro
      if (!forceRefresh) {
        const cached = await cacheService.get<Cliente[]>({
          key: `clientes_${user.id}`,
          ttl: 300 // 5 minutos
        });

        if (cached) {
          setClientes(cached);
          setIsLoading(false);
          // Buscar atualização em background
          fetchClientesFromServer();
          return;
        }
      }

      // Buscar do servidor
      await fetchClientesFromServer();
      
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      setError('Erro ao carregar clientes. Tente novamente.');
    } finally {
      setIsLoading(false);
      metrics.trackTime('fetch_clientes_select', startTime);
    }
  };

  // Função auxiliar para buscar do servidor
  const fetchClientesFromServer = async () => {
    if (!user?.id) return;

    const response = await fetch(`https://back-end-falling-shadow-6301.fly.dev/clientes/${user.id}`);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.data && Array.isArray(data.data)) {
      setClientes(data.data);
      // Salvar no cache
      await cacheService.set(
        { key: `clientes_${user.id}`, ttl: 300 },
        data.data
      );
    } else {
      setClientes([]);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, [user?.id]);

  const voltar = () => {
    router.back();
  };

  const selecionarCliente = (cliente: Cliente) => {
    // Montar endereço completo
    const enderecoCompleto = `${cliente.rua}, ${cliente.numero}${cliente.referencia ? ` - ${cliente.referencia}` : ''} - CEP: ${cliente.cep}`;
    
    // Navegar de volta para new_atend.tsx com os dados completos do cliente
    router.push({
      pathname: '/new_atend',
      params: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        clienteCodigo: cliente.codigo,
        clienteCPF: cliente.documento,
        clienteTelefone: cliente.telefone,
        clienteEmail: cliente.email,
        clienteEndereco: enderecoCompleto,
      }
    });
  };

  const recarregarClientes = () => {
    fetchClientes(true); // Force refresh
  };

  const adicionarNovoCliente = () => {
    console.log('select_client - Navegando para cadastro de cliente');
    // Navegar para a tela de cadastro de cliente com parâmetro indicando origem
    router.push({
      pathname: '/client',
      params: {
        fromSelectClient: 'true'
      }
    });
  };

  // Filtrar clientes baseado na pesquisa debounced
  const filteredClientes = clientes.filter(cliente => {
    const matchesQuery = debouncedQuery.trim() === '' || 
      cliente.nome.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
      cliente.documento.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      cliente.telefone.toLowerCase().includes(debouncedQuery.toLowerCase());
    return matchesQuery;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={voltar}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Selecionar Cliente</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Barra de pesquisa */}
      <View style={styles.controls}>
        <TextInput
          placeholder="Buscar por nome, CPF ou telefone..."
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>

      {/* Lista de clientes */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C4CF7" />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={recarregarClientes}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : clientes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Nenhum cliente cadastrado</Text>
          <Text style={styles.emptyMessage}>
            Você ainda não possui clientes cadastrados. Cadastre seu primeiro cliente para começar!
          </Text>
        </View>
      ) : filteredClientes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyMessage}>Nenhum cliente encontrado com esse critério de busca.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClientes}
          keyExtractor={(item) => item.id}
          renderItem={({ item: cliente }) => (
            <TouchableOpacity
              style={styles.clienteCard}
              onPress={() => selecionarCliente(cliente)}
              activeOpacity={0.7}
            >
              <View style={styles.clienteCardContent}>
                <View style={styles.clienteInfo}>
                  <View style={styles.clienteHeader}>
                    <Text style={styles.clienteNome}>{cliente.nome}</Text>
                    <Text style={styles.clienteCodigo}>Código: {cliente.codigo}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CPF:</Text>
                    <Text style={styles.infoValue}>{cliente.documento}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Telefone:</Text>
                    <Text style={styles.infoValue}>{cliente.telefone}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Endereço:</Text>
                    <Text style={styles.infoValue}>
                      {cliente.rua}, {cliente.numero} - CEP: {cliente.cep}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.selectIcon}>
                <Ionicons name="chevron-forward" size={24} color="#6C4CF7" />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={adicionarNovoCliente}
      >
        <LinearGradient
          colors={['#1BAFE0', '#7902E0']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 30,
    paddingBottom: 15,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#F5F7FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    marginTop: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  clienteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    minHeight: 120,
  },
  clienteCardContent: {
    flex: 1,
    marginRight: 12,
  },
  clienteInfo: {
    flex: 1,
  },
  clienteHeader: {
    flexDirection: 'column',
    marginBottom: 12,
    width: '100%',
  },
  clienteNome: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  clienteCodigo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginRight: 8,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    flex: 1,
    lineHeight: 18,
  },
  selectIcon: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C4CF7',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#6C4CF7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SelectClientScreen;
