import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  formBox: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 32,
    padding: 32,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 10,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1565c0',
    textAlign: 'center',
    marginBottom: 18,
  },
  infoText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#F5F8FA',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    width: '100%',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3117a3ff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 140,
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  buttonGradient: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexDirection: 'row',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(49,23,163,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Estilos do Modal Customizado
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 32,
    padding: 32,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3117a3ff',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3117a3ff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 120,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
});

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('error'); // 'error' ou 'success'
  const router = useRouter();
  const { forgotPassword, isLoading } = useAuth();

  const showModal = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
    if (modalType === 'success') {
      router.push('/login');
    }
  };

  const handleForgot = async () => {
    if (isLoading) return; // Evita múltiplos cliques
    
    if (!email.trim()) {
      showModal('Erro', 'Por favor, informe seu e-mail');
      return;
    }
    
    try {
      const result = await forgotPassword(email.trim());
      
      if (result.success) {
        showModal(
          'Email Enviado!', 
          'Se o e-mail estiver cadastrado em nosso sistema, você receberá instruções para redefinir sua senha. Verifique sua caixa de entrada e spam.', 
          'success'
        );
      } else {
        showModal('Erro', result.message || 'Não foi possível enviar o e-mail. Verifique se o e-mail está correto e tente novamente.');
      }
    } catch (error) {
      console.error('Erro no forgot password:', error);
      showModal('Erro de Conexão', 'Ocorreu um erro ao tentar recuperar a senha. Verifique sua conexão com a internet e tente novamente.');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/BG.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.formBox}>
            <Text style={styles.title}>Recuperar Senha</Text>
            <Text style={styles.infoText}>Informe seu e-mail cadastrado e enviaremos instruções para redefinir sua senha.</Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              activeOpacity={isLoading ? 1 : 0.85} 
              onPress={handleForgot}
              disabled={isLoading}
            >
              <LinearGradient
                colors={["#4F3CC9", "#3117A3", "#8A2BE2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Enviando...</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Enviar</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Customizado */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={hideModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                activeOpacity={0.85}
                onPress={hideModal}
              >
                <LinearGradient
                  colors={["#4F3CC9", "#3117A3", "#8A2BE2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}
