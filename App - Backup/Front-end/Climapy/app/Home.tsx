import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useDataStore } from '../stores/dataStore';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';

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

export default function HomeScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { atendimentos, fetchData } = useDataStore();
  
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeSequence, setRouteSequence] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'distance' | 'manual'>('distance');
  const [manualAppointments, setManualAppointments] = useState<Appointment[]>([]);
  
  const backPressCount = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (backPressCount.current === 0) {
          backPressCount.current = 1;
          ToastAndroid.show('Pressione "Voltar" novamente para sair', ToastAndroid.SHORT);
          setTimeout(() => { backPressCount.current = 0; }, 2000);
          return true; 
        } else {
          BackHandler.exitApp();
          return false;
        }
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [])
  );

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadAppointmentsWithCoords = async () => {
      if (!atendimentos || atendimentos.length === 0) {
        setAppointments([]);
        setManualAppointments([]);
        return;
      }

      const formatados = await Promise.all(atendimentos.map(async (atend: any, index: number) => {
        let lat = -23.5505 - (index * 0.01);
        let lng = -46.6333 - (index * 0.01);

        if (atend.clienteEndereco) {
          try {
            // Timeout de 3 segundos para não travar a lista inteira
            const geocodePromise = Location.geocodeAsync(atend.clienteEndereco);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Geocode Timeout')), 3000)
            );
            
            const geocoded = await Promise.race([geocodePromise, timeoutPromise]) as any;
            
            if (geocoded && geocoded.length > 0) {
              lat = geocoded[0].latitude;
              lng = geocoded[0].longitude;
            }
          } catch (e) {
            console.log('Ignorando erro de geolocalização para mostrar o card:', atend.clienteEndereco);
          }
        }

        return {
          id: atend.id || atend._id || String(index),
          client: atend.clienteNome || 'Cliente não informado',
          address: atend.clienteEndereco || 'Endereço não informado',
          time: atend.hora || 'A combinar',
          status: atend.Status || 'Aberto',
          order: atend.codigo || `PEDIDO-${index + 1}`,
          latitude: lat,
          longitude: lng,
        };
      }));
      
      if (isMounted) {
        setAppointments(formatados);
        setManualAppointments(formatados);
      }
    };

    loadAppointmentsWithCoords();
    return () => { isMounted = false; };
  }, [atendimentos]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    })();
  }, []);

  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  const moveAppointment = (id: string, direction: 'up' | 'down') => {
    setManualAppointments(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index < 0) return prev;
      if (direction === 'up' && index > 0) {
        const newArr = [...prev];
        [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
        return newArr;
      }
      if (direction === 'down' && index < prev.length - 1) {
        const newArr = [...prev];
        [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]];
        return newArr;
      }
      return prev;
    });
  };

  const displayedAppointments = React.useMemo(() => {
    if (sortMode === 'manual') {
      return manualAppointments;
    }
    
    let sorted = [...appointments];
    if (currentLocation?.latitude && currentLocation?.longitude) {
      sorted.sort((a, b) => {
        if (!a.latitude || !a.longitude) return 1;
        if (!b.latitude || !b.longitude) return -1;
        const distA = getDistanceInKm(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
        const distB = getDistanceInKm(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }
    return sorted;
  }, [appointments, currentLocation, sortMode, manualAppointments]);

  const toggleRouteSelection = (id: string) => {
    setRouteSequence(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const getFirstName = () => {
    if (!user?.username) return '';
    return user.username.split(' ')[0];
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login'); 
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const openInGoogleMaps = (item: Appointment) => {
    // Se tiver coordenadas exatas usa elas, senão usa o texto do endereço
    const destination = item.latitude && item.longitude 
      ? `${item.latitude},${item.longitude}` 
      : encodeURIComponent(item.address);
    
    // URL universal do Google Maps para rotas
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
    });
  };

  const handleAppointmentOptions = (item: Appointment) => {
    Alert.alert(
      'Opções do Serviço',
      `${item.order} - ${item.client}`,
      [
        { 
          text: '📍 Navegar até o local', 
          onPress: () => openInGoogleMaps(item) 
        },
        { 
          text: 'Reagendar', 
          onPress: () => Alert.alert('Reagendar', 'Abrindo calendário para nova data...') 
        },
        { 
          text: 'Apagar', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmar exclusão',
              'Tem certeza que deseja apagar este atendimento da tela inicial?',
              [
                { text: 'Não', style: 'cancel' },
                { 
                  text: 'Sim, Apagar', 
                  style: 'destructive',
                  onPress: () => {
                    setAppointments(prev => prev.filter(apt => apt.id !== item.id));
                  }
                }
              ]
            );
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const renderQuickAction = ({ item }: { item: QuickAction }) => (
    <TouchableOpacity
      style={styles.actionItem}
      activeOpacity={0.3}
      onPress={() => { if (item.route) router.push(item.route as any); }}
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
          <Text style={{ fontSize: 26 }}>{item.icon}</Text>
        ) : (
          <Ionicons name={item.icon as any} size={24} color="#000000ff" />
        )}
      </View>
      <Text style={styles.actionText}>{item.title}</Text>
    </TouchableOpacity>
  );

  const getCardColor = (status: string) => {
    const s = status?.trim()?.toLowerCase() || '';
    if (s.includes('aberto')) return '#FFE4E6'; // Vermelho/Rosa claro
    if (s.includes('agendado')) return '#E0F2FE'; // Azul claro
    if (s.includes('diagn')) return '#F3E8FF'; // Roxo claro (Diagnóstico)
    if (s.includes('orç') || s.includes('orc')) return '#FFEDD5'; // Laranja claro (Orçamento)
    if (s.includes('aprovado')) return '#DCFCE7'; // Verde claro
    if (s.includes('peça') || s.includes('peca')) return '#FEF9C3'; // Amarelo claro (Aguardando Peça)
    if (s.includes('execu')) return '#E0E7FF'; // Indigo claro (Em Execução)
    if (s.includes('conclu')) return '#D1FAE5'; // Verde esmeralda (Concluído)
    if (s.includes('garantia')) return '#FEF3C7'; // Amarelo/Laranja claro
    if (s.includes('cancelado')) return '#F3F4F6'; // Cinza claro
    return '#FFFFFF';
  };

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    let distanceText = '';
    if (currentLocation?.latitude && item.latitude) {
      const dist = getDistanceInKm(currentLocation.latitude, currentLocation.longitude, item.latitude, item.longitude);
      distanceText = dist < 1 ? `🚗 ${(dist * 1000).toFixed(0)} m` : `🚗 ${dist.toFixed(1)} km`;
    }

    return (
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => toggleRouteSelection(item.id)} 
        style={[
          styles.appointmentCard, 
          { 
            backgroundColor: getCardColor(item.status), 
            borderWidth: routeSequence.includes(item.id) ? 2 : 0, 
            borderColor: '#1A32E5' 
          }
        ]}
      >
        <View style={styles.appointmentHeader}>
          <Text style={styles.appointmentOrder}>{item.order}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {sortMode === 'manual' && (
              <View style={{ flexDirection: 'row', marginRight: 5 }}>
                <TouchableOpacity onPress={() => moveAppointment(item.id, 'up')} style={{ padding: 4 }}>
                  <Ionicons name="chevron-up-circle" size={28} color="#1BAFE0" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveAppointment(item.id, 'down')} style={{ padding: 4 }}>
                  <Ionicons name="chevron-down-circle" size={28} color="#1BAFE0" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => handleAppointmentOptions(item)} style={{ padding: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.appointmentClient}>{item.client}</Text>
        <Text style={styles.appointmentAddress}>{item.address}</Text>
        <View style={styles.appointmentFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.appointmentTime}>⏰ {item.time}</Text>
            {distanceText ? <Text style={[styles.appointmentTime, { color: '#1BAFE0', fontWeight: 'bold' }]}>{distanceText}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 255, 255, 0.6)' }]}>
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
            <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
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
          <LinearGradient colors={['#1BAFE0', '#7902E0', '#1A32E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
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
            {appointments.map((apt) => (
              apt.latitude && apt.longitude ? (
                <Marker key={apt.id} coordinate={{ latitude: apt.latitude, longitude: apt.longitude }} title={apt.client} description={apt.order} />
              ) : null
            ))}

            {currentLocation && routeSequence.length > 0 && (
              <MapViewDirections
                origin={currentLocation}
                destination={appointments.find(a => a.id === routeSequence[routeSequence.length - 1]) as any}
                waypoints={routeSequence.slice(0, -1).map(id => appointments.find(a => a.id === id)).filter(Boolean) as any}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>ATENDIMENTOS</Text>
            <TouchableOpacity 
              onPress={() => setSortMode(prev => prev === 'distance' ? 'manual' : 'distance')}
              style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15 }}
            >
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1A32E5' }}>
                {sortMode === 'distance' ? '🚗 GPS Automático' : '✋ Ordem Manual'}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={displayedAppointments}
            renderItem={renderAppointmentCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowFloatingMenu(!showFloatingMenu)}>
        <LinearGradient colors={['#1BAFE0', '#7902E0']} style={styles.fabGradient}>
          <Ionicons name={showFloatingMenu ? "close" : "add"} size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Floating Menu */}
      <Modal visible={showFloatingMenu} transparent={true} animationType="fade" onRequestClose={() => setShowFloatingMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFloatingMenu(false)}>
          <View style={styles.floatingMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowFloatingMenu(false); router.push('/new_atend'); }}>
              <Ionicons name="document-text-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Novo Atendimento</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowFloatingMenu(false); router.push('/client'); }}>
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
  container: { flex: 1, backgroundColor: '#ffffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, paddingTop: 10, marginTop: 30, backgroundColor: '#fff' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 60, height: 60, marginRight: 15 },
  welcomeText: { fontSize: 14, color: '#666', fontWeight: '500' },
  userName: { fontSize: 18, color: '#1A32E5', fontWeight: 'bold', marginTop: 4 },
  headerRight: { flexDirection: 'row' },
  headerIcon: { marginLeft: 15, padding: 8 },
  balanceCardContainer: { paddingHorizontal: 20, paddingVertical: 20 },
  balanceCard: { borderRadius: 20, padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  balanceContent: { flex: 1 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  balanceLabel: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 16, fontWeight: '500' },
  balanceValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  balanceDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.3)', marginVertical: 10 },
  quickActionsContainer: { paddingVertical: 10 },
  quickActionsList: { paddingHorizontal: 10 },
  actionItem: { alignItems: 'center', marginHorizontal: 10, width: 80 },
  actionIcon: { width: 90, height: 50, borderRadius: 30, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, color: '#666', textAlign: 'center', fontWeight: '500' },
  mapContainer: { marginHorizontal: 20, marginVertical: 20, borderRadius: 15, overflow: 'hidden' },
  appointmentsContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, letterSpacing: 1 },
  appointmentCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  appointmentOrder: { fontSize: 14, fontWeight: 'bold', color: '#1A32E5' },
  appointmentClient: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  appointmentAddress: { fontSize: 14, color: '#666', marginBottom: 15 },
  appointmentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appointmentTime: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#333' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)', justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20, paddingBottom: 100 },
  floatingMenu: { backgroundColor: '#fff', borderRadius: 15, padding: 10, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15 },
  menuText: { marginLeft: 15, fontSize: 16, color: '#333', fontWeight: '500' },
});