import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import {
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const GOOGLE_MAPS_APIKEY = 'COLOQUE_SUA_CHAVE_DO_GOOGLE_AQUI';

interface QuickAction {
  id: string;
  title: string;
  icon: string;
  route: string;
  color: string;
}

interface Appointment {
  id: string;
  client: string;
  address: string;
  time: string;
  status: string;
  order: string;
  latitude?: number;
  longitude?: number;
}

const quickActions: QuickAction[] = [
  { id: '1', title: 'Central de Atendimento', icon: 'document-text-outline', route: '/os-panel', color: '#E3F2FD' },
  { id: '2', title: 'Assistente Téc - IA', icon: '../assets/images/IA_icon.jpg', route: '/Audio', color: '#F3E5F5' },
  { id: '3', title: 'Cotações/Orçamentos', icon: '../assets/images/Eng.orç.png', route: '/orcamentos-panel', color: '#E8F5E9' },
  { id: '4', title: 'Clientes', icon: 'people-outline', route: '/client_panel', color: '#FFF3E0' },
  { id: '5', title: 'Serviços', icon: 'build-outline', route: '/Service_panel', color: '#FFF9C4' },
  { id: '6', title: 'Agenda', icon: 'calendar-outline', route: '/schedule', color: '#FCE4EC' },
  { id: '7', title: 'Finanças', icon: 'trending-up-outline', route: '/finances', color: '#E0F2F1' },
  { id: '8', title: 'Fórum', icon: 'chatbubbles-outline', route: '/forum', color: '#E1F5FE' },
];

const todayAppointments: Appointment[] = [
  {
    id: '1',
    client: 'ADNILSON NEVES LOPES',
    address: 'Rua das Flores, 123 - Centro',
    time: '08:00',
    status: 'Aberto',
    order: 'PEDIDO - 0125',
    latitude: -23.5505,
    longitude: -46.6333
  },
  {
    id: '2',
    client: 'MARIA SILVA SANTOS',
    address: 'Av. Principal, 456 - Jardim',
    time: '14:00',
    status: 'Agendado',
    order: 'PEDIDO - 0225',
    latitude: -23.5605,
    longitude: -46.6433
  },
  {
    id: '3',
    client: 'JOÃO CARLOS OLIVEIRA',
    address: 'Rua da Paz, 789 - Vila Nova',
    time: '16:30',
    status: 'Garantia',
    order: 'PEDIDO - 0325',
    latitude: -23.5405,
    longitude: -46.6233
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const backPressCount = useRef(0);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeSequence, setRouteSequence] = useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    })();
  }, []);

  const toggleRouteSelection = (id: string) => {
    setRouteSequence(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Controle do botão voltar - APENAS quando a tela Home está em foco
  // Impede volta para login e implementa "Pressione novamente para sair"
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (backPressCount.current === 0) {
          // Primeira vez: mostrar toast
          backPressCount.current = 1;
          ToastAndroid.show('Pressione "Voltar" novamente para sair', ToastAndroid.SHORT);
          
          // Resetar contador após 2 segundos
          setTimeout(() => {
            backPressCount.current = 0;
          }, 2000);
          
          return true; // Impede ação padrão
        } else {
          // Segunda vez: fechar app
          BackHandler.exitApp();
          return false;
        }
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

      return () => backHandler.remove();
    }, [])
  );

  // Função para pegar apenas o primeiro nome
  const getFirstName = () => {
    if (!user?.username) return '';
    return user.username.split(' ')[0];
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login'); // Usar replace para limpar o histórico
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const renderQuickAction = ({ item }: { item: QuickAction }) => (
    <TouchableOpacity
      style={styles.actionItem}
      activeOpacity={0.3}
      onPress={() => {
        // Apenas navega para a rota do item — feedback é temporário via activeOpacity
        if (item.route) router.push(item.route as any);
      }}
    >
      <View style={[styles.actionIcon, { backgroundColor: item.color }]}>
        {/(\.png|\.jpg|\.jpeg|\.webp)$/i.test(item.icon) ? (
          <Image
            source={
              item.icon.includes('IA_icon.jpg') 
                ? require('../assets/images/IA_icon.jpg')
                : item.icon.includes('Eng.orç.png')
                ? require('../assets/images/Eng.orç.png')
                : require('../assets/images/IA_icon.jpg')
            }
            style={{ width: 44, height: 44, borderRadius: 6 }}
            resizeMode="contain"
          />
        ) : /\p{Extended_Pictographic}/u.test(item.icon) ? (
          <Text style={{ fontSize: 26 }}>
            {item.icon}
          </Text>
        ) : (
          <Ionicons 
            name={item.icon as any} 
            size={24} 
            color="#000000ff"
          />
        )}
      </View>
      <Text style={styles.actionText}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    const getCardColor = (status: string) => {
      switch (status) {
        case 'Aberto': return '#FFE4E6'; 
        case 'Agendado': return '#E0F2FE'; 
        case 'Garantia': return '#FEF3C7'; 
        default: return '#FFFFFF';
      }
    };

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => toggleRouteSelection(item.id)} style={[styles.appointmentCard, { backgroundColor: getCardColor(item.status), borderWidth: routeSequence.includes(item.id) ? 2 : 0, borderColor: '#1A32E5' }]}>
        <View style={styles.appointmentHeader}>
          <Text style={styles.appointmentOrder}>{item.order}</Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <Text style={styles.appointmentClient}>{item.client}</Text>
        <Text style={styles.appointmentAddress}>{item.address}</Text>
        <View style={styles.appointmentFooter}>
          <Text style={styles.appointmentTime}>⏰ {item.time}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
            item.status === 'Aberto' && styles.statusOpen,
            item.status === 'Agendado' && styles.statusScheduled,
            item.status === 'Garantia' && styles.statusWarranty,
          ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.welcomeText}>BEM-VINDO TÉCNICO(A)</Text>
              <Text style={styles.userName}>{getFirstName()}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} onPress={handleLogout}>
              <Ionicons name="settings-outline" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCardContainer}>
          <LinearGradient
            colors={['#1BAFE0', '#7902E0', '#1A32E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceContent}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Saldo Atual</Text>
                <Text style={styles.balanceValue}>R$ 540,00</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Saldo Previsto</Text>
                <Text style={styles.balanceValue}>R$ 780,00</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <FlatList
              data={quickActions}
              renderItem={renderQuickAction}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsList}
          />
        </View>

        {/* Map Section */}
        <View style={styles.mapContainer}>
          <MapView
            style={{ height: 300, width: '100%' }}
            showsUserLocation={true}
            initialRegion={{
              latitude: currentLocation?.latitude || -23.5505,
              longitude: currentLocation?.longitude || -46.6333,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
          >
            {todayAppointments.map((apt) => (
              apt.latitude && apt.longitude ? (
                <Marker key={apt.id} coordinate={{ latitude: apt.latitude, longitude: apt.longitude }} title={apt.client} description={apt.order} />
              ) : null
            ))}

            {currentLocation && routeSequence.length > 0 && (
              <MapViewDirections
                origin={currentLocation}
                destination={todayAppointments.find(a => a.id === routeSequence[routeSequence.length - 1]) as any}
                waypoints={routeSequence.slice(0, -1).map(id => todayAppointments.find(a => a.id === id)).filter(Boolean) as any}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#7902E0"
                optimizeWaypoints={true}
              />
            )}
          </MapView>
        </View>

        {/* Today's Appointments */}
        <View style={styles.appointmentsContainer}>
          <Text style={styles.sectionTitle}>ATENDIMENTOS - HOJE</Text>
          <FlatList
            data={todayAppointments}
            renderItem={renderAppointmentCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowFloatingMenu(!showFloatingMenu)}
      >
        <LinearGradient
          colors={['#1BAFE0', '#7902E0']}
          style={styles.fabGradient}
        >
          <Ionicons 
            name={showFloatingMenu ? "close" : "add"} 
            size={28} 
            color="white" 
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* Floating Menu */}
      <Modal
        visible={showFloatingMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFloatingMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowFloatingMenu(false)}
        >
          <View style={styles.floatingMenu}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowFloatingMenu(false);
                router.push('./new_atend');
              }}
            >
              <Ionicons name="document-text-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Novo Atendimento</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowFloatingMenu(false);
                router.push('/client');
              }}
            >
              <Ionicons name="person-add-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Novo Cliente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="calculator-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Novo Orçamento</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 10, // Aumentei o padding superior
    marginTop: 30, // Adicionei margem superior
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 15,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    color: '#1A32E5', // Mudei para a cor azul do tema
    fontWeight: 'bold',
    marginTop: 4, // Adicionei um pequeno espaço entre o texto de boas-vindas e o nome
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 15,
    padding: 8,
  },
  balanceCardContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceContent: {
    flex: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  balanceValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 10,
  },
  balanceIcon: {
    marginLeft: 15,
  },
  moneyIcon: {
    fontSize: 24,
  },
  quickActionsContainer: {
    paddingVertical: 10,
  },
  quickActionsList: {
    paddingHorizontal: 10,
  },
  actionItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 80,
  },
  actionIcon: {
    width: 90,
    height: 50,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  mapContainer: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#E8F4F8',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPin: {
    position: 'absolute',
  },
  appointmentsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    letterSpacing: 1,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appointmentOrder: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A32E5',
  },
  appointmentClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  appointmentAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  appointmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentTime: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusOpen: {
    backgroundColor: '#FFE5E5',
  },
  statusScheduled: {
    backgroundColor: '#E5F3FF',
  },
  statusWarranty: {
    backgroundColor: '#FFF5E5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 100,
  },
  floatingMenu: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  menuText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});