import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { STATUS_ORCAMENTO, STATUS_ORCAMENTO_COLORS, type StatusOrcamento } from '../constants/atendimento';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { apiService } from '../services/api';
import { cacheService } from '../services/cache';
import { logger } from '../services/logger';
import { metrics } from '../services/metrics';

interface Orcamento {
  id: string;
  client: string;
  address: string;
  date: string;
  product: string;
  defeito: string;
  statusOrcamento: StatusOrcamento;
  visitPrice: string;
  totalPrice: string;
  notes?: string[];
  history?: string[];
}

export default function OrcamentosPanelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | StatusOrcamento>('Todos');
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [menuOrcamento, setMenuOrcamento] = useState<Orcamento | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [confirmDeleteOrcamento, setConfirmDeleteOrcamento] = useState<Orcamento | null>(null);
  const [deletingOrcamento, setDeletingOrcamento] = useState(false);

  // Debounce da busca
  const debouncedQuery = useDebounce(query, 300);

  // Função para mapear dados da API para o formato da interface Orcamento
  const mapAtendimentoToOrcamento = (atendimento: any): Orcamento | null => {
    try {
      if (!atendimento) {
        logger.warn('Atendimento nulo ou indefinido');
        return null;
      }

      // Permitir atendimentos com status "Consulta" ou "Sob Consulta" (e outros status de orçamento)
      const status = atendimento.Status || atendimento.status || atendimento.statusOrcamento;
      const statusOrcamento = (atendimento.statusOrcamento || status || 'Consulta') as StatusOrcamento;
      // Se o status não for um dos STATUS_ORCAMENTO, não exibe
      if (!['Consulta', 'Finalizado', 'Executado', 'Fechado', 'Sob consulta'].includes(statusOrcamento)) {
        return null;
      }

      // Extrair endereço
      let endereco = atendimento.Endereco || 
                     atendimento.endereco || 
                     atendimento.clienteEndereco || 
                     atendimento.address;
      
      if (!endereco && atendimento.rua) {
        if (atendimento.numero) {
          const primeiraVirgula = atendimento.rua.indexOf(',');
          if (primeiraVirgula !== -1) {
            const antes = atendimento.rua.substring(0, primeiraVirgula);
            const depois = atendimento.rua.substring(primeiraVirgula + 1);
            endereco = `${antes}, ${atendimento.numero},${depois}`;
          } else {
            endereco = `${atendimento.rua}, ${atendimento.numero}`;
          }
        } else {
          endereco = atendimento.rua;
        }
      }
      
      if (!endereco) {
        endereco = 'Endereço não informado';
      }

  // Extrair defeito
  const defeito = atendimento.defeito || atendimento.Defeito || 'Não informado';
  return {
        id: atendimento.codigo || atendimento.id || 'sem-id',
        client: atendimento.clienteNome || 'Cliente não informado',
        address: endereco,
        date: atendimento.data || '',
        product: atendimento.Produto || atendimento.modelo || '',
        defeito,
        statusOrcamento,
        visitPrice: atendimento.valorVisita || 'R$ 0,00',
        totalPrice: atendimento.valorTotal || 'R$ 0,00',
        notes: atendimento.notas || [],
        history: atendimento.historico || [],
      };
    } catch (error) {
      logger.error('Erro ao mapear atendimento para orçamento', error as Error, { atendimento });
      return null;
    }
  };

  // Função para buscar orçamentos (atendimentos "Sob Consulta") da API
  const fetchOrcamentos = async (useCache = true) => {
    if (!user?.id) {
      logger.warn('Tentativa de buscar orçamentos sem usuário autenticado');
      setError('Usuário não autenticado');
      setLoading(false);
      return;
    }

    const cacheKey = `orcamentos_${user.id}`;
    const cacheTTL = 5 * 60; // 5 minutos
    
    try {
      setLoading(true);
      setError(null);
      
      // Tentar buscar do cache primeiro
      if (useCache) {
        const cached = await cacheService.get<any[]>({ key: cacheKey, ttl: cacheTTL });
        if (cached && Array.isArray(cached)) {
          logger.info('Orçamentos carregados do cache', { count: cached.length });
          const mappedFromCache = cached
            .map(mapAtendimentoToOrcamento)
            .filter((orc): orc is Orcamento => orc !== null);
          setOrcamentos(mappedFromCache);
          setLoading(false);
          return;
        }
      }

      logger.info('Buscando atendimentos da API para orçamentos', { userId: user.id });
      const response: any = await apiService.get(`/atendimentos/${user.id}`);
      
      // Validar e extrair atendimentos
      let atendimentos: any[] = [];
      
      if (Array.isArray(response.data)) {
        atendimentos = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        atendimentos = response.data.data;
      } else if (Array.isArray(response.atendimentos)) {
        atendimentos = response.atendimentos;
      }
      
      logger.info('Atendimentos encontrados', { 
        count: atendimentos.length,
        source: Array.isArray(response.data) ? 'response.data' : 
                Array.isArray(response.data?.data) ? 'response.data.data' : 
                'response.atendimentos'
      });
      
      if (!Array.isArray(atendimentos)) {
        logger.warn('Dados inválidos recebidos da API');
        setOrcamentos([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Mapear e filtrar apenas atendimentos "Sob Consulta"
      const mappedOrcamentos = atendimentos
        .map(mapAtendimentoToOrcamento)
        .filter((orc): orc is Orcamento => orc !== null);
      
      setOrcamentos(mappedOrcamentos);
      
      // Salvar no cache por 5 minutos
      await cacheService.set({ key: cacheKey, ttl: cacheTTL }, mappedOrcamentos);
      
      logger.info('Orçamentos carregados com sucesso', { count: mappedOrcamentos.length });
      
    } catch (error: any) {
      logger.error('Erro ao buscar orçamentos', error, { 
        userId: user?.id 
      });
      
      setError('Erro ao carregar orçamentos. Tente novamente.');
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carregar orçamentos ao montar o componente
  useEffect(() => {
    fetchOrcamentos();
  }, [user?.id]);

  // Recarregar orçamentos quando a tela for focada
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchOrcamentos(true);
      }
    }, [user?.id])
  );

  // Função para atualizar status do orçamento
  const updateOrcamentoStatus = async (orcamentoId: string, newStatus: StatusOrcamento) => {
    if (!user?.id) return;

    try {
      logger.info('Atualizando status do orçamento', { orcamentoId, newStatus, userId: user.id });
      
      // Atualização otimista
      setOrcamentos(prev => prev.map(o => 
        o.id === orcamentoId ? { ...o, statusOrcamento: newStatus } : o
      ));

      // Atualizar no backend
      await apiService.put(`/atendimentos/${user.id}/${orcamentoId}`, {
        statusOrcamento: newStatus
      });
      
      // Invalidar cache
      await cacheService.invalidate(`orcamentos_${user.id}`);
      
      logger.info('Status do orçamento atualizado com sucesso', { orcamentoId });
      
    } catch (error: any) {
      logger.error('Erro ao atualizar status do orçamento', error, { 
        orcamentoId 
      });
      
      // Reverter atualização otimista
      await fetchOrcamentos(false);
      
      Alert.alert(
        'Erro ao atualizar',
        'Não foi possível atualizar o status do orçamento. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  };

  // Função para deletar orçamento
  const deleteOrcamento = async (orcamentoId: string) => {
    if (!user?.id) return;

    try {
      setDeletingOrcamento(true);
      logger.info('Deletando orçamento', { orcamentoId, userId: user.id });
      
      // Atualização otimista
      setOrcamentos((prev) => prev.filter(o => o.id !== orcamentoId));
      
      await apiService.delete(`/atendimentos/${user.id}/${orcamentoId}`);
      
      // Invalidar cache
      await cacheService.invalidate(`orcamentos_${user.id}`);
      
      logger.info('Orçamento deletado com sucesso', { orcamentoId });
      
    } catch (error: any) {
      logger.error('Erro ao deletar orçamento', error, { 
        orcamentoId 
      });
      
      // Reverter atualização otimista
      await fetchOrcamentos(false);
      
      Alert.alert(
        'Erro ao excluir',
        'Não foi possível excluir o orçamento. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setDeletingOrcamento(false);
      setConfirmDeleteOrcamento(null);
      closeMenu();
    }
  };

  const setMenuFor = (orcamento: Orcamento, event: any) => {
    event.persist && event.persist();
    const { pageY } = event.nativeEvent;
    setMenuPosition({ x: 0, y: pageY });
    setMenuOrcamento(orcamento);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuOrcamento(null);
    setMenuVisible(false);
  };

  const toggleStatus = async (orcamento: Orcamento) => {
    const currentIndex = STATUS_ORCAMENTO.indexOf(orcamento.statusOrcamento);
    const nextIndex = (currentIndex + 1) % STATUS_ORCAMENTO.length;
    const newStatus = STATUS_ORCAMENTO[nextIndex];
    
    closeMenu();
    await updateOrcamentoStatus(orcamento.id, newStatus);
  };

  const analisarOrcamento = (orcamento: Orcamento) => {
    closeMenu();
    router.push({
      pathname: '/launch_budget',
      params: {
        atendimentoId: orcamento.id,
        clienteNome: orcamento.client,
        produto: orcamento.product,
        mode: 'view' // Modo visualização/edição
      }
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await fetchOrcamentos(false);
  };

  // Usar useMemo para otimizar a filtragem
  const filteredOrcamentos = useMemo(() => {
    const startTime = Date.now();
    const result = orcamentos.filter(o => {
      const matchesQuery = debouncedQuery.trim() === '' || 
        o.client.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
        o.id.toLowerCase().includes(debouncedQuery.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' ? true : o.statusOrcamento === statusFilter;
      return matchesQuery && matchesStatus;
    });
    metrics.trackTime('filter_orcamentos', startTime);
    return result;
  }, [orcamentos, debouncedQuery, statusFilter]);

  const EmptyComponent = () => {
    const searchActive = query.trim() !== '' || statusFilter !== 'Todos';
    if (!searchActive && orcamentos.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Nenhum orçamento encontrado</Text>
          <Text style={styles.emptySubtext}>Orçamentos aparecem quando atendimentos estiverem &quot;Sob Consulta&quot;</Text>
        </View>
      );
    }
    
    if (!searchActive) return <View />;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhum orçamento encontrado!</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Orcamento }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <TouchableOpacity style={styles.cardLeft} onPress={() => setSelectedOrcamento(item)}>
            <View style={[
              styles.statusBox,
              { backgroundColor: STATUS_ORCAMENTO_COLORS[item.statusOrcamento] || '#F59E0B' }
            ]}>
              <Text style={styles.statusText}>{item.statusOrcamento}</Text>
            </View>
            <Text style={styles.atendimentoNumero}>{item.id}</Text>
          </TouchableOpacity>
          
          <View style={styles.cardRight}>
            <View style={styles.cardHeader}>
              <Text style={styles.pedidoLabel}>Pedido: <Text style={styles.pedidoValue}>{item.id}</Text></Text>
              <TouchableOpacity onPress={(event) => setMenuFor(item, event)}>
                <Ionicons name="ellipsis-vertical" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.clientName}>Cliente: {item.client}</Text>
            
            <View style={styles.produtoDefeitoRow}>
              <Text style={styles.meta}>Produto: {item.product}</Text>
              <Text style={styles.separator}>|</Text>
              <Text style={styles.meta}>Defeito: {item.defeito}</Text>
            </View>
            
            <Text style={styles.visitaText}>Visita: {item.date}</Text>
          </View>
        </View>
      </View>
      
      {/* Footer com botão */}
      <View style={styles.cardFooter}>
        <TouchableOpacity 
          style={styles.analisarButton}
          onPress={() => analisarOrcamento(item)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.analisarButtonGradient}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.analisarButtonText}>Analisar Orçamento</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Orçamentos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && orcamentos.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Carregando orçamentos...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchOrcamentos(false)}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search + Filters */}
          <View style={styles.controls}>
            <TextInput
              placeholder="Buscar por cliente ou pedido..."
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              <TouchableOpacity
                key="Todos"
                style={[styles.filterButton, statusFilter === 'Todos' && styles.filterButtonActive]}
                onPress={() => setStatusFilter('Todos')}
              >
                <Text style={[styles.filterText, statusFilter === 'Todos' && styles.filterTextActive]}>Todos</Text>
              </TouchableOpacity>
              
              {STATUS_ORCAMENTO.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filterButton, 
                    statusFilter === s && styles.filterButtonActive,
                    statusFilter === s && { backgroundColor: STATUS_ORCAMENTO_COLORS[s] }
                  ]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredOrcamentos}
            ListEmptyComponent={EmptyComponent}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />

          {/* Floating add button */}
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => router.push('/new_atend')}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={28} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* Loading Deletar */}
      {deletingOrcamento && (
        <View style={styles.deleteLoadingOverlay}>
          <View style={styles.deleteLoadingContainer}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={[styles.deleteLoadingText, { color: '#EF4444' }]}>Excluindo orçamento...</Text>
          </View>
        </View>
      )}

      {/* Menu modal */}
      {menuVisible && menuOrcamento && (
        <Pressable style={styles.fullScreenOverlay} onPress={() => closeMenu()}>
          <View style={[styles.actionMenu, { 
            right: 20, 
            top: Math.max(100, menuPosition.y - 50)
          }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => analisarOrcamento(menuOrcamento)}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Analisar orçamento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => toggleStatus(menuOrcamento)}
              activeOpacity={0.7}
            >
              <Ionicons name="sync-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Alterar status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => setConfirmDeleteOrcamento(menuOrcamento)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="red" />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Excluir orçamento</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* Delete confirmation */}
      {confirmDeleteOrcamento && (
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmDeleteOrcamento(null)}>
          <TouchableWithoutFeedback>
            <View style={styles.deleteModalContainer}>
              <View style={styles.deleteModalHeader}>
                <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
              </View>
              
              <Text style={styles.deleteModalTitle}>Excluir orçamento</Text>
              <Text style={styles.deleteModalMessage}>
                Tem certeza que deseja excluir{'\n'}
                <Text style={styles.deleteModalClientName}>{confirmDeleteOrcamento.id}</Text>?
              </Text>
              <Text style={styles.deleteModalWarning}>
                Esta ação não pode ser desfeita.
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setConfirmDeleteOrcamento(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => deleteOrcamento(confirmDeleteOrcamento.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}

      {/* Details modal */}
      {selectedOrcamento && (
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrcamento(null)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setSelectedOrcamento(null)}>
                  <Ionicons name="arrow-back" size={20} color="#111" />
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                <Text style={{ fontWeight: '700', fontSize: 18 }}>{selectedOrcamento.client}</Text>
              </View>
              <Text style={{ marginTop: 8, color: '#666' }}>{selectedOrcamento.address}</Text>
              <Text style={{ marginTop: 4, color: '#666' }}>Produto: {selectedOrcamento.product}</Text>
              <Text style={{ marginTop: 4, color: '#666' }}>Defeito: {selectedOrcamento.defeito}</Text>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 30, justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 40 
  },
  loadingText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 12 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  errorText: { 
    fontSize: 16, 
    color: '#FF6B6B', 
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 }
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.06, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 4,
    overflow: 'hidden'
  },
  cardContent: {
    padding: 16
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12
  },
  cardLeft: { 
    alignItems: 'center',
    width: 80
  },
  statusBox: { 
    minWidth: 80, 
    height: 64, 
    borderRadius: 10, 
    backgroundColor: '#F59E0B', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 8
  },
  statusText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 12,
    textAlign: 'center'
  },
  atendimentoNumero: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center'
  },
  cardRight: { flex: 1 },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  pedidoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  pedidoValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '700'
  },
  clientName: { 
    fontSize: 16, 
    fontWeight: '700',
    marginBottom: 6,
    color: '#111'
  },
  produtoDefeitoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  meta: { 
    color: '#666', 
    fontSize: 13,
    flexShrink: 1
  },
  separator: {
    color: '#ccc',
    marginHorizontal: 8,
    fontSize: 13
  },
  visitaText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA'
  },
  analisarButton: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  analisarButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    width: '100%'
  },
  analisarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  controls: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: '#F5F7FA', padding: 10, borderRadius: 10, marginBottom: 8 },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F0F0F0' },
  filterButtonActive: { backgroundColor: '#F59E0B' },
  filterText: { color: '#333', fontSize: 14, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
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
  modalOverlay: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  fullScreenOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  actionMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    minWidth: 220,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionItemDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  actionText: {
    fontSize: 15,
    color: '#111',
    marginLeft: 12,
    fontWeight: '500',
  },
  actionTextDanger: {
    color: 'red',
  },
  modalCard: { 
    width: '90%', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'flex-start' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
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
    color: '#EF4444',
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 25,
    fontStyle: 'italic',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
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
  emptyContainer: { 
    padding: 40, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  emptyText: { 
    color: '#666', 
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600'
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  deleteLoadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  deleteLoadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 200,
  },
  deleteLoadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
});
