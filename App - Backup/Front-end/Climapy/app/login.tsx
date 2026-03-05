import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('error'); // 'error' ou 'success'
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const showModal = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
    if (modalType === 'success') {
      router.replace('../Home'); // Usar replace para não permitir voltar ao login
    }
  };

  const handleLogin = async () => {
    if (isLoading) return; // Evita múltiplos cliques
    
    if (!username.trim() || !password.trim()) {
      showModal('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    try {
      // Garantir que o loading seja visível por pelo menos 500ms
      const [result] = await Promise.all([
        login(username.trim(), password.trim(), rememberMe),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);

      if (result.success) {
        // Login bem-sucedido
        showModal('Sucesso', 'Login realizado com sucesso! Bem-vindo de volta.', 'success');
      } else {
        // Erro no login
        showModal('Erro', result.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      showModal('Erro de Conexão', 'Erro de conexão. Verifique sua internet e tente novamente.');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Recuperar Senha', 'Funcionalidade em desenvolvimento');
  };

  const handleSignUp = () => {
    Alert.alert('Cadastro', 'Funcionalidade em desenvolvimento');
    // router.push('/signup'); // Descomente quando a rota existir
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ImageBackground
        source={require('../assets/images/BG.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo e Boas-vindas */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Formulário de Login */}
          <View style={styles.formContainer}>
            {/* Campo Usuário */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

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

            {/* Lembrar de mim e Esqueceu a senha */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.rememberContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.rememberText}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/Forgot')}>
                <Text style={styles.forgotText}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Login */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={["#4F3CC9", "#3117A3", "#8A2BE2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Link para cadastro */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Novo usuário? </Text>
              <TouchableOpacity onPress={() => router.push('/Signup')}>
                <Text style={styles.signupLink}>Cadastre-se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 30,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: -35,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4169E1',
    textAlign: 'center',
    marginBottom: 10,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 15,
    padding: 5,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4169E1',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4169E1',
  },
  rememberText: {
    fontSize: 14,
    color: '#666',
  },
  forgotText: {
    fontSize: 14,
    color: '#4169E1',
    fontWeight: '500',
  },
  loginButton: {
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
  },
  loginButtonDisabled: {
    opacity: 0.7,
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
  loginButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(49,23,163,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  signupText: {
    fontSize: 14,
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    color: '#4169E1',
    fontWeight: 'bold',
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
