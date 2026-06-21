import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Booking, CustomerStackParamList, CustomerTabParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { translateGov, stationDisplayName } from '../i18n/govMap';
import { CalendarIcon, ZapIcon, MapPinIcon, ClockIcon, TimerIcon, CoinsIcon } from '../components/icons';

// Composite type: we're inside a tab (Bookings), but can also push stack screens
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Bookings'>,
  NativeStackNavigationProp<CustomerStackParamList>
>;

const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  confirmed: COLORS.primary,
  active: COLORS.available,
  completed: COLORS.textSecondary,
  cancelled: COLORS.error,
  no_show: COLORS.fault,
};

const STATUS_BG: Record<string, string> = {
  pending: COLORS.warningBg,
  confirmed: COLORS.primaryBg,
  active: COLORS.successBg,
  completed: COLORS.backgroundAlt,
  cancelled: COLORS.errorBg,
  no_show: COLORS.errorBg,
};

export default function BookingsScreen() {
  const { t, isRTL } = useLang();
  const locale = isRTL ? 'ar-OM' : 'en-GB';
  const STATUS_LABEL: Record<string, string> = {
    pending: t.bookings_status_pending,
    confirmed: t.bookings_status_confirmed,
    active: t.bookings_status_active,
    completed: t.bookings_status_completed,
    cancelled: t.bookings_status_cancelled,
    no_show: t.bookings_status_no_show,
  };
  const FILTER_TABS = [
    { key: 'all', label: t.bookings_filter_all },
    { key: 'active', label: t.bookings_filter_active },
    { key: 'confirmed', label: t.bookings_filter_confirmed },
    { key: 'completed', label: t.bookings_filter_completed },
  ];

  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchBookings(); }, []);

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
    const isActive = item.status === 'active';

    return (
      <TouchableOpacity
        style={[styles.bookingCard, isActive && styles.bookingCardActive]}
        onPress={() => isActionable && navigation.navigate('ActiveBooking', { bookingId: item.id })}
        activeOpacity={isActionable ? 0.78 : 1}
      >
        {/* Card top */}
        <View style={styles.cardTop}>
          <View style={[styles.stationIconWrap, { backgroundColor: isActive ? COLORS.primaryTint : COLORS.backgroundAlt }]}>
            <ZapIcon size={20} color={isActive ? COLORS.primary : COLORS.textTertiary} strokeWidth={isActive ? 2.5 : 1.8} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.stationName} numberOfLines={1}>
              {item.station ? stationDisplayName(item.station, isRTL) : t.bookings_unknown_station}
            </Text>
            <View style={styles.stationLocRow}>
              <MapPinIcon size={11} color={COLORS.textTertiary} strokeWidth={1.8} />
              <Text style={styles.stationGov}>
                {item.station?.governorate ? translateGov(item.station.governorate, isRTL) : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        {/* Details row */}
        <View style={styles.detailsRow}>
          <DetailChip Icon={CalendarIcon} label={bookedAt.toLocaleDateString(locale)} />
          <DetailChip Icon={ClockIcon} label={bookedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} />
          <DetailChip Icon={TimerIcon} label={`${item.duration_minutes}${t.min_abbr}`} />
          <DetailChip Icon={CoinsIcon} label={`${(item.actual_cost ?? item.estimated_cost ?? 0).toFixed(3)} OMR`} />
        </View>

        {/* Action strip */}
        {isActionable && (
          <View style={[styles.actionStrip, isActive && styles.actionStripActive]}>
            <Text style={[styles.actionText, isActive && styles.actionTextActive]}>
              {isActive ? t.bookings_session_active_clean : t.bookings_scan_qr}
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
        <View>
          <Text style={styles.headerTitle}>{t.bookings_header}</Text>
          <Text style={styles.headerSub}>{bookings.length} {t.bookings_count}</Text>
        </View>
        <View style={styles.headerIcon}>
          <CalendarIcon size={22} color={COLORS.primary} strokeWidth={2} />
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
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
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 36 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <CalendarIcon size={36} color={COLORS.textTertiary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.bookings_empty_title}</Text>
          <Text style={styles.emptySub}>
            {filter === 'all' ? t.bookings_empty_sub_all : t.bookings_empty_sub_filter}
          </Text>
          {filter === 'all' && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Map')}
            >
              <Text style={styles.emptyBtnText}>{t.bookings_go_map}</Text>
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

function DetailChip({ Icon, label }: { Icon: React.ComponentType<any>; label: string }) {
  return (
    <View style={styles.chip}>
      <Icon size={11} color={COLORS.textTertiary} strokeWidth={2} />
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  headerIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },

  // Filter
  filterScroll: { maxHeight: 48 },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
    paddingTop: 2,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: '#fff' },

  // Booking card
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  stationIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  stationName: { fontSize: 14, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  stationLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 3 },
  stationGov: { fontSize: 12, color: COLORS.textTertiary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Details
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  // Action strip
  actionStrip: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.primaryBg,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  actionStripActive: {
    backgroundColor: COLORS.primaryTint,
    borderTopColor: COLORS.primaryTint,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionTextActive: { color: COLORS.primaryLight },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 36 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 6,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
