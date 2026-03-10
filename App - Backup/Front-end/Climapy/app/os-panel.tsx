import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Platform,
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
import { ESTAGIOS_VALIDOS, STATUS_COLORS } from '../constants/atendimento';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { apiService } from '../services/api';
import { atendimentoService } from '../services/atendimento';
import { cacheService } from '../services/cache';
import { logger } from '../services/logger';
import { metrics } from '../services/metrics';
import { useDataStore } from '../stores/dataStore';
import { generateAtendimentoPDF, type AtendimentoPDFData, type PDFStyle } from '../utils/pdfGenerator';

interface Order {
  id: string;
  client: string;
  address: string;
  date: string;
  product: string;
  status: string;
  visitPrice: string;
  totalPrice: string;
  notes?: string[];
  history?: string[];
}

export default function OsPanelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { atendimentos, isLoading: storeLoading, fetchToday } = useDataStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Diagnóstico' | 'Sob Consulta' | 'Aguardando' | 'Aprovado' | 'Recusado' | 'Executado' | 'Garantia'>('Todos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [deletingAtendimento, setDeletingAtendimento] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [selectedOrderForPDF, setSelectedOrderForPDF] = useState<Order | null>(null);

  // Debounce da busca
  const debouncedQuery = useDebounce(query, 300);

  // Função para mapear dados da API para o formato da interface Order
  const mapAtendimentoToOrder = (atendimento: any): Order | null => {
    try {
      if (!atendimento) {
        return null;
      }
      
      // Extrair endereço - prioridade:
      // 1. Se já vem montado: Endereco, endereco, clienteEndereco, address
      // 2. Se vem separado: montar a partir de rua e numero
      let endereco = atendimento.Endereco || 
                     atendimento.endereco || 
                     atendimento.clienteEndereco || 
                     atendimento.address;
      
      // Se não tem endereço pronto, montar a partir de rua e numero
      if (!endereco && atendimento.rua) {
        // rua vem como: "Travessa Princesa Isabel, Sussuarana, Salvador"
        // numero vem como: "304"
        // resultado: "Travessa Princesa Isabel, 304, Sussuarana, Salvador"
        
        if (atendimento.numero) {
          // Inserir o número após a primeira vírgula
          const primeiraVirgula = atendimento.rua.indexOf(',');
          if (primeiraVirgula !== -1) {
            const antes = atendimento.rua.substring(0, primeiraVirgula);
            const depois = atendimento.rua.substring(primeiraVirgula + 1);
            endereco = `${antes}, ${atendimento.numero},${depois}`;
          } else {
            // Se não tiver vírgula, apenas concatenar
            endereco = `${atendimento.rua}, ${atendimento.numero}`;
          }
        } else {
          // Se não tiver número, usar só a rua
          endereco = atendimento.rua;
        }
      }
      
      // Fallback se ainda não tiver endereço
      if (!endereco) {
        endereco = 'Endereço não informado';
      }
      
      // Helpers defensivos para evitar inserir objetos diretamente na UI
      const getString = (v: any): string => {
        if (v == null) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return String(v);
        if (typeof v === 'object') {
          // Tentar extrair campos comuns
          return v.nome || v.name || v.label || '';
        }
        return String(v);
      };

      const id = getString(atendimento.codigo || atendimento.id || atendimento.codigoPedido || 'sem-id') || 'sem-id';
      const client = getString(atendimento.clienteNome || atendimento.cliente || atendimento.Cliente) || 'Cliente não informado';
      const product = getString(atendimento.Produto || atendimento.modelo || atendimento.produto) || '';
      const date = getString(atendimento.data) || 'Data não informada';
      const status = getString(atendimento.Status || atendimento.status) || 'Diagnóstico';
      const visitPrice = getString(atendimento.valorVisita) || 'R$ 0,00';
      const totalPrice = getString(atendimento.valorTotal) || 'R$ 0,00';

      return {
        id,
        client,
        address: endereco,
        date,
        product,
        status,
        visitPrice,
        totalPrice,
        notes: atendimento.notas || [],
        history: atendimento.historico || [],
      };
    } catch (error) {
      logger.error('Erro ao mapear atendimento', error as Error, { atendimento });
      return null;
    }
  };

  // Função para buscar atendimentos da API
  const fetchAtendimentos = useCallback(async (useCache = true) => {
    if (!user?.id) {
      logger.warn('Tentativa de buscar atendimentos sem usuário autenticado');
      setError('Usuário não autenticado');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const cacheKey = `atendimentos_${user.id}`;
    const cacheTTL = 5 * 60; // 5 minutos
    
    try {
      setLoading(true);
      setError(null);
      
      // Tentar buscar do cache primeiro
      if (useCache) {
        const cached = await cacheService.get<any[]>({ key: cacheKey, ttl: cacheTTL });
        if (cached && Array.isArray(cached)) {
          const mappedFromCache = cached
            .map(mapAtendimentoToOrder)
            .filter((order): order is Order => order !== null);
          setOrders(mappedFromCache);
          setLoading(false);
          setRefreshing(false);
          logger.info('Atendimentos carregados do cache', { count: mappedFromCache.length });
          return;
        }
      }

      const response: any = await apiService.get(`/atendimentos`);
      
      // Validar resposta da API
      if (!response.success) {
        logger.error('API retornou erro', {
          success: response.success,
          message: response.message,
          status: response.error
        });
        
        // Se não tem dados disponíveis, apenas mostrar lista vazia
        setOrders([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Validar e extrair atendimentos - o backend retorna { success, count, data: [...] }
      let atendimentos: any[] = [];
      
      if (Array.isArray(response.data)) {
        atendimentos = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        atendimentos = response.data.data;
      } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.atendimentos)) {
        atendimentos = response.data.atendimentos;
      }
      
      // Se encontrou dados, processar
      if (Array.isArray(atendimentos) && atendimentos.length > 0) {
        // Filtrar apenas atendimentos de hoje
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const atendimentosHoje = atendimentos.filter((a: any) => {
          try {
            const dataAtendimento = a?.data ? new Date(a.data) : a?.criadoEm ? new Date(a.criadoEm) : null;
            if (!dataAtendimento) return false;
            return dataAtendimento >= startOfDay && dataAtendimento <= endOfDay;
          } catch (e) {
            return false;
          }
        });

        // Mapear e filtrar atendimentos
        const mappedOrders = atendimentosHoje
          .map(mapAtendimentoToOrder)
          .filter((order): order is Order => order !== null);
        
        setOrders(mappedOrders);
        
        // Salvar no cache por 5 minutos
        await cacheService.set({ key: cacheKey, ttl: cacheTTL }, atendimentos);
        
        logger.info('Atendimentos carregados da API', { count: mappedOrders.length, total: atendimentos.length });
      } else {
        // Se não tiver dados mas a requisição foi bem-sucedida
        setOrders([]);
        logger.info('Nenhum atendimento encontrado');
      }
      
    } catch (error: any) {
      logger.error('Erro ao buscar atendimentos', error, { 
        userId: user?.id 
      });
      
      // Limpar cache se houver erro
      await cacheService.invalidate(`atendimentos_${user.id}`);
      
      setError('Erro ao carregar atendimentos. Tente novamente.');
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Carregar atendimentos ao montar o componente
  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  // Handler para voltar para Home
  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        router.replace('/Home');
        return true; // Impede o voltar padrão
      };

      // Apenas adiciona listener no Android
      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => subscription.remove();
      }
    }, [router])
  );

  // Sincronizar quando store Zustand mudar
  useEffect(() => {
    const unsubscribe = useDataStore.subscribe((state) => {
      const atendimentos = state.atendimentos;
      if (Array.isArray(atendimentos) && atendimentos.length > 0) {
        const mapped = atendimentos
          .map(mapAtendimentoToOrder)
          .filter((order): order is Order => order !== null);
        setOrders(mapped);
      }
    });
    return unsubscribe;
  }, []);

  // Recarregar atendimentos quando a tela for focada
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!user?.id) return;

        // trigger a background refresh of today's atendimentos (force)
        try {
          await fetchToday(user.id, true);
        } catch (e) {
          // ignore
        }

        // then prefer store data for immediate UI
        const storeAtendimentos = useDataStore.getState().atendimentos;
        if (mounted && Array.isArray(storeAtendimentos) && storeAtendimentos.length > 0) {
          const mapped = storeAtendimentos
            .map(mapAtendimentoToOrder)
            .filter((order): order is Order => order !== null);
          setOrders(mapped);
          setLoading(false);
          return;
        }

        // fallback to API fetch if store empty
        fetchAtendimentos(true);
      })();

      return () => { mounted = false; };
    }, [user?.id, fetchAtendimentos, fetchToday])
  );

  // Função para atualizar atendimento
  const updateAtendimento = async (atendimentoId: string, updates: Partial<any>) => {
    if (!user?.id) return;

    try {
      logger.info('Atualizando atendimento', { atendimentoId, userId: user.id });
      
      // ✅ Usar novo serviço centralizado
      const { success, atendimento, error } = await atendimentoService.atualizarAtendimento(
        user.id,
        atendimentoId,
        updates
      );
      
      if (!success) {
        logger.error('Erro ao atualizar atendimento', new Error(error || 'Erro desconhecido'));
        Alert.alert(
          'Erro ao atualizar',
          error || 'Não foi possível atualizar o atendimento. Tente novamente.',
          [{ text: 'OK' }]
        );
        return;
      }

      // ✅ Sucesso - cache já foi sincronizado pelo serviço
      logger.info('Atendimento atualizado com sucesso', { atendimentoId });
      
    } catch (error: any) {
      logger.error('Erro ao atualizar atendimento', error, { 
        atendimentoId: atendimentoId 
      });
      
      Alert.alert(
        'Erro ao atualizar',
        'Não foi possível atualizar o atendimento. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  };

  // Função para deletar atendimento
  const deleteAtendimento = async (atendimentoId: string) => {
    if (!user?.id) return;

    try {
      logger.info('Deletando atendimento', { atendimentoId, userId: user.id });
      
      // Atualização otimista - remover da UI imediatamente
      setOrders((prev) => prev.filter(o => o.id !== atendimentoId));
      
      await apiService.delete(`/atendimentos/${atendimentoId}`);
      
      // Invalidar cache
      await cacheService.invalidate(`atendimentos_${user.id}`);
      
      logger.info('Atendimento deletado com sucesso', { atendimentoId });
      
    } catch (error: any) {
      logger.error('Erro ao deletar atendimento', error, { 
        atendimentoId: atendimentoId 
      });
      
      // Reverter atualização otimista
      await fetchAtendimentos(false);
      
      Alert.alert(
        'Erro ao excluir',
        'Não foi possível excluir o atendimento. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  };

  const setMenuFor = (order: Order, event: any) => {
    event.persist && event.persist();
    
    // Pegar a posição do toque
    const { pageY } = event.nativeEvent;
    
    setMenuPosition({ x: 0, y: pageY });
    setMenuOrder(order);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuOrder(null);
    setMenuVisible(false);
  };

  const openGoogleMaps = (address: string) => {
    if (!address || address === 'Endereço não informado') {
      Alert.alert('Aviso', 'Endereço não informado para esta O.S.');
      return;
    }

    const encodedAddress = encodeURIComponent(address);
    const googleMapsUrl = `https://www.google.com/maps/search/${encodedAddress}`;
    
    Linking.openURL(googleMapsUrl).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o Google Maps');
    });
    
    closeMenu();
  };

  const deleteOrder = async (orderId: string) => {
    setDeletingAtendimento(true);
    await deleteAtendimento(orderId);
    setConfirmDeleteOrder(null);
    closeMenu();
    if (selectedOrder?.id === orderId) setSelectedOrder(null);
    setDeletingAtendimento(false);
  };

  const openEdit = (order: Order) => {
    setMenuVisible(false);
    closeMenu();
    // Navegar para a tela de edição passando os dados do atendimento
    router.push({
      pathname: '/edit_atend',
      params: {
        atendimentoId: order.id,
        clienteNome: order.client,
        clienteEndereco: order.address,
        produto: order.product,
        modelo: order.product,
        data: order.date,
        valorVisita: order.visitPrice,
        status: order.status,
      }
    });
  };

  const saveEdit = async () => {
    if (!editOrder) return;
    
    // Atualização otimista
    setOrders(prev => prev.map(o => o.id === editOrder.id ? editOrder : o));
    setEditModalVisible(false);
    
    // Preparar dados para atualização
    const updates = {
      clienteNome: editOrder.client,
      endereco: editOrder.address,
      Produto: editOrder.product,
      valorVisita: editOrder.visitPrice,
      valorTotal: editOrder.totalPrice,
      Status: editOrder.status, // Enviar diretamente o Status sem mapeamento
    };
    
    await updateAtendimento(editOrder.id, updates);
    setEditOrder(null);
  };

  const toggleStatus = async (order: Order) => {
    // Encontrar o índice atual do status
    const currentIndex = ESTAGIOS_VALIDOS.indexOf(order.status as any);
    // Ir para o próximo status (ou voltar para o primeiro)
    const nextIndex = (currentIndex + 1) % ESTAGIOS_VALIDOS.length;
    const newStatus = ESTAGIOS_VALIDOS[nextIndex];
    
    // Atualização otimista
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
    closeMenu();
    
    // Atualizar no backend
    const updates = {
      Status: newStatus, // Enviar diretamente o Status
    };
    
    await updateAtendimento(order.id, updates);
  };

  const openAddNote = (order: Order) => {
    setMenuVisible(false);
    setMenuOrder(null);
    setTimeout(() => { setMenuOrder(order); }, 100);
  };

  const saveNote = () => {
    if (!menuOrder) return;
    setOrders(prev => prev.map(o => o.id === menuOrder.id ? { ...o, notes: [...(o.notes||[])], history: [...(o.history||[])] } : o));
    setMenuOrder(null);
  };

  const viewHistory = (order: Order) => {
    closeMenu();
  };

  const shareReceipt = (order: Order) => {
    setSelectedOrderForPDF(order);
    setShowStyleModal(true);
    closeMenu();
  };

  const generatePDFWithStyle = async (style: PDFStyle) => {
    if (!selectedOrderForPDF) return;
    
    setShowStyleModal(false);
    setGeneratingPDF(true);
    
    try {
      const pdfData: AtendimentoPDFData = {
        codigo: selectedOrderForPDF.id,
        clienteNome: selectedOrderForPDF.client,
        clienteEndereco: selectedOrderForPDF.address,
        produto: selectedOrderForPDF.product,
        modelo: selectedOrderForPDF.product,
        valorVisita: selectedOrderForPDF.visitPrice,
        status: selectedOrderForPDF.status,
        data: selectedOrderForPDF.date,
      };
      
      await generateAtendimentoPDF(pdfData, style);
    } catch (error) {
      logger.error('Erro ao gerar PDF', error as Error, { orderId: selectedOrderForPDF.id });
      Alert.alert(
        'Erro ao gerar PDF',
        'Não foi possível gerar o PDF. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setGeneratingPDF(false);
      setSelectedOrderForPDF(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await fetchAtendimentos(false); // Forçar busca sem cache
  };

  const recarregarAtendimentos = () => {
    fetchAtendimentos(false); // Force refresh
  };

  // Usar useMemo para otimizar a filtragem
  const filteredOrders = useMemo(() => {
    const startTime = Date.now();
    const result = orders.filter(o => {
      const matchesQuery = debouncedQuery.trim() === '' || 
        o.client.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
        o.id.toLowerCase().includes(debouncedQuery.toLowerCase());
      // Permitir equivalência de status ignorando case e espaços
      const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const statusNorm = normalize(o.status);
      const filterNorm = normalize(statusFilter);
      const matchesStatus = statusFilter === 'Todos' ? true : statusNorm === filterNorm;
      // Permitir que "Sob Consulta" seja exibido corretamente
      return matchesQuery && matchesStatus;
    });
    metrics.trackTime('filter_orders', startTime);
    return result;
  }, [orders, debouncedQuery, statusFilter]);

  const EmptyComponent = () => {
    // Only show message when user performed a search or changed the status filter
    const searchActive = query.trim() !== '' || statusFilter !== 'Todos';
    if (!searchActive) return <View />;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma ordem de serviço encontrada!</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardLeft} onPress={() => setSelectedOrder(item)}>
        <View style={[
          styles.statusBox,
          { backgroundColor: STATUS_COLORS[item.status] || '#6C4CF7' }
        ]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.atendimentoNumero}>{item.id}</Text>
      </TouchableOpacity>
        <View style={styles.cardRight}>
          <View style={styles.cardHeader}>
            <Text style={styles.clientName}>{item.client}</Text>
            <TouchableOpacity onPress={(event) => setMenuFor(item, event)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.address}>{item.address}</Text>
          <Text style={styles.meta}>Agendado: {item.date}</Text>
          <Text style={styles.meta}>Produto: {item.product}</Text>

        <View style={styles.totalsRow}>
          <Text style={styles.recebimentoLabel}>Recebimento -</Text>

          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Visita</Text>
            <Text style={styles.totalPrice}>{item.visitPrice}</Text>
          </View>
        </View>

        {/* Botão Lançar Orçamento - apenas para status Diagnóstico */}
        {item.status === 'Diagnóstico' && (
          <TouchableOpacity 
            style={styles.budgetButton}
            onPress={() => {
              router.push({
                pathname: '/launch_budget',
                params: {
                  atendimentoId: item.id,
                  clienteNome: item.client,
                  produto: item.product,
                  valorVisita: item.visitPrice || 'R$ 0,00',
                }
              });
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.budgetButtonGradient}
            >
              <Ionicons name="calculator-outline" size={16} color="#fff" />
              <Text style={styles.budgetButtonText}>Lançar Orçamento</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Atendimentos</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Loading inicial */}
      {loading && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C4CF7" />
          <Text style={styles.loadingText}>Carregando atendimentos...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={recarregarAtendimentos}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search + Filters */}
          <View style={styles.controls}>
        <TextInput
          placeholder="Buscar por cliente ou O.S..."
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
          
          {ESTAGIOS_VALIDOS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterButton, 
                statusFilter === s && styles.filterButtonActive,
                statusFilter === s && { backgroundColor: STATUS_COLORS[s] }
              ]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        ListEmptyComponent={EmptyComponent}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Floating add button */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new_atend')}>
        <LinearGradient
          colors={['#1BAFE0', '#7902E0']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
        </>
      )}

      {/* Loading PDF */}
      {generatingPDF && (
        <View style={styles.pdfLoadingOverlay}>
          <View style={styles.pdfLoadingContainer}>
            <ActivityIndicator size="large" color="#7902E0" />
            <Text style={styles.pdfLoadingText}>Gerando PDF...</Text>
          </View>
        </View>
      )}

      {/* Loading Deletar */}
      {deletingAtendimento && (
        <View style={styles.pdfLoadingOverlay}>
          <View style={styles.pdfLoadingContainer}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={[styles.pdfLoadingText, { color: '#EF4444' }]}>Excluindo atendimento...</Text>
          </View>
        </View>
      )}

      {/* Modal Escolher Estilo PDF */}
      {showStyleModal && (
        <Pressable style={styles.modalOverlay} onPress={() => setShowStyleModal(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.styleModalContainer}>
              <Text style={styles.styleModalTitle}>Escolha o estilo do PDF</Text>
              
              <TouchableOpacity 
                style={styles.styleOption} 
                onPress={() => generatePDFWithStyle('moderno')}
                activeOpacity={0.8}
              >
                <View style={styles.styleIconContainer}>
                  <Ionicons name="color-palette" size={32} color="#7902E0" />
                </View>
                <View style={styles.styleOptionContent}>
                  <Text style={styles.styleOptionTitle}>Moderno</Text>
                  <Text style={styles.styleOptionDescription}>Design colorido com gradientes e visual profissional</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.styleOption} 
                onPress={() => generatePDFWithStyle('minimalista')}
                activeOpacity={0.8}
              >
                <View style={styles.styleIconContainer}>
                  <Ionicons name="document-text-outline" size={32} color="#4CAF50" />
                </View>
                <View style={styles.styleOptionContent}>
                  <Text style={styles.styleOptionTitle}>Minimalista</Text>
                  <Text style={styles.styleOptionDescription}>Design limpo e objetivo, fácil de imprimir</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelStyleButton} 
                onPress={() => setShowStyleModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelStyleButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}

      {/* Details / Create modals - placeholders (simple) */}
      {selectedOrder && (
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrder(null)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="arrow-back" size={20} color="#111" />
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                <Text style={{ fontWeight: '700', fontSize: 18 }}>{selectedOrder.client}</Text>
              </View>
              <Text style={{ marginTop: 8 }}>{selectedOrder.address}</Text>
              <Text>{selectedOrder.product}</Text>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}

      {showCreateModal && (
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="arrow-back" size={20} color="#111" />
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                <Text style={{ fontWeight: '700', fontSize: 18 }}>Nova O.S. (Rápido)</Text>
              </View>
              <Text style={{ marginTop: 8, color: '#666' }}>Formulário simplificado — implementável conforme necessidade.</Text>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}

      {/* Menu modal for three-dots - incluindo Google Maps e botão Voltar */}
      {menuVisible && menuOrder && (
        <Pressable style={styles.fullScreenOverlay} onPress={() => closeMenu()}>
          <View style={[styles.actionMenu, { 
            right: 20, 
            top: Math.max(100, menuPosition.y - 50)
          }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => openEdit(menuOrder)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Editar atendimento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => shareReceipt(menuOrder)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Gerar PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => openGoogleMaps(menuOrder.address)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={18} color="#111" />
              <Text style={styles.actionText}>Ver localização no Mapa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => setConfirmDeleteOrder(menuOrder)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="red" />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Excluir atendimento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => closeMenu()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#666" />
              <Text style={[styles.actionText, { color: '#666' }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* Delete confirmation */}
      {confirmDeleteOrder && (
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmDeleteOrder(null)}>
          <TouchableWithoutFeedback>
            <View style={styles.deleteModalContainer}>
              <View style={styles.deleteModalHeader}>
                <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
              </View>
              
              <Text style={styles.deleteModalTitle}>Excluir atendimento</Text>
              <Text style={styles.deleteModalMessage}>
                Tem certeza que deseja excluir{'\n'}
                <Text style={styles.deleteModalClientName}>{confirmDeleteOrder.id}</Text>?
              </Text>
              <Text style={styles.deleteModalWarning}>
                Esta ação não pode ser desfeita.
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setConfirmDeleteOrder(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => deleteOrder(confirmDeleteOrder.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      )}

      {/* Edit modal */}
      {editModalVisible && editOrder && (
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="arrow-back" size={20} color="#111" />
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                <Text style={{ fontWeight: '700', fontSize: 18 }}>Editar O.S. {editOrder.id}</Text>
              </View>
              <TextInput value={editOrder.client} onChangeText={(t) => setEditOrder({ ...editOrder, client: t })} style={[styles.searchInput, { marginTop: 12 }]} />
              <TextInput value={editOrder.address} onChangeText={(t) => setEditOrder({ ...editOrder, address: t })} style={[styles.searchInput, { marginTop: 8 }]} />
              <TextInput value={editOrder.product} onChangeText={(t) => setEditOrder({ ...editOrder, product: t })} style={[styles.searchInput, { marginTop: 8 }]} />
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Text style={{ color: '#666' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit}>
                  <Text style={{ color: '#1565c0' }}>Salvar</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#6C4CF7',
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
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.06, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 4 
  },
  cardLeft: { marginRight: 12, alignItems: 'center' },
  statusBox: { 
    minWidth: 80, 
    height: 64, 
    borderRadius: 10, 
    backgroundColor: '#6C4CF7', 
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clientName: { fontSize: 16, fontWeight: '700' },
  address: { color: '#666', marginBottom: 6 },
  meta: { color: '#666', marginBottom: 4 },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 8 },
  totalPrice: { fontWeight: '700' },
  recebimentoLabel: { color: '#666', fontWeight: '600', marginRight: 12, alignSelf: 'center' },
  priceColumn: { alignItems: 'center', minWidth: 80 },
  priceLabel: { color: '#666', fontSize: 12, marginBottom: 4 },
  controls: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: '#F5F7FA', padding: 10, borderRadius: 10, marginBottom: 8 },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F0F0F0' },
  filterButtonActive: { backgroundColor: '#1A32E5' },
  filterText: { color: '#333' },
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
    fontSize: 16 
  },
  pdfLoadingOverlay: {
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
  pdfLoadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 200,
  },
  pdfLoadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#7902E0',
  },
  styleModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
  },
  styleModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 20,
    textAlign: 'center',
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  styleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  styleOptionContent: {
    flex: 1,
  },
  styleOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  styleOptionDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  cancelStyleButton: {
    marginTop: 10,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelStyleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  budgetButton: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  budgetButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  budgetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
