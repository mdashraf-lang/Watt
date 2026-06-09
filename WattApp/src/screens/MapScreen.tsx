import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainStackParamList, Station } from '../types';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Tabs'>;

const STATUS_COLOR: Record<string, string> = {
  available: COLORS.available,
  busy: COLORS.busy,
  fault: COLORS.fault,
  offline: COLORS.offline,
};

const OMAN_REGION: Region = {
  latitude: 23.588,
  longitude: 58.383,
  latitudeDelta: 3.5,
  longitudeDelta: 3.5,
};

export default function MapScreen() {
  const { t } = useLang();
  const STATUS_LABEL: Record<string, string> = {
    available: t.status_available,
    busy: t.status_busy,
    fault: t.status_fault,
    offline: t.status_offline,
  };
  const navigation = useNavigation<Nav>();
  const mapRef = useRef<MapView>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [filtered, setFiltered] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Station | null>(null);
  const [showList, setShowList] = useState(false);
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchStations();
    subscribeToStations();
    requestLocation();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? stations.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.name_ar ?? '').includes(q) ||
        s.governorate.toLowerCase().includes(q)
      ) : stations
    );
  }, [search, stations]);

  const fetchStations = async () => {
    const { data, error } = await supabase.from('stations').select('*').order('name');
    if (!error && data) {
      setStations(data as Station[]);
      setFiltered(data as Station[]);
    }
    setLoading(false);
  };

  const subscribeToStations = () => {
    const channel = supabase
      .channel('stations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setStations(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  };

  const toggleList = () => {
    const toValue = showList ? 0 : 1;
    setShowList(!showList);
    Animated.spring(listAnim, { toValue, useNativeDriver: true }).start();
  };

  const selectStation = (station: Station) => {
    setSelected(station);
    setShowList(false);
    mapRef.current?.animateToRegion({
      latitude: station.latitude,
      longitude: station.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 600);
  };

  const renderStationCard = useCallback(({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => selectStation(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
      <View style={styles.listCardInfo}>
        <Text style={styles.listCardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.listCardSub}>{item.governorate} • {item.available_connectors}/{item.total_connectors} {t.map_available}</Text>
      </View>
      <Text style={styles.listCardPrice}>{item.price_per_kwh.toFixed(3)} OMR/kWh</Text>
    </TouchableOpacity>
  ), []);

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={OMAN_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {stations.map(station => (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.latitude, longitude: station.longitude }}
            onPress={() => selectStation(station)}
          >
            <View style={[styles.pin, { backgroundColor: STATUS_COLOR[station.status] }]}>
              <Text style={styles.pinText}>⚡</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Search bar */}
      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t.map_search}
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setShowList(true)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.myLocationBtn} onPress={requestLocation}>
          <Text style={styles.myLocationIcon}>📍</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Nearby stations pill */}
      {!showList && !selected && (
        <View style={styles.pillRow}>
          <TouchableOpacity style={styles.pill} onPress={toggleList} activeOpacity={0.85}>
            <Text style={styles.pillText}>{`⚡ ${t.map_nearby}`}</Text>
            {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Station list sheet */}
      {showList && (
        <View style={styles.listSheet}>
          <View style={styles.listHandle} />
          <Text style={styles.listTitle}>
            {t.map_stations} ({filtered.length}) {search ? `• "${search}"` : ''}
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderStationCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
          <TouchableOpacity style={styles.closeListBtn} onPress={() => setShowList(false)}>
            <Text style={styles.closeListText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected station card */}
      {selected && !showList && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedCardRow}>
            <View style={styles.selectedInfo}>
              <View style={styles.selectedNameRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[selected.status] }]} />
                <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
              </View>
              <Text style={styles.selectedSub}>{selected.governorate} · {selected.available_connectors} / {selected.total_connectors} {t.map_available}</Text>
              <Text style={styles.selectedStatus}>{STATUS_LABEL[selected.status]}</Text>
            </View>
            <View style={styles.selectedRight}>
              <Text style={styles.selectedPrice}>{selected.price_per_kwh.toFixed(3)}</Text>
              <Text style={styles.selectedPriceUnit}>OMR/kWh</Text>
            </View>
          </View>

          <View style={styles.selectedBtnRow}>
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => {
                setSelected(null);
                navigation.navigate('StationDetails', { stationId: selected.id });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.detailsBtnText}>{t.map_details}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bookBtn, selected.status !== 'available' && styles.bookBtnDisabled]}
              onPress={() => selected.status === 'available' && navigation.navigate('Booking', { station: selected })}
              activeOpacity={0.85}
            >
              <Text style={styles.bookBtnText}>{t.map_book}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dismissBtn} onPress={() => setSelected(null)}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 8, gap: 8,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  clearBtn: { fontSize: 14, color: COLORS.textSecondary, padding: 4 },
  myLocationBtn: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.card, borderRadius: 24, width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  myLocationIcon: { fontSize: 20 },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pinText: { fontSize: 16 },
  pillRow: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: Dimensions.get('window').height * 0.55,
    backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  listHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  listCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listCardInfo: { flex: 1 },
  listCardName: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  listCardSub: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'right', marginTop: 2 },
  listCardPrice: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  closeListBtn: {
    alignItems: 'center', paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4,
  },
  closeListText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  selectedCard: {
    position: 'absolute', bottom: 80, left: 16, right: 16,
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  selectedCardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  selectedInfo: { flex: 1 },
  selectedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  selectedName: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, textAlign: 'right' },
  selectedSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'right', marginBottom: 4 },
  selectedStatus: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' },
  selectedRight: { alignItems: 'flex-end' },
  selectedPrice: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  selectedPriceUnit: { fontSize: 11, color: COLORS.textSecondary },
  selectedBtnRow: { flexDirection: 'row', gap: 10 },
  detailsBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, alignItems: 'center',
  },
  detailsBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  bookBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  bookBtnDisabled: { backgroundColor: COLORS.textTertiary },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dismissBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { fontSize: 12, color: COLORS.textSecondary },
});
