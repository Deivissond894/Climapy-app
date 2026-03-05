import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Animated,
  Image,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Animação de entrada
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

    // Navegar para a tela inicial após 2.5 segundos
    const timer = setTimeout(() => {
      router.replace('/');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Logo Centralizado */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
