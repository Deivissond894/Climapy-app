import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
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

// Interface para tipagem dos dados do cliente (baseada na resposta da API)
interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  documento: string; // CPF
  telefone: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  referencia?: string;
  observacoes?: string;
  criadoEm?: any;
}

const ClientPanel: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [menuVisivel, setMenuVisivel] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [clienteExcluido, setClienteExcluido] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAvaliacaoModal, setShowAvaliacaoModal] = useState(false);

  // Debounce da busca para evitar chamadas excessivas
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
      metrics.trackTime('fetch_clientes', startTime);
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

  // useEffect para carregar clientes ao montar o componente
  useEffect(() => {
    fetchClientes();
  }, [user?.id]);

  // useFocusEffect para atualizar os dados sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      // Recarregar dados quando a tela ganhar foco
      fetchClientes();
    }, [user?.id])
  );

  // Função para abrir/fechar menu de ações do cliente
  const toggleMenu = (clienteId: string, clienteIndex: number, event?: any) => {
    if (menuVisivel === clienteId) {
      setMenuVisivel(null);
    } else {
      setMenuVisivel(clienteId);
      // Posicionar o menu próximo ao botão clicado
      if (event?.nativeEvent) {
        const { pageX, pageY } = event.nativeEvent;
        const isLastCard = clienteIndex === filteredClientes.length - 1;
        const menuHeight = 280; // Altura aproximada do menu (5 itens × 56px cada)
        const screenHeight = height;
        
        // Verificar se é o último card ou se o menu sairia da tela
        const shouldOpenAbove = isLastCard || (pageY + menuHeight > screenHeight - 100);
        
        setMenuPosition({ 
          x: Math.max(10, Math.min(pageX - 160, width - 190)), // Ajustar para não sair da tela
          y: shouldOpenAbove ? pageY - menuHeight - 10 : pageY + 10
        });
      }
    }
  };

  // Funções para ações do cliente
  const iniciarOS = (cliente: Cliente) => {
    setMenuVisivel(null);
    Alert.alert('Iniciar O.S.', `Iniciando Ordem de Serviço para: ${cliente.nome}`);
    // Aqui seria a navegação para criar uma nova O.S.
    // router.push(`/os/nova?clienteId=${cliente.id}`);
  };

  const editarCliente = (cliente: Cliente) => {
    setMenuVisivel(null);
    // Navegar para a tela de cliente com os dados para edição
    router.push({
      pathname: '/client',
      params: {
        editMode: 'true',
        clienteId: cliente.id,
        nome: cliente.nome,
        documento: cliente.documento,
        telefone: cliente.telefone,
        email: cliente.email,
        cep: cliente.cep,
        rua: cliente.rua,
        numero: cliente.numero,
        referencia: cliente.referencia || '',
        observacoes: cliente.observacoes || '',
      }
    });
  };

  const avaliarCliente = (cliente: Cliente) => {
    setMenuVisivel(null);
    setShowAvaliacaoModal(true);
  };

  const conversarNoWhatsApp = (cliente: Cliente) => {
    setMenuVisivel(null);
    
    // Obter apenas o primeiro nome do cliente
    const primeiroNome = cliente.nome.split(' ')[0];
    
    // Limpar o número de telefone (remover espaços, parênteses, hífens, etc.)
    const numeroLimpo = cliente.telefone.replace(/\D/g, '');
    
    // Criar a URL do WhatsApp
    const urlWhatsApp = `https://wa.me/${numeroLimpo}`;
    
    // Tentar abrir o WhatsApp
    Linking.canOpenURL(urlWhatsApp)
      .then((supported) => {
        if (supported) {
          Linking.openURL(urlWhatsApp);
        } else {
          Alert.alert(
            'WhatsApp não encontrado',
            'Não foi possível abrir o WhatsApp. Verifique se o aplicativo está instalado.'
          );
        }
      })
      .catch((error) => {
        console.error('Erro ao abrir WhatsApp:', error);
        Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
      });
  };

  const excluirCliente = (cliente: Cliente) => {
    setMenuVisivel(null);
    setClienteParaExcluir(cliente);
    setShowDeleteModal(true);
  };

  const confirmarExclusao = async () => {
    if (!clienteParaExcluir || !user?.id) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`https://back-end-falling-shadow-6301.fly.dev/clientes/${user.id}/${clienteParaExcluir.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Guardar nome do cliente excluído
      setClienteExcluido(clienteParaExcluir.nome);
      
      // Remover cliente da lista local imediatamente
      setClientes(prev => prev.filter(c => c.id !== clienteParaExcluir.id));
      
      // Fechar modal de confirmação
      setShowDeleteModal(false);
      setClienteParaExcluir(null);
      
      // Mostrar modal de sucesso
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      Alert.alert('Erro', 'Não foi possível excluir o cliente. Verifique sua conexão e tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelarExclusao = () => {
    setShowDeleteModal(false);
    setClienteParaExcluir(null);
  };

  const fecharModalSucesso = () => {
    setShowSuccessModal(false);
    setClienteExcluido('');
  };

  const fecharModalAvaliacao = () => {
    setShowAvaliacaoModal(false);
  };

  const pesquisarCliente = () => {
    Alert.alert('Pesquisar', 'Função de pesquisa será implementada');
  };

  const abrirMenu = () => {
    Alert.alert('Menu', 'Menu de opções será implementado');
  };

  const adicionarCliente = () => {
    router.push('/client');
  };

  const voltar = () => {
    router.back();
  };

  const recarregarClientes = () => {
    fetchClientes(true); // Force refresh
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
        <Text style={styles.title}>Clientes</Text>
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
          <ActivityIndicator size="large" color="#2E5BBA" />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={recarregarClientes}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : clientes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#BDC3C7" />
          <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
          <Text style={styles.emptyMessage}>Comece cadastrando seu primeiro cliente</Text>
          <TouchableOpacity style={styles.addFirstClientButton} onPress={adicionarCliente}>
            <Text style={styles.addFirstClientButtonText}>Cadastrar Cliente</Text>
          </TouchableOpacity>
        </View>
      ) : filteredClientes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#BDC3C7" />
          <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
          <Text style={styles.emptyMessage}>Tente uma pesquisa diferente</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClientes}
          keyExtractor={(item) => item.id}
          renderItem={({ item: cliente, index }) => (
            <View 
              style={[
                styles.clienteCard,
                menuVisivel === cliente.id && styles.clienteCardActive
              ]}
            >
              <TouchableOpacity 
                style={styles.clienteCardContent}
                onPress={() => editarCliente(cliente)}
                activeOpacity={0.7}
              >
                <View style={styles.clienteInfo}>
                  {/* Header com Nome e Código do Cliente */}
                  <View style={styles.clienteHeader}>
                    <Text style={styles.clienteNome}>Nome: {cliente.nome}</Text>
                    <Text style={styles.clienteCodigo}>Cliente código: {cliente.id}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CPF:</Text>
                    <Text style={styles.infoValue}>{cliente.documento}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tel:</Text>
                    <Text style={styles.infoValue}>{cliente.telefone}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Logradouro:</Text>
                    <Text style={styles.infoValue}>
                      {cliente.rua && cliente.numero ? `${cliente.rua}, ${cliente.numero}` : 'Não informado'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.clienteActions}>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleMenu(cliente.id, index, event);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#666666" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}

      {/* Botão flutuante para adicionar cliente */}
      <TouchableOpacity
        style={styles.fab}
        onPress={adicionarCliente}
      >
        <LinearGradient
          colors={['#1BAFE0', '#7902E0']}
          style={styles.fabGradient}
        >
          <Ionicons 
            name="add" 
            size={28} 
            color="white" 
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* Menu de ações popup */}
      {menuVisivel && (
        <Pressable 
          style={styles.fullScreenOverlay}
          onPress={() => setMenuVisivel(null)}
        >
          <View style={[styles.actionMenu, { 
            left: Math.max(10, Math.min(menuPosition.x, width - 190)), 
            top: Math.max(100, menuPosition.y) 
          }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const cliente = clientes.find(c => c.id === menuVisivel);
                if (cliente) iniciarOS(cliente);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Iniciar uma O.S</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const cliente = clientes.find(c => c.id === menuVisivel);
                if (cliente) editarCliente(cliente);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const cliente = clientes.find(c => c.id === menuVisivel);
                if (cliente) avaliarCliente(cliente);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="star-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Avaliação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const cliente = clientes.find(c => c.id === menuVisivel);
                if (cliente) conversarNoWhatsApp(cliente);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#111" />
              <Text style={styles.actionText}>
                Conversar com {clientes.find(c => c.id === menuVisivel)?.nome.split(' ')[0]}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => {
                const cliente = clientes.find(c => c.id === menuVisivel);
                if (cliente) excluirCliente(cliente);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="red" />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* Modal de confirmação de exclusão */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelarExclusao}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={cancelarExclusao}
        >
          <Pressable style={styles.deleteModalContainer}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
            </View>
            
            <Text style={styles.deleteModalTitle}>Excluir Cliente</Text>
            <Text style={styles.deleteModalMessage}>
              Tem certeza que deseja excluir{'\n'}
              <Text style={styles.deleteModalClientName}>{clienteParaExcluir?.nome}</Text>?
            </Text>
            <Text style={styles.deleteModalWarning}>
              Esta ação não pode ser desfeita.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={cancelarExclusao}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]} 
                onPress={confirmarExclusao}
                activeOpacity={0.8}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de sucesso na exclusão */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModalSucesso}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={fecharModalSucesso}
        >
          <Pressable style={styles.successModalContainer}>
            <View style={styles.successModalHeader}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
            </View>
            
            <Text style={styles.successModalTitle}>Cliente Excluído!</Text>
            <Text style={styles.successModalMessage}>
              <Text style={styles.successModalClientName}>{clienteExcluido}</Text>
              {'\n'}foi removido com sucesso.
            </Text>
            
            <TouchableOpacity 
              style={styles.successButton} 
              onPress={fecharModalSucesso}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Avaliação em Desenvolvimento */}
      <Modal
        visible={showAvaliacaoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModalAvaliacao}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={fecharModalAvaliacao}
        >
          <Pressable style={styles.avaliacaoModalContainer}>
            <View style={styles.avaliacaoModalHeader}>
              <View style={styles.avaliacaoIconContainer}>
                <Ionicons name="construct-outline" size={80} color="#F59E0B" />
              </View>
            </View>
            
            <Text style={styles.avaliacaoModalTitle}>Em Desenvolvimento</Text>
            <Text style={styles.avaliacaoModalMessage}>
              A funcionalidade de avaliação de clientes ainda está sendo desenvolvida e estará disponível em breve.
            </Text>
            <Text style={styles.avaliacaoModalSubMessage}>
              Fique atento às próximas atualizações!
            </Text>
            
            <TouchableOpacity 
              style={styles.avaliacaoButton} 
              onPress={fecharModalAvaliacao}
              activeOpacity={0.8}
            >
              <Text style={styles.avaliacaoButtonText}>Entendi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: 15, // Reduzido para aproximar do campo de busca
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
    paddingTop: 0, // Removido espaçamento superior
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#F5F7FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    marginTop: 0, // Sem espaço superior para aproximar do título
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
    padding: 20, // Aumentado de 16 para 20
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start', // Mudado de 'center' para 'flex-start'
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    minHeight: 120, // Altura mínima garantida
    zIndex: 1,
  },
  clienteCardContent: {
    flex: 1,
    marginRight: 12,
  },
  clienteCardActive: {
    zIndex: 9998,
    elevation: 19,
  },
  clienteInfo: {
    flex: 1,
  },
  clienteHeader: {
    flexDirection: 'column', // Mudado para coluna para evitar quebra
    marginBottom: 12, // Aumentado espaçamento
    width: '100%',
  },
  clienteNome: {
    fontSize: 18, // Aumentado de 16 para 18
    fontWeight: '700',
    color: '#111',
    marginBottom: 4, // Espaço entre nome e código
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
  clienteActions: {
    position: 'relative',
  },
  menuButton: {
    padding: 10,
    borderRadius: 15,
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  actionMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
    minWidth: 180,
    zIndex: 10000,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  actionItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 5,
    paddingTop: 15,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    marginLeft: 10,
  },
  actionTextDanger: {
    color: 'red',
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
  addFirstClientButton: {
    backgroundColor: '#6C4CF7',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addFirstClientButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos do Modal de Exclusão
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 350,
    width: '100%',
  },
  deleteModalHeader: {
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 15,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  deleteModalClientName: {
    fontWeight: 'bold',
    color: '#111',
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonDisabled: {
    backgroundColor: '#F87171',
    opacity: 0.7,
  },
  // Estilos do Modal de Sucesso
  successModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 350,
    width: '100%',
  },
  successModalHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  successIconContainer: {
    backgroundColor: '#F0FDF4',
    padding: 20,
    borderRadius: 50,
    marginBottom: 10,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 15,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  successModalClientName: {
    fontWeight: 'bold',
    color: '#111',
  },
  successButton: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos do Modal de Avaliação
  avaliacaoModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 350,
    width: '100%',
  },
  avaliacaoModalHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  avaliacaoIconContainer: {
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 50,
    marginBottom: 10,
  },
  avaliacaoModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 15,
    textAlign: 'center',
  },
  avaliacaoModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  avaliacaoModalSubMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  avaliacaoButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  avaliacaoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ClientPanel;
