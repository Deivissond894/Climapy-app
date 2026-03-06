import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  // Função para acordar o servidor em background
  const wakeUpServer = async () => {
    try {
      const response = await fetch('https://back-end-restless-darkness-2411.fly.dev/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Servidor acordado:', response.status);
    } catch (error) {
      console.log('Erro ao acordar servidor (normal):', error);
    }
  };

  // Executa a splash screen e acordar o VPS
  useEffect(() => {
    wakeUpServer();

    // Animação da splash screen
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    // Mostrar tela principal após 2.5 segundos
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Redirecionar após o splash baseado no estado de autenticação
  useEffect(() => {
    if (!showSplash && !isLoading) {
      if (isAuthenticated) {
        // Usuário autenticado → vai para Home
        router.replace('/Home');
      }
      // Se não autenticado, fica na tela de boas-vindas atual
    }
  }, [showSplash, isLoading, isAuthenticated]);

  const handleStart = () => {
    router.push('/login');
  };

  // Renderizar Splash Screen
  if (showSplash) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#FFFFFF" />
        <View style={styles.splashContainer}>
          {/* Gradiente Superior Direito */}
          <LinearGradient
            colors={['#00BFFF', '#4169E1', 'transparent']}
            style={styles.topRightGradient}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Gradiente Inferior Esquerdo */}
          <LinearGradient
            colors={['transparent', '#4169E1', '#8A2BE2']}
            style={styles.bottomLeftGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Logo Centralizado */}
          <Animated.View
            style={[
              styles.splashLogoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </>
    );
  }

  // Renderizar Tela Principal
  return (
    <>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../assets/images/BG.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Main Content */}
          <View style={styles.textContainer}>
            <View style={styles.pitchWrapper}>
              <Text style={styles.eyebrowText}>BEM-VINDO AO CLIMAPY</Text>
              <Text style={styles.mainTitle}>
                Gestão <Text style={styles.highlightText}>Inteligente</Text>{'\n'}
                para Climatização
              </Text>
              <Text style={styles.descriptionText}>
                O controle total dos seus serviços e clientes na palma da sua mão.
              </Text>
            </View>
          </View>

          {/* Start Button */}
          <TouchableOpacity
            style={styles.startButton}
            activeOpacity={0.85}
            onPress={handleStart}
          >
            <LinearGradient
              colors={["#4F3CC9", "#3117A3", "#8A2BE2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.startButtonText}>Começar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  // Estilos da Splash Screen
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRightGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '60%',
    height: '40%',
    borderBottomLeftRadius: 200,
    opacity: 0.3,
  },
  bottomLeftGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '60%',
    height: '40%',
    borderTopRightRadius: 200,
    opacity: 0.3,
  },
  splashLogoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 200,
    height: 200,
  },
  // Estilos da Tela Principal
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 60,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 250,
    height: 250,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  pitchWrapper: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  eyebrowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8A2BE2',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  highlightText: {
    color: '#3117A3',
  },
  descriptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  startButton: {
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
    minWidth: 140, // reduzido
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonGradient: {
    paddingHorizontal: 40, // reduzido
    paddingVertical: 14, // reduzido
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(49,23,163,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
