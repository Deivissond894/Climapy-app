import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { AirVent, CirclePlus, Heater, Refrigerator, WashingMachine } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ESTAGIOS_VALIDOS, STATUS_COLORS, StatusAtendimento } from '../constants/atendimento';
import { useAuth } from '../contexts/AuthContext';
import { atendimentoService } from '../services/atendimento';
import { logger } from '../services/logger';

interface FormData {
  clienteNome: string;
  clienteEndereco: string;
  produto: string;
  modelo: string;
  data: string;
  hora: string;
  valorVisita: string;
  status: StatusAtendimento;
}

export default function EditAtendScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    clienteNome: '',
    clienteEndereco: '',
    produto: '',
    modelo: '',
    data: '',
    hora: '',
    valorVisita: '',
    status: 'Diagnóstico',
  });

  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showFullScreenLoading, setShowFullScreenLoading] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [resultModal, setResultModal] = useState<{
    success: boolean;
    title: string;
    message: string;
  } | null>(null);

  const atendimentoId = params.atendimentoId as string;

  useEffect(() => {
    if (params.clienteNome) {
      const produto = params.produto as string || '';
      setFormData({
        clienteNome: params.clienteNome as string,
        clienteEndereco: params.clienteEndereco as string || '',
        produto: produto,
        modelo: params.modelo as string || '',
        data: params.data as string || '',
        hora: '',
        valorVisita: params.valorVisita as string || '',
        status: (params.status as StatusAtendimento) || 'Diagnóstico',
      });
      setSelectedEquipment(produto);
    }
  }, [
    params.clienteNome,
    params.clienteEndereco,
    params.produto,
    params.modelo,
    params.data,
    params.valorVisita,
    params.status
  ]);

  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const onDateChange = (event: any, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
      setFormData({ ...formData, data: formatDate(selected) });
    }
  };

  const onTimeChange = (event: any, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      setSelectedTime(selected);
      setFormData({ ...formData, hora: formatTime(selected) });
    }
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const handleValueChange = (text: string) => {
    const formatted = formatCurrency(text);
    setFormData({ ...formData, valorVisita: formatted });
  };

  const selectEquipment = (equipment: string) => {
    setSelectedEquipment(equipment);
    setFormData({ ...formData, produto: equipment });
  };

  const openProductModal = () => {
    setShowProductModal(true);
    setNewProductName('');
  };

  const saveNewProduct = () => {
    if (newProductName.trim()) {
      selectEquipment(newProductName.trim());
      setShowProductModal(false);
      setNewProductName('');
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      logger.error('Tentativa de atualizar atendimento sem usuário autenticado');
      setResultModal({
        success: false,
        title: 'Erro de Autenticação',
        message: 'Você precisa estar logado para atualizar um atendimento.',
      });
      setShowResultModal(true);
      return;
    }

    setShowFullScreenLoading(true);

    try {
      // Preparar apenas os campos que foram alterados
      const updates: any = {};
      
      if (formData.clienteNome !== params.clienteNome) updates.clienteNome = formData.clienteNome;
      if (formData.clienteEndereco !== params.clienteEndereco) updates.clienteEndereco = formData.clienteEndereco;
      if (formData.produto !== params.produto) updates.Produto = formData.produto;
      if (formData.modelo !== params.modelo) updates.modelo = formData.modelo;
      if (formData.data !== params.data) updates.data = formData.data;
      if (formData.valorVisita !== params.valorVisita) updates.valorVisita = formData.valorVisita;
      if (formData.status !== params.status) updates.Status = formData.status;

      logger.info('Atualizando atendimento', { 
        atendimentoId,
        updates 
      });

      // ✅ Usar novo serviço centralizado
      const { success, atendimento, error } = await atendimentoService.atualizarAtendimento(
        user.id,
        atendimentoId,
        updates
      );

      if (!success) {
        logger.error('Erro ao atualizar atendimento no serviço');
        setResultModal({
          success: false,
          title: 'Erro',
          message: error || 'Não foi possível atualizar o atendimento. Tente novamente.',
        });
        setShowResultModal(true);
        return;
      }

      // ✅ Sucesso - cache já foi sincronizado pelo serviço
      logger.info('Atendimento atualizado com sucesso', { 
        atendimentoId,
        userId: user.id 
      });

      setResultModal({
        success: true,
        title: 'Sucesso!',
        message: 'Atendimento atualizado com sucesso!',
      });
      setShowResultModal(true);
      
    } catch (error: any) {
      logger.error('Erro ao atualizar atendimento', error, { 
        userId: user?.id,
        atendimentoId 
      });

      let errorMessage = 'Não foi possível atualizar o atendimento. Tente novamente.';
      
      if (error.message?.includes('Network')) {
        errorMessage = 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
      } else if (error.response?.message) {
        errorMessage = error.response.message;
      }
      
      setResultModal({
        success: false,
        title: 'Erro',
        message: errorMessage,
      });
      setShowResultModal(true);
    } finally {
      setShowFullScreenLoading(false);
    }
  };

  const handleCloseResultModal = () => {
    setShowResultModal(false);
    
    if (resultModal?.success) {
      router.back();
    }
    
    setResultModal(null);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#7902E0" />
          </TouchableOpacity>
          <Text style={styles.title}>Editar Atendimento</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Cliente */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Cliente</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Nome do cliente"
              placeholderTextColor="#9CA3AF"
              value={formData.clienteNome}
              onChangeText={(text) => setFormData({ ...formData, clienteNome: text })}
              editable={false}
            />
          </View>

          {/* Card Endereço */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Endereço</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Endereço do atendimento"
              placeholderTextColor="#9CA3AF"
              value={formData.clienteEndereco}
              onChangeText={(text) => setFormData({ ...formData, clienteEndereco: text })}
            />
          </View>

          {/* Header dos Equipamentos */}
          <View style={styles.equipmentHeader}>
            <Text style={styles.equipmentHeaderText}>Selecione o tipo do produto:</Text>
          </View>

          {/* Ícones de ação rápida - Scroll horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsRow}
            style={styles.quickActionsContainer}
          >
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => selectEquipment('Refrigerador/Freezer')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle,
                selectedEquipment === 'Refrigerador/Freezer' && styles.iconCircleSelected
              ]}>
                <Refrigerator size={24} color="#fff" />
                {selectedEquipment === 'Refrigerador/Freezer' && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.quickActionLabel,
                selectedEquipment === 'Refrigerador/Freezer' && styles.quickActionLabelSelected
              ]}>
                Refrigerador{'\n'}/Freezer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => selectEquipment('Ar Condicionado')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle,
                selectedEquipment === 'Ar Condicionado' && styles.iconCircleSelected
              ]}>
                <AirVent size={24} color="#fff" />
                {selectedEquipment === 'Ar Condicionado' && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.quickActionLabel,
                selectedEquipment === 'Ar Condicionado' && styles.quickActionLabelSelected
              ]}>
                Ar{'\n'}Condicionado
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => selectEquipment('Microondas/Fogão')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle,
                selectedEquipment === 'Microondas/Fogão' && styles.iconCircleSelected
              ]}>
                <Heater size={24} color="#fff" />
                {selectedEquipment === 'Microondas/Fogão' && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.quickActionLabel,
                selectedEquipment === 'Microondas/Fogão' && styles.quickActionLabelSelected
              ]}>
                Microondas{'\n'}Fogão
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => selectEquipment('Máquina de Lavar')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle,
                selectedEquipment === 'Máquina de Lavar' && styles.iconCircleSelected
              ]}>
                <WashingMachine size={24} color="#FFF" />
                {selectedEquipment === 'Máquina de Lavar' && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.quickActionLabel,
                selectedEquipment === 'Máquina de Lavar' && styles.quickActionLabelSelected
              ]}>
                Máquina{'\n'}Lavar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={openProductModal}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconCircle, 
                styles.cameraCircle,
                selectedEquipment && !['Refrigerador/Freezer', 'Ar Condicionado', 'Microondas/Fogão', 'Máquina de Lavar'].includes(selectedEquipment) && styles.iconCircleSelected
              ]}>
                <CirclePlus size={24} color="#FFF" />
                {selectedEquipment && !['Refrigerador/Freezer', 'Ar Condicionado', 'Microondas/Fogão', 'Máquina de Lavar'].includes(selectedEquipment) && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.quickActionLabel,
                selectedEquipment && !['Refrigerador/Freezer', 'Ar Condicionado', 'Microondas/Fogão', 'Máquina de Lavar'].includes(selectedEquipment) && styles.quickActionLabelSelected
              ]}>
                Outros
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Card Modelo */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Modelo</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ex.: DF50X ou BWK12AKANA"
              placeholderTextColor="#9CA3AF"
              value={formData.modelo}
              onChangeText={(text) => setFormData({ ...formData, modelo: text })}
            />
          </View>

          {/* Card Data */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Data</Text>
            </View>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#1BAFE0" />
              <Text style={styles.dateTimeText}>
                {formData.data || 'DD/MM/AA'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                minimumDate={new Date()}
                locale="pt-BR"
              />
            )}
          </View>

          {/* Card Status */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Status do atendimento</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusRow}
            >
              {ESTAGIOS_VALIDOS.map((status) => (
                <TouchableOpacity 
                  key={status}
                  style={styles.statusAction}
                  onPress={() => setFormData({ ...formData, status })}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.statusCircle,
                    { backgroundColor: STATUS_COLORS[status] },
                    formData.status === status && styles.statusCircleSelected
                  ]}>
                    <View style={[
                      styles.statusDot,
                      formData.status === status && styles.statusDotSelected
                    ]} />
                    {formData.status === status && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.statusLabel,
                    formData.status === status && styles.statusLabelSelected
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Card Valor da Visita */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Valor da Visita</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="R$ 0,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={formData.valorVisita}
              onChangeText={handleValueChange}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity
          style={styles.fabContainer}
          activeOpacity={0.8}
          onPress={handleSave}
        >
          <LinearGradient colors={['#1BAFE0', '#7902E0']} style={styles.fab}>
            <Text style={styles.fabText}>SALVAR ALTERAÇÕES</Text>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Modal de Novo Produto */}
      <Modal
        visible={showProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowProductModal(false)}
        >
          <Pressable style={styles.productModalContainer}>
            <View style={styles.productModalHeader}>
              <Text style={styles.productModalTitle}>Digite o nome do produto</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.productInput}
              placeholder="Ex: Televisão, Ventilador, etc..."
              placeholderTextColor="#9CA3AF"
              value={newProductName}
              onChangeText={setNewProductName}
              autoFocus
              onSubmitEditing={saveNewProduct}
            />
            
            <TouchableOpacity 
              style={styles.saveProductButton} 
              onPress={saveNewProduct}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1BAFE0', '#7902E0']}
                style={styles.saveProductButtonGradient}
              >
                <Text style={styles.saveProductButtonText}>Salvar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Resultado */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseResultModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              {resultModal?.success ? (
                <Ionicons name="checkmark-circle" size={60} color="#10B981" />
              ) : (
                <Ionicons name="close-circle" size={60} color="#EF4444" />
              )}
            </View>
            
            <Text style={styles.modalTitle}>{resultModal?.title}</Text>
            <Text style={styles.modalMessage}>{resultModal?.message}</Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={handleCloseResultModal}>
              <LinearGradient
                colors={resultModal?.success ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>
                  {resultModal?.success ? 'Continuar' : 'Tentar Novamente'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading de Tela Cheia */}
      {showFullScreenLoading && (
        <View style={styles.fullScreenLoading}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#1BAFE0" />
            <Text style={styles.loadingText}>Salvando alterações...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#7902E0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9FAFB',
    marginTop: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F9FAFB',
    marginTop: 12,
  },
  dateTimeText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  statusRow: {
    paddingHorizontal: 10,
    gap: 16,
    paddingVertical: 12,
  },
  statusAction: {
    alignItems: 'center',
    width: 80,
  },
  statusCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusCircleSelected: {
    borderColor: '#fff',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  statusDotSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  statusLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  statusLabelSelected: {
    color: '#10B981',
    fontWeight: '700',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#7902E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 350,
    width: '100%',
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalButton: {
    width: '100%',
    borderRadius: 12,
  },
  modalButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContent: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1BAFE0',
    textAlign: 'center',
  },
  equipmentHeader: {
    paddingHorizontal: 4,
    marginBottom: 12,
    marginTop: 4,
  },
  equipmentHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 0.3,
  },
  quickActionsContainer: {
    marginBottom: 16,
  },
  quickActionsRow: {
    paddingHorizontal: 10,
    gap: 16,
  },
  quickAction: {
    alignItems: 'center',
    width: 80,
    paddingTop: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1BAFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#7902E0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'visible',
  },
  iconCircleSelected: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  cameraCircle: {
    backgroundColor: '#7902E0',
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  quickActionLabelSelected: {
    color: '#10B981',
    fontWeight: '700',
  },
  productModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    width: '90%',
    maxWidth: 400,
  },
  productModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  productModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  productInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  saveProductButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveProductButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveProductButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
