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
import { useLang } from '../context/LanguageContext';
import { translateGov, stationDisplayName, stationDisplayAddress } from '../i18n/govMap';
import { COLORS } from '../constants/colors';
import { ArrowLeftIcon, ZapIcon, StarIcon, ClockIcon, MapPinIcon, CheckIcon } from '../components/icons';

type Nav = NativeStackNavigationProp<MainStackParamList, 'StationDetails'>;
type Route = RouteProp<MainStackParamList, 'StationDetails'>;

const STATUS_COLOR: Record<string, string> = {
  available: COLORS.available, busy: COLORS.busy, fault: COLORS.fault, offline: COLORS.offline,
};
const STATUS_BG: Record<string, string> = {
  available: COLORS.successBg, busy: COLORS.warningBg, fault: COLORS.errorBg, offline: COLORS.backgroundAlt,
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
  const { t, isRTL } = useLang();
  const locale = isRTL ? 'ar-OM' : 'en-GB';

  const STATUS_LABEL: Record<string, string> = {
    available: t.status_available, busy: t.status_busy,
    fault: t.status_fault, offline: t.status_offline,
  };

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
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{station.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIconWrap, { backgroundColor: STATUS_BG[station.status] }]}>
            <ZapIcon size={32} color={STATUS_COLOR[station.status]} strokeWidth={2} />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroName}>{stationDisplayName(station, isRTL)}</Text>
            <View style={styles.heroLocRow}>
              <MapPinIcon size={12} color={COLORS.textTertiary} strokeWidth={2} />
              <Text style={styles.heroAddress}>{stationDisplayAddress(station, isRTL)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[station.status] }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[station.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLOR[station.status] }]}>
                {STATUS_LABEL[station.status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard label={t.station_price} value={station.price_per_kwh.toFixed(3)} unit="OMR/kWh" color={COLORS.primary} emoji="💰" />
          <StatCard label={t.station_power} value={`${station.power_kw}`} unit="kW" color="#3b82f6" emoji="⚡" />
          <StatCard label={t.station_rating} value={`${station.rating}`} unit="★" color={COLORS.gold} emoji="⭐" />
          <StatCard label={t.station_available} value={`${station.available_connectors}/${station.total_connectors}`} unit={t.socket} color={COLORS.available} emoji="🔌" />
        </View>

        {/* Connectors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.station_connectors}</Text>
          {connectors.map(c => (
            <View key={c.id} style={styles.connectorRow}>
              <View style={[styles.connectorBadge, { backgroundColor: c.status === 'available' ? COLORS.successBg : COLORS.warningBg }]}>
                <View style={[styles.connectorDot, { backgroundColor: c.status === 'available' ? COLORS.available : COLORS.busy }]} />
              </View>
              <Text style={styles.connectorType}>{c.connector_type}</Text>
              <Text style={styles.connectorPower}>{c.power_kw} kW</Text>
              <Text style={[styles.connectorStatus, { color: c.status === 'available' ? COLORS.available : COLORS.busy }]}>
                {c.status === 'available' ? t.status_available : t.status_busy}
              </Text>
            </View>
          ))}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.station_info}</Text>
          <InfoRow Icon={ClockIcon} label={t.station_hours} value={station.operating_hours} />
          <InfoRow Icon={MapPinIcon} label={t.station_area} value={`${translateGov(station.governorate, isRTL)}${station.wilayat ? ` · ${station.wilayat}` : ''}`} />
          <InfoRow Icon={CheckIcon} label={t.station_maintenance} value={station.last_maintenance ? new Date(station.last_maintenance).toLocaleDateString(locale) : t.station_maintenance_none} />
          <InfoRow Icon={StarIcon} label={t.ratings_label} value={`${station.total_ratings} ${t.station_ratings_count}`} />
        </View>

        {/* Amenities */}
        {station.amenities && station.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.station_amenities}</Text>
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

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Book bar */}
      <View style={styles.bookBar}>
        <View>
          <Text style={styles.bookPrice}>{station.price_per_kwh.toFixed(3)} OMR</Text>
          <Text style={styles.bookPriceUnit}>لكل kWh</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, !canBook && styles.bookBtnDisabled]}
          onPress={() => canBook && navigation.navigate('Booking', { station })}
          activeOpacity={0.85}
        >
          <ZapIcon size={18} color="#fff" strokeWidth={2.5} />
          <Text style={styles.bookBtnText}>{canBook ? t.station_book : t.station_unavailable}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, color, emoji }: {
  label: string; value: string; unit: string; color: string; emoji: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon size={14} color={COLORS.textSecondary} strokeWidth={2} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text,
    marginHorizontal: 8,
  },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card,
    padding: 20, margin: 16, borderRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10,
    elevation: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroContent: { flex: 1 },
  heroName: { fontSize: 17, fontWeight: '800', color: COLORS.text, textAlign: 'right', marginBottom: 5 },
  heroLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 8 },
  heroAddress: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10, marginBottom: 4,
  },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: COLORS.card, borderRadius: 18, padding: 14,
    alignItems: 'center', gap: 3,
    borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statEmoji: { fontSize: 20, marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statUnit: { fontSize: 10, color: COLORS.textTertiary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },

  // Section
  section: {
    backgroundColor: COLORS.card, borderRadius: 22,
    margin: 16, marginTop: 4, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    textAlign: 'right', marginBottom: 12,
  },

  // Connectors
  connectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  connectorBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  connectorDot: { width: 10, height: 10, borderRadius: 5 },
  connectorType: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  connectorPower: { fontSize: 13, color: COLORS.textSecondary },
  connectorStatus: { fontSize: 12, fontWeight: '700', minWidth: 56, textAlign: 'right' },

  // Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right' },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primaryBg, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.primaryTint,
  },
  amenityEmoji: { fontSize: 13 },
  amenityLabel: { fontSize: 11, color: COLORS.primaryLight, fontWeight: '600' },

  // Book bar
  bookBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 16,
    backgroundColor: COLORS.card, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: -3 }, shadowRadius: 12, elevation: 8,
  },
  bookPrice: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  bookPriceUnit: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  bookBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 15,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  bookBtnDisabled: { backgroundColor: COLORS.textTertiary, shadowOpacity: 0 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
