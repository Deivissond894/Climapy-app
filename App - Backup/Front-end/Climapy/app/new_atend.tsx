import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams , useFocusEffect } from 'expo-router';

import { AirVent, CirclePlus, Heater, Refrigerator, WashingMachine } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ESTAGIOS_VALIDOS, STATUS_COLORS, STATUS_PADRAO, StatusAtendimento } from '../constants/atendimento';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { atendimentoService } from '../services/atendimento';
import { logger } from '../services/logger';

interface FormData {
  clienteNome: string;
  clienteId: string;
  clienteCodigo: string;
  clienteCPF: string;
  clienteTelefone: string;
  clienteEmail: string;
  clienteEndereco: string;
  modelo: string;
  foto: string | null;
  data: string;
  hora: string;
  descricaoDefeito: string;
  valorVisita: string;
}

export default function NewAtendScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    clienteNome: '',
    clienteId: '',
    clienteCodigo: '',
    clienteCPF: '',
    clienteTelefone: '',
    clienteEmail: '',
    clienteEndereco: '',
    modelo: '',
    foto: null,
    data: '',
    hora: '',
    descricaoDefeito: '',
    valorVisita: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusAtendimento>(STATUS_PADRAO);
  const [isTimeEnabled, setIsTimeEnabled] = useState(true); // Controla se a hora está habilitada ou anulada

  // Estados dos modais
  const [showResultModal, setShowResultModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showFullScreenLoading, setShowFullScreenLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [resultModal, setResultModal] = useState<{
    success: boolean;
    title: string;
    message: string;
    pedidoNumero?: string;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirmExitModal, setShowConfirmExitModal] = useState(false);

  // Detectar tentativa de voltar (Android)
  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        const temDados = formData.clienteNome || formData.modelo || formData.descricaoDefeito;
        
        if (temDados) {
          setShowConfirmExitModal(true);
          return true; // Impede o voltar padrão
        }
        return false; // Permite o voltar padrão
      };

      // Apenas adiciona listener no Android
            if (Platform.OS === 'android') {
              const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
              return () => subscription.remove();
            }
    }, [formData])
  );

  // Atualizar formData quando receber parâmetros da tela de seleção
  useEffect(() => {
    // Usar clienteCodigo como validação principal, pois sempre é retornado pela API
    if (params.clienteCodigo && params.clienteNome) {
      setFormData(prev => ({
        ...prev,
        clienteId: (params.clienteId as string) || (params.clienteCodigo as string) || '',
        clienteNome: params.clienteNome as string,
        clienteCodigo: (params.clienteCodigo as string) || '',
        clienteCPF: (params.clienteCPF as string) || '',
        clienteTelefone: (params.clienteTelefone as string) || '',
        clienteEmail: (params.clienteEmail as string) || '',
        clienteEndereco: (params.clienteEndereco as string) || '',
      }));
    }
  }, [params.clienteId, params.clienteCodigo, params.clienteNome, params.clienteCPF, params.clienteTelefone, params.clienteEmail, params.clienteEndereco]);

  // Formatar data para DD/MM/AAAA
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Retornar data em ISO para salvar no backend
  const getDateISO = (date: Date): string => {
    return date.toISOString();
  };

  // Formatar data ISO para exibição (DD/MM/YYYY)
  const formatDisplayDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return 'DD/MM/AA';
    }
  };

  // Formatar hora para HH:MM
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const onDateChange = (event: any, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      setSelectedDate(selected);
      setFormData({ ...formData, data: getDateISO(selected) });
    }
  };

  const onTimeChange = (event: any, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      setSelectedTime(selected);
      setFormData({ ...formData, hora: formatTime(selected) });
    }
  };

  const toggleTimeEnabled = () => {
    setIsTimeEnabled(!isTimeEnabled);
    if (isTimeEnabled) {
      // Se está desabilitando, limpar a hora
      setFormData({ ...formData, hora: '' });
    }
  };

  const selectClient = () => {
    router.push('/select_client');
  };

  const selectEquipment = (equipment: string) => {
    setSelectedEquipment(equipment);
    // NÃO preencher o campo modelo automaticamente
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

  const takePhoto = async () => {
    try {
      // Pedir permissão de câmera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'É necessário permitir acesso à câmera para tirar fotos.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Abrir câmera - NÃO pedir base64 para evitar overhead
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (result.canceled) {
        logger.info('Captura de foto cancelada pelo usuário');
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        logger.warn('Nenhum asset retornado pela câmera');
        return;
      }

      const asset = result.assets[0];
      
      // ✅ Armazenar apenas a URI (será feito upload no submit)
      if (!asset.uri) {
        Alert.alert('Erro', 'Não foi possível obter a URI da foto');
        return;
      }

      logger.info('Foto capturada com sucesso', { uri: asset.uri.substring(0, 50) });
      
      setFormData(prev => ({
        ...prev,
        foto: asset.uri, // Apenas a URI - simples e seguro
      }));
      
    } catch (error) {
      logger.error('Erro ao capturar foto', error as Error);
      Alert.alert(
        'Erro',
        'Não foi possível capturar a foto. Tente novamente.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleInitiate = async () => {
    // Validações
    const errors: string[] = [];
    
    if (!formData.clienteNome) {
      errors.push('Selecione um cliente');
    }
    if (!selectedEquipment) {
      errors.push('Selecione o tipo de produto');
    }
    if (!formData.modelo) {
      errors.push('Informe o modelo do equipamento');
    }
    if (!formData.data) {
      errors.push('Defina a data do atendimento');
    }
    if (isTimeEnabled && !formData.hora) {
      errors.push('Defina a hora do atendimento ou anule a hora');
    }
    if (!formData.descricaoDefeito) {
      errors.push('Descreva o defeito do produto');
    }
    if (!formData.valorVisita) {
      errors.push('Informe o valor da visita');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    // Verificar autenticação
    if (!user?.id) {
      logger.error('Tentativa de criar atendimento sem usuário autenticado');
      setResultModal({
        success: false,
        title: 'Erro de Autenticação',
        message: 'Você precisa estar logado para criar um atendimento.',
      });
      setShowResultModal(true);
      return;
    }

    // Iniciar loading
    setShowFullScreenLoading(true);

    try {
      // ✅ PASSO 1: Se tem foto, fazer upload ANTES de criar atendimento
      let fotoUrl = formData.foto;
      
      if (formData.foto && !formData.foto.startsWith('http')) {
        // É URI local - fazer upload
        logger.info('Fazendo upload de foto para backend');
        
        try {
          // Converter URI para blob
          const response = await fetch(formData.foto);
          
          if (!response.ok) {
            throw new Error(`Erro ao ler arquivo: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          // Criar FormData com o blob
          const formDataUpload = new FormData();
          formDataUpload.append('foto', blob, `foto_${Date.now()}.jpg`);
          
          // Fazer upload com FormData
          const uploadResponse: any = await apiService.post(
            '/upload/foto',
            formDataUpload
          );
          
          if (uploadResponse?.success && uploadResponse?.fotoUrl) {
            fotoUrl = uploadResponse.fotoUrl;
            logger.info('Upload de foto concluído', { url: 'ok' });
          } else {
            logger.warn('Upload retornou sem URL, usando URI local');
          }
        } catch (uploadError) {
          logger.warn('Erro ao fazer upload de foto, continuando com URI local', uploadError as Error);
          // Continua com a foto local se houver erro
        }
      }

      // ✅ PASSO 2: Criar atendimento com foto (ou URL já obtida)
      const atendimentoData = {
        uid: user.id,
        clienteId: formData.clienteId || formData.clienteCodigo || 'sem-id',
        clienteCodigo: formData.clienteCodigo,
        clienteNome: formData.clienteNome,
        clienteEndereco: formData.clienteEndereco,
        Produto: selectedEquipment || formData.modelo,
        data: formData.data,
        descricaoDefeito: formData.descricaoDefeito,
        foto: fotoUrl, // URL do backend ou referência local
        hora: isTimeEnabled ? formData.hora : 'Horário comercial',
        modelo: formData.modelo,
        valorVisita: formData.valorVisita,
        Status: selectedStatus || STATUS_PADRAO,
      };

      logger.info('Criando novo atendimento', { 
        clienteCodigo: formData.clienteCodigo,
        produto: selectedEquipment,
        status: selectedStatus
      });
      const { success, atendimento, error } = await atendimentoService.criarAtendimento(user.id, atendimentoData);

      if (!success || !atendimento) {
        logger.error('Erro ao criar atendimento', new Error(error || 'Falha desconhecida'));
        setResultModal({
          success: false,
          title: 'Erro ao criar atendimento',
          message: error || 'Não foi possível iniciar o atendimento. Tente novamente.',
        });
        setShowResultModal(true);
        return;
      }

      setResultModal({
        success: true,
        title: 'Sucesso!',
        message: 'Atendimento iniciado com sucesso!',
        pedidoNumero: atendimento.codigo,
      });
      setShowResultModal(true);
      
    } catch (error: any) {
      logger.error('Erro ao criar atendimento', error, { 
        userId: user?.id 
      });

      // Tratamento de erros específicos
      let errorMessage = 'Não foi possível iniciar o atendimento. Tente novamente.';
      
      if (error.message?.includes('Network')) {
        errorMessage = 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
      } else if (error.message?.includes('400')) {
        errorMessage = 'Dados inválidos. Verifique os campos e tente novamente.';
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
      // Se foi sucesso, limpar formulário e ir para Home diretamente
      setFormData({
        clienteNome: '',
        clienteId: '',
        clienteCodigo: '',
        clienteCPF: '',
        clienteTelefone: '',
        clienteEmail: '',
        clienteEndereco: '',
        modelo: '',
        foto: null,
        data: '',
        hora: '',
        descricaoDefeito: '',
        valorVisita: '',
      });
      setSelectedEquipment(null);
      setSelectedStatus(STATUS_PADRAO);
      setIsTimeEnabled(true);
      
      // Voltar para Home com os cards
      router.replace('/Home');
    }
    
    setResultModal(null);
  };

  const handleCloseValidationModal = () => {
    setShowValidationModal(false);
    setValidationErrors([]);
  };

  // Formatar valor monetário
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

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            const temDados = formData.clienteNome || formData.modelo || formData.descricaoDefeito;
            if (temDados) {
              setShowConfirmExitModal(true);
            } else {
              router.back();
            }
          }}>
            <Ionicons name="arrow-back" size={24} color="#7902E0" />
          </TouchableOpacity>
          <Text style={styles.title}>Novo Atendimento</Text>
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
            
            {formData.clienteNome ? (
                  <View style={styles.clientSelectedCard}>
                    <View style={styles.selectedClientHeader}>
                      <Text style={styles.clientName}>{formData.clienteNome}</Text>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => setFormData({ 
                          ...formData, 
                          clienteNome: '', 
                          clienteId: '',
                          clienteCodigo: '',
                          clienteCPF: '',
                          clienteTelefone: '',
                          clienteEmail: '',
                          clienteEndereco: '',
                        })}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {formData.clienteCodigo && (
                      <View style={styles.clientInfoRow}>
                        <Ionicons name="pricetag-outline" size={16} color="#1BAFE0" />
                        <Text style={styles.clientInfoLabel}>Código:</Text>
                        <Text style={styles.clientInfoValue}>{formData.clienteCodigo}</Text>
                      </View>
                    )}

                    {formData.clienteCPF && (
                      <View style={styles.clientInfoRow}>
                        <Ionicons name="card-outline" size={16} color="#1BAFE0" />
                        <Text style={styles.clientInfoLabel}>CPF:</Text>
                        <Text style={styles.clientInfoValue}>{formData.clienteCPF}</Text>
                      </View>
                    )}

                    {formData.clienteTelefone && (
                      <View style={styles.clientInfoRow}>
                        <Ionicons name="call-outline" size={16} color="#1BAFE0" />
                        <Text style={styles.clientInfoLabel}>Telefone:</Text>
                        <Text style={styles.clientInfoValue}>{formData.clienteTelefone}</Text>
                      </View>
                    )}

                    {formData.clienteEmail && (
                      <View style={styles.clientInfoRow}>
                        <Ionicons name="mail-outline" size={16} color="#1BAFE0" />
                        <Text style={styles.clientInfoLabel}>E-mail:</Text>
                        <Text style={styles.clientInfoValue}>{formData.clienteEmail}</Text>
                      </View>
                    )}

                    {formData.clienteEndereco && (
                      <View style={styles.clientInfoRow}>
                        <Ionicons name="location-outline" size={16} color="#1BAFE0" />
                        <Text style={styles.clientInfoLabel}>Endereço:</Text>
                        <Text style={styles.clientInfoValue}>{formData.clienteEndereco}</Text>
                      </View>
                    )}
                  </View>
                ) : (
              <TouchableOpacity style={styles.addButton} onPress={selectClient}>
                <Ionicons name="add-circle-outline" size={24} color="#1BAFE0" />
                <Text style={styles.addButtonText}>Adicionar Cliente</Text>
              </TouchableOpacity>
            )}
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

          {/* Header do Status */}
          <View style={styles.equipmentHeader}>
            <Text style={styles.equipmentHeaderText}>Selecione o status do atendimento:</Text>
          </View>

          {/* Botões de Status - Scroll horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsRow}
            style={styles.quickActionsContainer}
          >
            {ESTAGIOS_VALIDOS.filter((status) => status !== 'Sob Consulta').map((status) => (
              <TouchableOpacity 
                key={status}
                style={styles.quickAction}
                onPress={() => setSelectedStatus(status)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.statusCircle,
                  { backgroundColor: STATUS_COLORS[status] },
                  selectedStatus === status && styles.statusCircleSelected
                ]}>
                  <View style={[
                    styles.statusDot,
                    selectedStatus === status && styles.statusDotSelected
                  ]} />
                  {selectedStatus === status && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.quickActionLabel,
                  selectedStatus === status && styles.quickActionLabelSelected
                ]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
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
            <TouchableOpacity style={styles.addButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#1BAFE0" />
              <Text style={styles.addButtonText}>Adicionar uma foto</Text>
            </TouchableOpacity>

            {/* Preview da foto se capturada */}
            {formData.foto && (
              <View style={styles.photoPreviewContainer}>
                <View style={styles.photoPreview}>
                  <View style={styles.photoCheckContainer}>
                    <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                    <Text style={styles.photoCheckText}>Foto capturada</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => setFormData({ ...formData, foto: null })}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.removePhotoText}>Remover</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card Data e Hora */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Data e Hora</Text>
            </View>
            
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#1BAFE0" />
                <Text style={styles.dateTimeText}>
                  {formatDisplayDate(formData.data)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateTimeButton,
                  !isTimeEnabled && styles.dateTimeButtonDisabled
                ]}
                onPress={() => isTimeEnabled && setShowTimePicker(true)}
                disabled={!isTimeEnabled}
              >
                <Ionicons 
                  name="time-outline" 
                  size={20} 
                  color={isTimeEnabled ? "#1BAFE0" : "#9CA3AF"} 
                />
                <Text style={[
                  styles.dateTimeText,
                  !isTimeEnabled && styles.dateTimeTextDisabled
                ]}>
                  {isTimeEnabled ? (formData.hora || '--:--') : 'A combinar'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Checkbox para anular hora */}
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={toggleTimeEnabled}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                !isTimeEnabled && styles.checkboxChecked
              ]}>
                {!isTimeEnabled && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                Horário comercial
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

            {showTimePicker && isTimeEnabled && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                locale="pt-BR"
                is24Hour={true}
              />
            )}
          </View>

          {/* Card Descrição do Defeito */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Descreva o defeito do produto</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva os problemas relatados pelo cliente..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.descricaoDefeito}
              onChangeText={(text) => setFormData({ ...formData, descricaoDefeito: text })}
            />
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

        {/* Botão Iniciar Atendimento */}
        <TouchableOpacity
          style={styles.fabContainer}
          activeOpacity={0.8}
          onPress={handleInitiate}
        >
          <LinearGradient colors={['#1BAFE0', '#7902E0']} style={styles.fab}>
            <Text style={styles.fabText}>INICIAR ATENDIMENTO</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Modal de Validação */}
      <Modal
        visible={showValidationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseValidationModal}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={handleCloseValidationModal}
        >
          <Pressable style={styles.validationModalContainer}>
            <View style={styles.validationModalHeader}>
              <Ionicons name="alert-circle-outline" size={60} color="#F59E0B" />
            </View>
            
            <Text style={styles.validationModalTitle}>Formulário Incompleto</Text>
            <Text style={styles.validationModalMessage}>
              Por favor, preencha todos os campos obrigatórios para continuar.
            </Text>
            
            <View style={styles.validationModalErrors}>
              {validationErrors.map((error, index) => (
                <View key={index} style={styles.errorRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorRowText}>{error}</Text>
                </View>
              ))}
            </View>
            
            <TouchableOpacity 
              style={styles.validationButton} 
              onPress={handleCloseValidationModal}
              activeOpacity={0.8}
            >
              <Text style={styles.validationButtonText}>Entendi</Text>
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
            
            {resultModal?.pedidoNumero && (
              <View style={styles.pedidoContainer}>
                <Text style={styles.pedidoLabel}>Número do Pedido:</Text>
                <Text style={styles.pedidoValue}>{resultModal.pedidoNumero}</Text>
              </View>
            )}
            
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

      {/* Loading de Tela Cheia */}
      {showFullScreenLoading && (
        <View style={styles.fullScreenLoading}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#1BAFE0" />
            <Text style={styles.loadingText}>Iniciando atendimento...</Text>
          </View>
        </View>
      )}

      {/* Modal Confirmação de Saída */}
      <Modal
        visible={showConfirmExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={60} color="#EF4444" />
            </View>
            
            <Text style={styles.modalTitle}>Descartar alterações?</Text>
            <Text style={styles.modalMessage}>
              Você tem dados não salvos. Tem certeza que deseja sair e perder tudo?
            </Text>
            
            <View style={styles.confirmExitButtons}>
              <TouchableOpacity 
                style={styles.confirmExitCancelButton}
                onPress={() => setShowConfirmExitModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmExitCancelText}>Continuar Editando</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalButton} onPress={() => {
                setShowConfirmExitModal(false);
                router.replace('/Home');
              }}>
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Sair</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1BAFE0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1BAFE0',
  },
  photoPreviewContainer: {
    marginTop: 12,
    gap: 8,
  },
  photoPreview: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  photoCheckContainer: {
    alignItems: 'center',
    gap: 8,
  },
  photoCheckText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  removePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  removePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  clientSelectedCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1BAFE0',
    shadowColor: '#7902E0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  selectedClientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  clientInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginLeft: 8,
    marginRight: 4,
    minWidth: 70,
  },
  clientInfoValue: {
    fontSize: 14,
    color: '#3B82F6',
    flex: 1,
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  optionalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    padding: 8,
  },
  optionalButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  dateTimeButtonDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  dateTimeText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dateTimeTextDisabled: {
    color: '#9CA3AF',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1BAFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#1BAFE0',
    borderColor: '#1BAFE0',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
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
  // Estilos dos Modais
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
  pedidoContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    width: '100%',
  },
  pedidoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  pedidoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
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
  // Estilos do Modal de Validação
  validationModalContainer: {
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
  validationModalHeader: {
    marginBottom: 20,
  },
  validationModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 15,
    textAlign: 'center',
  },
  validationModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  validationModalErrors: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorRowText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  validationButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  validationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos do Modal de Produto
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
    letterSpacing: 0.5,
  },
  // Estilos do Loading de Tela Cheia
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
  confirmExitButtons: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginTop: 20,
  },
  confirmExitCancelButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  confirmExitCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
