import { Ionicons } from '@expo/vector-icons';
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
  background: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formBox: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 32,
    padding: 32,
    width: '90%', // diminuído
    maxWidth: 340, // diminuído
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    marginVertical: 20,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 10,
    alignSelf: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#3117a3ff',
    textAlign: 'center',
    marginBottom: 28,
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
  inputContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 16,
  },
  passwordInput: {
    paddingRight: 60,
    marginBottom: 0,
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 14,
    padding: 5,
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
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(49,23,163,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  loginText: {
    fontSize: 16,
    color: '#333',
  },
  loginLink: {
    fontSize: 16,
    color: '#1565c0',
    fontWeight: 'bold',
    marginLeft: 4,
  },

  infoText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    marginTop: 10,
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
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('error'); // 'error' ou 'success'
  const router = useRouter();
  const { signup, isLoading } = useAuth();

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

  const handleSignup = async () => {
    if (isLoading) return; // Evita múltiplos cliques
    
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      showModal('Erro', 'Por favor, preencha todos os campos');
      return;
    }
    if (password !== confirmPassword) {
      showModal('Erro', 'As senhas não coincidem');
      return;
    }
    
    try {
      // Garantir que o loading seja visível por pelo menos 500ms
      const [result] = await Promise.all([
        signup(email.trim(), password.trim(), username.trim()),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      
      if (result.success) {
        showModal('Sucesso', 'Cadastro realizado com sucesso! Você pode fazer login agora.', 'success');
      } else {
        showModal('Erro', result.message || 'Não foi possível realizar o cadastro. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro no signup:', error);
      showModal('Erro de Conexão', 'Erro de conexão. Verifique sua internet e tente novamente.');
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.formBox}>
            <Text style={styles.title}>Cadastre-se !</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome de usuário"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            
            {/* Campo Senha */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Senha"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* Campo Confirmar Senha */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirmar senha"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              activeOpacity={isLoading ? 1 : 0.85}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <LinearGradient
                colors={["#4F3CC9", "#3117A3", "#8A2BE2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {isLoading && (
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.buttonText}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginText}>Já tem conta?</Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
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