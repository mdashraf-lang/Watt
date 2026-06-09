import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { Connector, MainStackParamList, Station } from '../types';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'StationDetails'>;
type Route = RouteProp<MainStackParamList, 'StationDetails'>;

const STATUS_COLOR: Record<string, string> = {
  available: COLORS.available, busy: COLORS.busy, fault: COLORS.fault, offline: COLORS.offline,
};
const STATUS_LABEL: Record<string, string> = {
  available: 'متاحة', busy: 'مشغولة', fault: 'عطل', offline: 'غير متاحة',
};

const AMENITY_ICONS: Record<string, string> = {
  wifi: '📶', restaurant: '🍽️', parking: '🅿️', hotel: '🏨', mall: '🛍️',
  university: '🎓', hospital: '🏥', marina: '⛵', food_court: '🍔',
  prayer_room: '🕌', sports: '⚽', cafeteria: '☕', restrooms: '🚻',
  convenience_store: '🏪', airport: '✈️', tourist_site: '🏛️',
  '24h_service': '🕐', outdoor: '🌿', seaside: '🌊', scenic_view: '🏔️',
};

export default function StationDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { stationId } = route.params;

  const [station, setStation] = useState<Station | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStation();
    fetchConnectors();

    const channel = supabase
      .channel(`station-${stationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stations', filter: `id=eq.${stationId}` },
        payload => setStation(prev => prev ? { ...prev, ...payload.new } : null))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [stationId]);

  const fetchStation = async () => {
    const { data } = await supabase.from('stations').select('*').eq('id', stationId).single();
    if (data) setStation(data as Station);
    setLoading(false);
  };

  const fetchConnectors = async () => {
    const { data } = await supabase.from('connectors').select('*').eq('station_id', stationId);
    if (data) setConnectors(data as Connector[]);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!station) return null;

  const canBook = station.status === 'available' && station.available_connectors > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{station.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>⚡</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{station.name_ar || station.name}</Text>
            <Text style={styles.heroAddress}>{station.address_ar || station.address}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[station.status] + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[station.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLOR[station.status] }]}>
                {STATUS_LABEL[station.status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard label="السعر" value={`${station.price_per_kwh.toFixed(3)}`} unit="OMR/kWh" icon="💰" />
          <StatCard label="القدرة" value={`${station.power_kw}`} unit="kW" icon="⚡" />
          <StatCard label="التقييم" value={`${station.rating}`} unit="★" icon="⭐" />
          <StatCard label="المتاح" value={`${station.available_connectors}/${station.total_connectors}`} unit="مقبس" icon="🔌" />
        </View>

        {/* Connectors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نوع المقابس</Text>
          {connectors.map(c => (
            <View key={c.id} style={styles.connectorRow}>
              <View style={[styles.connectorStatus, { backgroundColor: c.status === 'available' ? COLORS.available : COLORS.busy }]} />
              <Text style={styles.connectorType}>{c.connector_type}</Text>
              <Text style={styles.connectorPower}>{c.power_kw} kW</Text>
              <Text style={[styles.connectorLabel, { color: c.status === 'available' ? COLORS.available : COLORS.busy }]}>
                {c.status === 'available' ? 'متاح' : 'مشغول'}
              </Text>
            </View>
          ))}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات المحطة</Text>
          <InfoRow icon="🕐" label="ساعات العمل" value={station.operating_hours} />
          <InfoRow icon="📍" label="المنطقة" value={`${station.governorate}${station.wilayat ? ` · ${station.wilayat}` : ''}`} />
          <InfoRow icon="🔧" label="آخر صيانة" value={station.last_maintenance ? new Date(station.last_maintenance).toLocaleDateString('ar-OM') : 'غير محدد'} />
          <InfoRow icon="⭐" label="عدد التقييمات" value={`${station.total_ratings} تقييم`} />
        </View>

        {/* Amenities */}
        {station.amenities && station.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المرافق</Text>
            <View style={styles.amenitiesGrid}>
              {station.amenities.map(a => (
                <View key={a} style={styles.amenityChip}>
                  <Text style={styles.amenityEmoji}>{AMENITY_ICONS[a] || '✓'}</Text>
                  <Text style={styles.amenityLabel}>{a.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Book button */}
      <View style={styles.bookBar}>
        <View style={styles.bookPriceCol}>
          <Text style={styles.bookPrice}>{station.price_per_kwh.toFixed(3)} OMR</Text>
          <Text style={styles.bookPriceUnit}>لكل kWh</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, !canBook && styles.bookBtnDisabled]}
          onPress={() => canBook && navigation.navigate('Booking', { station })}
          activeOpacity={0.85}
        >
          <Text style={styles.bookBtnText}>{canBook ? 'احجز الآن' : 'غير متاحة'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 20, color: COLORS.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, padding: 20, margin: 16, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 30 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'right', marginBottom: 4 },
  heroAddress: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'right', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statUnit: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  statLabel: { fontSize: 12, color: COLORS.textTertiary },
  section: { backgroundColor: COLORS.card, borderRadius: 20, margin: 16, marginTop: 8, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  connectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  connectorStatus: { width: 8, height: 8, borderRadius: 4 },
  connectorType: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  connectorPower: { fontSize: 13, color: COLORS.textSecondary },
  connectorLabel: { fontSize: 12, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon: { fontSize: 16, width: 24 },
  infoLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  amenityEmoji: { fontSize: 14 },
  amenityLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  bookBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.card, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 32,
  },
  bookPriceCol: { flex: 1 },
  bookPrice: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  bookPriceUnit: { fontSize: 12, color: COLORS.textSecondary },
  bookBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: COLORS.textTertiary },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
