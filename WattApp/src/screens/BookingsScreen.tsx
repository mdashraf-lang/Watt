import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Booking, MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Tabs'>;

const STATUS_LABEL: Record<string, string> = {
  pending: 'في الانتظار',
  confirmed: 'مؤكد',
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};
const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  confirmed: COLORS.primary,
  active: COLORS.available,
  completed: COLORS.textSecondary,
  cancelled: COLORS.error,
  no_show: COLORS.fault,
};

const FILTER_TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'النشطة' },
  { key: 'confirmed', label: 'المؤكدة' },
  { key: 'completed', label: 'المكتملة' },
];

export default function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, station:stations(name, name_ar, governorate)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setBookings(data as Booking[]);
    setLoading(false);
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const renderBooking = useCallback(({ item }: { item: Booking }) => {
    const bookedAt = new Date(item.booked_at);
    const isActionable = item.status === 'confirmed' || item.status === 'active';

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => isActionable && navigation.navigate('ActiveBooking', { bookingId: item.id })}
        activeOpacity={isActionable ? 0.8 : 1}
      >
        <View style={styles.cardTop}>
          <View style={styles.stationEmoji}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {item.station?.name_ar || item.station?.name || 'محطة غير معروفة'}
            </Text>
            <Text style={styles.stationGov}>{item.station?.governorate}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <DetailChip icon="📅" label={bookedAt.toLocaleDateString('ar-OM')} />
          <DetailChip icon="🕐" label={bookedAt.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })} />
          <DetailChip icon="⏱" label={`${item.duration_minutes}د`} />
          <DetailChip icon="💰" label={`${(item.actual_cost ?? item.estimated_cost ?? 0).toFixed(3)} OMR`} />
        </View>

        {isActionable && (
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>
              {item.status === 'active' ? '⚡ جلسة الشحن نشطة' : 'اضغط لعرض QR والبدء'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>حجوزاتي</Text>
        <Text style={styles.headerCount}>{bookings.length} حجز</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterText, filter === tab.key && styles.filterTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>لا توجد حجوزات</Text>
          <Text style={styles.emptySub}>
            {filter === 'all' ? 'ابدأ بحجز محطة شحن من الخريطة' : `لا توجد حجوزات ${FILTER_TABS.find(t => t.key === filter)?.label}`}
          </Text>
          {filter === 'all' && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Tabs')}
            >
              <Text style={styles.emptyBtnText}>اذهب للخريطة</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderBooking}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function DetailChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.detailChip}>
      <Text style={styles.detailChipIcon}>{icon}</Text>
      <Text style={styles.detailChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: '#fff' },
  bookingCard: {
    backgroundColor: COLORS.card, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  stationEmoji: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  stationName: { fontSize: 14, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  stationGov: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'right', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  detailChipIcon: { fontSize: 12 },
  detailChipLabel: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  cardAction: { borderTopWidth: 1, borderTopColor: '#dcfce7', backgroundColor: '#f0fdf4', paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  cardActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
