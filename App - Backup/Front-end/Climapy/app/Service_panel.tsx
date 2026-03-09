import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

// Interface para tipagem dos dados do serviço
interface Servico {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: string;
  tempo_estimado: string;
  materiais?: string;
  observacoes?: string;
  criadoEm?: any;
}

const ServicePanel: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [menuVisivel, setMenuVisivel] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [servicoParaExcluir, setServicoParaExcluir] = useState<Servico | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [servicoExcluido, setServicoExcluido] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);

// Dados mockados para demonstração (posteriormente integrar com API)
const servicosMock: Servico[] = [
    {
      id: '1',
      codigo: 'SRV001',
      nome: 'Limpeza de Ar Condicionado Split',
      descricao: 'Limpeza completa do ar condicionado incluindo filtros e serpentina',
      categoria: 'Limpeza',
      preco: '150.00',
      tempo_estimado: '2 horas',
      materiais: 'Produtos de limpeza, flanelas, escova',
      observacoes: 'Verificar estado dos filtros',
      criadoEm: new Date()
    },
    {
      id: '2',
      codigo: 'SRV002',
      nome: 'Instalação de Ar Condicionado',
      descricao: 'Instalação completa de aparelho de ar condicionado split',
      categoria: 'Instalação',
      preco: '300.00',
      tempo_estimado: '4 horas',
      materiais: 'Tubulação, suporte, parafusos, fita isolante',
      observacoes: 'Verificar estrutura da parede',
      criadoEm: new Date()
    },
    {
      id: '3',
      codigo: 'SRV003',
      nome: 'Manutenção Preventiva',
      descricao: 'Manutenção preventiva completa do sistema de climatização',
      categoria: 'Manutenção',
      preco: '200.00',
      tempo_estimado: '3 horas',
      materiais: 'Óleo, filtros, produtos de limpeza',
      observacoes: 'Verificar pressão do gás',
      criadoEm: new Date()
    }
  ];

  // Função para buscar serviços (mockada - posteriormente integrar com API)
  const fetchServicos = useCallback(async () => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Simular delay da API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Serviços carregados:', servicosMock.length);
      setServicos(servicosMock);
      
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      setError('Erro ao carregar serviços. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, servicosMock]);

  // useEffect para carregar serviços ao montar o componente
  useEffect(() => {
    fetchServicos();
  }, [fetchServicos]);

  // useFocusEffect para atualizar os dados sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      fetchServicos();
    }, [fetchServicos])
  );

  // Função para abrir/fechar menu de ações do serviço
  const toggleMenu = (servicoId: string, servicoIndex: number, event?: any) => {
    if (menuVisivel === servicoId) {
      setMenuVisivel(null);
    } else {
      setMenuVisivel(servicoId);
      // Posicionar o menu próximo ao botão clicado
      if (event?.nativeEvent) {
        const { pageX, pageY } = event.nativeEvent;
        const isLastCard = servicoIndex === filteredServicos.length - 1;
        const menuHeight = 224; // Altura aproximada do menu (4 itens × 56px cada)
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

  // Funções para ações do serviço
  const editarServico = (servico: Servico) => {
    setMenuVisivel(null);
    Alert.alert(
      'Em Desenvolvimento',
      'A funcionalidade de edição de serviços ainda está sendo desenvolvida.',
      [{ text: 'OK' }]
    );
  };

  const verDetalhes = (servico: Servico) => {
    setMenuVisivel(null);
    setShowDetalhesModal(true);
  };

  const duplicarServico = (servico: Servico) => {
    setMenuVisivel(null);
    Alert.alert(
      'Em Desenvolvimento',
      'A funcionalidade de duplicação de serviços ainda está sendo desenvolvida.',
      [{ text: 'OK' }]
    );
  };

  const excluirServico = (servico: Servico) => {
    setMenuVisivel(null);
    setServicoParaExcluir(servico);
    setShowDeleteModal(true);
  };

  const confirmarExclusao = async () => {
    if (!servicoParaExcluir || !user?.id) return;
    
    setIsDeleting(true);
    
    try {
      // Simular delay da API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Guardar nome do serviço excluído
      setServicoExcluido(servicoParaExcluir.nome);
      
      // Remover serviço da lista local imediatamente
      setServicos(prev => prev.filter(s => s.id !== servicoParaExcluir.id));
      
      // Fechar modal de confirmação
      setShowDeleteModal(false);
      setServicoParaExcluir(null);
      
      // Mostrar modal de sucesso
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      Alert.alert('Erro', 'Não foi possível excluir o serviço. Verifique sua conexão e tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelarExclusao = () => {
    setShowDeleteModal(false);
    setServicoParaExcluir(null);
  };

  const fecharModalSucesso = () => {
    setShowSuccessModal(false);
    setServicoExcluido('');
  };

  const fecharModalDetalhes = () => {
    setShowDetalhesModal(false);
  };

  const adicionarServico = () => {
    Alert.alert(
      'Em Desenvolvimento',
      'A funcionalidade de cadastro de serviços ainda está sendo desenvolvida.',
      [{ text: 'OK' }]
    );
  };

  const voltar = () => {
    router.back();
  };

  const recarregarServicos = () => {
    fetchServicos();
  };

  // Filtrar serviços baseado na pesquisa
  const filteredServicos = servicos.filter(servico => {
    const matchesQuery = query.trim() === '' || 
      servico.nome.toLowerCase().includes(query.toLowerCase()) || 
      servico.categoria.toLowerCase().includes(query.toLowerCase()) ||
      servico.descricao.toLowerCase().includes(query.toLowerCase());
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
        <Text style={styles.title}>Serviços</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Barra de pesquisa */}
      <View style={styles.controls}>
        <TextInput
          placeholder="Buscar por nome, categoria ou descrição..."
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>

      {/* Lista de serviços */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E5BBA" />
            <Text style={styles.loadingText}>Carregando serviços...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={recarregarServicos}>
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        ) : servicos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyTitle}>Nenhum serviço encontrado</Text>
            <Text style={styles.emptyMessage}>Comece cadastrando seu primeiro serviço</Text>
            <TouchableOpacity style={styles.addFirstServiceButton} onPress={adicionarServico}>
              <Text style={styles.addFirstServiceButtonText}>Cadastrar Serviço</Text>
            </TouchableOpacity>
          </View>
        ) : filteredServicos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyTitle}>Nenhum serviço encontrado</Text>
            <Text style={styles.emptyMessage}>Tente uma pesquisa diferente</Text>
          </View>
        ) : (
          filteredServicos.map((servico, index) => (
          <View 
            key={servico.id} 
            style={[
              styles.servicoCard,
              menuVisivel === servico.id && styles.servicoCardActive
            ]}
          >
            <TouchableOpacity 
              style={styles.servicoCardContent}
              onPress={() => editarServico(servico)}
              activeOpacity={0.7}
            >
              <View style={styles.servicoInfo}>
                {/* Header com Nome e Código do Serviço */}
                <View style={styles.servicoHeader}>
                  <Text style={styles.servicoNome}>{servico.nome}</Text>
                  <Text style={styles.servicoCodigo}>Código: {servico.codigo}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Categoria:</Text>
                  <Text style={styles.infoValue}>{servico.categoria}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Preço:</Text>
                  <Text style={styles.infoValue}>R$ {servico.preco}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tempo:</Text>
                  <Text style={styles.infoValue}>{servico.tempo_estimado}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Descrição:</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {servico.descricao || 'Não informado'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.servicoActions}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(event) => {
                  event.stopPropagation(); // Impedir que o card seja clicado
                  toggleMenu(servico.id, index, event);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>
          ))
        )}
      </ScrollView>

      {/* Botão flutuante para adicionar serviço */}
      <TouchableOpacity
        style={styles.fab}
        onPress={adicionarServico}
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
                const servico = servicos.find(s => s.id === menuVisivel);
                if (servico) editarServico(servico);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const servico = servicos.find(s => s.id === menuVisivel);
                if (servico) verDetalhes(servico);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Ver Detalhes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                const servico = servicos.find(s => s.id === menuVisivel);
                if (servico) duplicarServico(servico);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Duplicar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => {
                const servico = servicos.find(s => s.id === menuVisivel);
                if (servico) excluirServico(servico);
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
            
            <Text style={styles.deleteModalTitle}>Excluir Serviço</Text>
            <Text style={styles.deleteModalMessage}>
              Tem certeza que deseja excluir{'\n'}
              <Text style={styles.deleteModalServiceName}>{servicoParaExcluir?.nome}</Text>?
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
            
            <Text style={styles.successModalTitle}>Serviço Excluído!</Text>
            <Text style={styles.successModalMessage}>
              <Text style={styles.successModalServiceName}>{servicoExcluido}</Text>
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

      {/* Modal de Detalhes em Desenvolvimento */}
      <Modal
        visible={showDetalhesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModalDetalhes}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={fecharModalDetalhes}
        >
          <Pressable style={styles.detalhesModalContainer}>
            <View style={styles.detalhesModalHeader}>
              <View style={styles.detalhesIconContainer}>
                <Ionicons name="construct-outline" size={80} color="#F59E0B" />
              </View>
            </View>
            
            <Text style={styles.detalhesModalTitle}>Em Desenvolvimento</Text>
            <Text style={styles.detalhesModalMessage}>
              A funcionalidade de visualizar detalhes completos do serviço ainda está sendo desenvolvida e estará disponível em breve.
            </Text>
            <Text style={styles.detalhesModalSubMessage}>
              Fique atento às próximas atualizações!
            </Text>
            
            <TouchableOpacity 
              style={styles.detalhesButton} 
              onPress={fecharModalDetalhes}
              activeOpacity={0.8}
            >
              <Text style={styles.detalhesButtonText}>Entendi</Text>
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
  servicoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    minHeight: 140,
    zIndex: 1,
  },
  servicoCardContent: {
    flex: 1,
    marginRight: 12,
  },
  servicoCardActive: {
    zIndex: 9998,
    elevation: 19,
  },
  servicoInfo: {
    flex: 1,
  },
  servicoHeader: {
    flexDirection: 'column',
    marginBottom: 12,
    width: '100%',
  },
  servicoNome: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  servicoCodigo: {
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
  servicoActions: {
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
  addFirstServiceButton: {
    backgroundColor: '#6C4CF7',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addFirstServiceButtonText: {
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
  deleteModalServiceName: {
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
  successModalServiceName: {
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
  // Estilos do Modal de Detalhes
  detalhesModalContainer: {
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
  detalhesModalHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  detalhesIconContainer: {
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 50,
    marginBottom: 10,
  },
  detalhesModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 15,
    textAlign: 'center',
  },
  detalhesModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  detalhesModalSubMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  detalhesButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  detalhesButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ServicePanel;
