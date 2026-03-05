import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface ClientData {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  referencia: string;
  observacoes: string;
}

interface ValidationErrors {
  nome?: string;
  telefone?: string;
  cep?: string;
}

export default function NovoCliente() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // Detectar se está em modo de edição
  const isEditMode = params.editMode === 'true';
  const clienteId = params.clienteId as string;
  
  // Detectar se veio da tela de seleção de cliente
  const fromSelectClient = params.fromSelectClient === 'true';
  
  const [clientData, setClientData] = useState<ClientData>({
    nome: (params.nome as string) || '',
    cpf: (params.documento as string) || '',
    telefone: (params.telefone as string) || '',
    email: (params.email as string) || '',
    cep: (params.cep as string) || '',
    rua: (params.rua as string) || '',
    numero: (params.numero as string) || '',
    referencia: (params.referencia as string) || '',
    observacoes: (params.observacoes as string) || '',
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFullScreenLoading, setShowFullScreenLoading] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showCepSuccessModal, setShowCepSuccessModal] = useState(false);
  const [showCepErrorModal, setShowCepErrorModal] = useState(false);
  const [cepErrorMessage, setCepErrorMessage] = useState('');
  const [resultModal, setResultModal] = useState<{
    success: boolean;
    title: string;
    message: string;
    codigo?: string;
  } | null>(null);

  const handleGoBack = () => {
    router.back();
  };

  const buscarCep = async () => {
    const cepLimpo = clientData.cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      setCepErrorMessage('Por favor, insira um CEP válido com 8 dígitos.');
      setShowCepErrorModal(true);
      return;
    }

    setIsLoadingCep(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        setCepErrorMessage('O CEP informado não foi encontrado. Verifique e tente novamente.');
        setShowCepErrorModal(true);
        return;
      }

      // Concatenar logradouro, bairro e cidade em uma única string
      const enderecoCompleto = [
        data.logradouro,
        data.bairro,
        data.localidade // cidade
      ].filter(Boolean).join(', '); // Remove campos vazios e junta com vírgula

      setClientData(prev => ({
        ...prev,
        rua: enderecoCompleto || '',
      }));

      setShowCepSuccessModal(true);
      
    } catch (error) {
      setCepErrorMessage('Não foi possível buscar o CEP. Verifique sua conexão com a internet e tente novamente.');
      setShowCepErrorModal(true);
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsLoadingCep(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    
    // Validar nome
    if (!clientData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }
    
    // Validar telefone
    if (!clientData.telefone.trim()) {
      errors.telefone = 'Telefone é obrigatório';
    } else if (clientData.telefone.replace(/\D/g, '').length < 10) {
      errors.telefone = 'Telefone deve ter pelo menos 10 dígitos';
    }
    
    // Validar CEP
    if (!clientData.cep.trim()) {
      errors.cep = 'CEP é obrigatório';
    } else if (clientData.cep.replace(/\D/g, '').length !== 8) {
      errors.cep = 'CEP deve ter 8 dígitos';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) {
      setShowValidationModal(true);
      return;
    }

    if (!user?.id) {
      Alert.alert('Erro de Autenticação', 'Usuário não autenticado. Faça login novamente.');
      return;
    }

    setIsSaving(true);
    setShowFullScreenLoading(true);

    try {
      // Preparar dados para envio ao backend
      const clientPayload = {
        uid: user.id, // UID do usuário autenticado
        nome: clientData.nome.trim(),
        documento: clientData.cpf.trim(), // CPF mapeado para 'documento'
        telefone: clientData.telefone.trim(),
        email: clientData.email.trim(),
        cep: clientData.cep.trim(),
        rua: clientData.rua.trim(),
        numero: clientData.numero.trim(),
        referencia: clientData.referencia.trim(),
        observacoes: clientData.observacoes.trim(),
      };

      console.log('Enviando dados para API:', clientPayload);

      // Definir URL e método baseado no modo (edição ou cadastro)
      const url = isEditMode 
        ? `https://back-end-falling-shadow-6301.fly.dev/clientes/${user.id}/${clienteId}`
        : 'https://back-end-falling-shadow-6301.fly.dev/clientes';
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientPayload),
      });

      const responseData = await response.json();
      console.log('Resposta da API:', responseData);

      if (response.ok && responseData.success) {
        // Sucesso
        
        // Se veio da tela de seleção de cliente, navegar para new_atend com os dados do cliente
        if (fromSelectClient && !isEditMode) {
          console.log('Navegando para new_atend com dados do cliente');
          console.log('Response Data completo:', responseData);
          
          const enderecoCompleto = `${clientData.rua}, ${clientData.numero}${clientData.referencia ? ` - ${clientData.referencia}` : ''} - CEP: ${clientData.cep}`;
          
          // Tentar pegar o ID de várias formas possíveis
          const clientId = responseData.clienteId || responseData.id || responseData.data?.id || '';
          console.log('Client ID encontrado:', clientId);
          
          const params = {
            clienteId: clientId,
            clienteNome: clientData.nome,
            clienteCodigo: responseData.codigo || '',
            clienteCPF: clientData.cpf,
            clienteTelefone: clientData.telefone,
            clienteEmail: clientData.email,
            clienteEndereco: enderecoCompleto,
          };
          
          console.log('Parâmetros sendo enviados:', params);
          
          // Fechar modais e loadings antes de navegar
          setIsSaving(false);
          setShowFullScreenLoading(false);
          
          // Usar push ao invés de replace para garantir que os parâmetros sejam passados
          router.push({
            pathname: '/new_atend',
            params: params
          });
          return; // Não mostrar modal, navegar diretamente
        }
        
        setResultModal({
          success: true,
          title: 'Sucesso!',
          message: responseData.message || (isEditMode ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!'),
          codigo: isEditMode ? undefined : responseData.codigo, // Só mostrar código no cadastro
        });
        setShowResultModal(true);
      } else {
        // Erro do backend
        let errorMessage = isEditMode ? 'Não foi possível atualizar o cliente.' : 'Não foi possível cadastrar o cliente.';
        
        if (response.status === 400) {
          errorMessage = 'Dados inválidos. Verifique se todos os campos obrigatórios estão preenchidos corretamente.';
        } else if (response.status === 409) {
          errorMessage = isEditMode 
            ? 'Conflito de dados. Verifique se CPF, telefone ou e-mail já não estão em uso por outro cliente.'
            : 'Cliente já cadastrado. Verifique se CPF, telefone ou e-mail já não estão em uso.';
        } else if (response.status === 500) {
          errorMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.';
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }

        setResultModal({
          success: false,
          title: isEditMode ? 'Erro na Atualização' : 'Erro no Cadastro',
          message: errorMessage,
        });
        setShowResultModal(true);
      }
      
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      
      setResultModal({
        success: false,
        title: 'Erro de Conexão',
        message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
      });
      setShowResultModal(true);
    } finally {
      setIsSaving(false);
      setShowFullScreenLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowResultModal(false);
    
    if (resultModal?.success) {
      // Se foi sucesso, limpar formulário e voltar
      setClientData({
        nome: '',
        cpf: '',
        telefone: '',
        email: '',
        cep: '',
        rua: '',
        numero: '',
        referencia: '',
        observacoes: '',
      });
      setValidationErrors({});
      router.back();
    }
    
    setResultModal(null);
  };

  const handleCloseValidationModal = () => {
    setShowValidationModal(false);
  };

  const handleCloseCepSuccessModal = () => {
    setShowCepSuccessModal(false);
  };

  const handleCloseCepErrorModal = () => {
    setShowCepErrorModal(false);
    setCepErrorMessage('');
  };

  // Função para limpar erro específico quando o usuário começar a digitar
  const clearFieldError = (fieldName: keyof ValidationErrors) => {
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleGoBack} 
          style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}
          disabled={isSaving}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isSaving ? "#999" : "#111"} 
          />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? 'Editar Cliente' : 'Novo Cliente'}</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}
          disabled={isSaving}
        >
          <Ionicons 
            name="checkmark" 
            size={24} 
            color={isSaving ? "#999" : "#111"} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Formulário */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContentContainer}
        >
          <View style={styles.formContainer}>
          
          {/* Nome Completo */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, validationErrors.nome && styles.inputError]}
              placeholder="Nome completo"
              placeholderTextColor="#9CA3AF"
              value={clientData.nome}
              onChangeText={(text) => {
                setClientData(prev => ({ ...prev, nome: text }));
                clearFieldError('nome');
              }}
            />
          </View>
          {validationErrors.nome && <Text style={styles.errorText}>{validationErrors.nome}</Text>}

          {/* CPF */}
          <View style={styles.inputContainer}>
            <Ionicons name="card-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="CPF"
              placeholderTextColor="#9CA3AF"
              value={clientData.cpf}
              onChangeText={(text) => setClientData(prev => ({ ...prev, cpf: text }))}
              keyboardType="numeric"
              maxLength={14}
            />
          </View>

          {/* Telefone */}
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, validationErrors.telefone && styles.inputError]}
              placeholder="Telefone"
              placeholderTextColor="#9CA3AF"
              value={clientData.telefone}
              onChangeText={(text) => {
                setClientData(prev => ({ ...prev, telefone: text }));
                clearFieldError('telefone');
              }}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
          {validationErrors.telefone && <Text style={styles.errorText}>{validationErrors.telefone}</Text>}

          {/* E-mail */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#9CA3AF"
              value={clientData.email}
              onChangeText={(text) => setClientData(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* CEP */}
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithButton, validationErrors.cep && styles.inputError]}
              placeholder="CEP"
              placeholderTextColor="#9CA3AF"
              value={clientData.cep}
              onChangeText={(text) => {
                setClientData(prev => ({ ...prev, cep: text }));
                clearFieldError('cep');
              }}
              keyboardType="numeric"
              maxLength={9}
            />
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={buscarCep}
              disabled={isLoadingCep}
            >
              <Ionicons 
                name={isLoadingCep ? "sync-outline" : "search"} 
                size={18} 
                color="#6C4CF7" 
              />
            </TouchableOpacity>
          </View>
          {validationErrors.cep && <Text style={styles.errorText}>{validationErrors.cep}</Text>}

          {/* Rua */}
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Rua, Bairro"
              placeholderTextColor="#9CA3AF"
              value={clientData.rua}
              onChangeText={(text) => setClientData(prev => ({ ...prev, rua: text }))}
            />
          </View>

          {/* Número */}
          <View style={styles.inputContainer}>
            <Ionicons name="home-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Número"
              placeholderTextColor="#9CA3AF"
              value={clientData.numero}
              onChangeText={(text) => setClientData(prev => ({ ...prev, numero: text }))}
              keyboardType="numeric"
            />
          </View>

          {/* Referência */}
          <View style={styles.inputContainer}>
            <Ionicons name="bookmark-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Referência (opcional)"
              placeholderTextColor="#9CA3AF"
              value={clientData.referencia}
              onChangeText={(text) => setClientData(prev => ({ ...prev, referencia: text }))}
            />
          </View>

          {/* Observações */}
          <View style={styles.inputContainer}>
            <Ionicons name="chatbox-outline" size={20} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações (opcional)"
              placeholderTextColor="#9CA3AF"
              value={clientData.observacoes}
              onChangeText={(text) => setClientData(prev => ({ ...prev, observacoes: text }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Botão Salvar Cliente */}
          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            <View style={[styles.saveButtonGradient, isSaving && { backgroundColor: '#9CA3AF' }]}>
              {isSaving ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{isEditMode ? 'Salvando alterações...' : 'Salvando...'}</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>{isEditMode ? 'Salvar Alterações' : 'Salvar Cliente'}</Text>
              )}
            </View>
          </TouchableOpacity>

        </View>
        </ScrollView>
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
            
            <Text style={styles.validationModalTitle}>Formulário Inválido</Text>
            <Text style={styles.validationModalMessage}>
              Por favor, corrija os campos em destaque para continuar.
            </Text>
            
            <View style={styles.validationModalErrors}>
              {validationErrors.nome && (
                <View style={styles.errorRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorRowText}>{validationErrors.nome}</Text>
                </View>
              )}
              {validationErrors.telefone && (
                <View style={styles.errorRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorRowText}>{validationErrors.telefone}</Text>
                </View>
              )}
              {validationErrors.cep && (
                <View style={styles.errorRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorRowText}>{validationErrors.cep}</Text>
                </View>
              )}
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
        onRequestClose={handleCloseModal}
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
            
            {resultModal?.codigo && (
              <View style={styles.codigoContainer}>
                <Text style={styles.codigoLabel}>Código do Cliente:</Text>
                <Text style={styles.codigoValue}>{resultModal.codigo}</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.modalButton} onPress={handleCloseModal}>
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

      {/* Modal de Sucesso do CEP */}
      <Modal
        visible={showCepSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseCepSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            </View>
            
            <Text style={styles.modalTitle}>CEP Encontrado!</Text>
            <Text style={styles.modalMessage}>
              Endereço encontrado e preenchido automaticamente.
            </Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={handleCloseCepSuccessModal}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>Continuar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Erro do CEP */}
      <Modal
        visible={showCepErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseCepErrorModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="close-circle" size={60} color="#EF4444" />
            </View>
            
            <Text style={styles.modalTitle}>CEP não encontrado</Text>
            <Text style={styles.modalMessage}>
              {cepErrorMessage}
            </Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={handleCloseCepErrorModal}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>Tentar Novamente</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading de Tela Cheia */}
      {showFullScreenLoading && (
        <View style={styles.fullScreenLoading}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#6C4CF7" />
            <Text style={styles.loadingText}>{isEditMode ? 'Salvando alterações...' : 'Salvando cliente...'}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 35,
    paddingHorizontal: 30,
    paddingBottom: 15, // Reduzido para aproximar dos campos
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    // Você pode ajustar a distância aqui:
    // marginHorizontal: 10, // Para adicionar espaço nas laterais
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    // Você pode ajustar a posição do título aqui:
    // marginLeft: 20, // Para mover o título para a direita
    // marginRight: 20, // Para mover o título para a esquerda
    // textAlign: 'center', // Para centralizar o texto
    // flex: 1, // Para que o título ocupe o espaço disponível
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingTop: 5, // Reduzido para aproximar do título
    paddingBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
    color: '#666',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    paddingVertical: 16,
    fontWeight: '400',
  },
  inputWithButton: {
    paddingRight: 50,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  searchButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 16,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C4CF7',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  codigoContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    width: '100%',
  },
  codigoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  codigoValue: {
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
    color: '#6C4CF7',
    textAlign: 'center',
  },
});
