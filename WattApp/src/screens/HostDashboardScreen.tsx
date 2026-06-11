import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import type { ChargerListing } from '../types';

interface BookingSummary {
  id: string;
  booked_at: string;
  duration_minutes: number;
  estimated_cost: number;
  status: string;
  user_name?: string;
}

export default function HostDashboardScreen() {
  const { profile } = useAuth();
  const { t } = useLang();

  const [listing, setListing] = useState<ChargerListing | null>(null);
  const [todayBookings, setTodayBookings] = useState<BookingSummary[]>([]);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [allTimeEarnings, setAllTimeEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    if (!profile) return;
    try {
      const { data: listingData } = await supabase
        .from('charger_listings')
        .select('*')
        .eq('host_id', profile.id)
        .single();

      if (listingData) {
        setListing(listingData as ChargerListing);

        const today = new Date().toISOString().split('T')[0];
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, booked_at, duration_minutes, estimated_cost, status')
          .eq('listing_id', listingData.id)
          .gte('booked_at', today + 'T00:00:00')
          .lte('booked_at', today + 'T23:59:59')
          .order('booked_at', { ascending: true });

        setTodayBookings((bookings ?? []) as BookingSummary[]);

        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        thisMonthStart.setHours(0, 0, 0, 0);

        const { data: monthTx } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('type', 'earning')
          .gte('created_at', thisMonthStart.toISOString());

        setMonthEarnings(
          (monthTx ?? []).reduce((sum, tx: any) => sum + (tx.amount ?? 0), 0)
        );

        const { data: allTx } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('type', 'earning');

        setAllTimeEarnings(
          (allTx ?? []).reduce((sum, tx: any) => sum + (tx.amount ?? 0), 0)
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [profile]);

  const toggleAvailability = async () => {
    if (!listing) return;
    try {
      setToggling(true);
      const { error } = await supabase
        .from('charger_listings')
        .update({ is_available: !listing.is_available })
        .eq('id', listing.id);
      if (!error) setListing(l => l ? { ...l, is_available: !l.is_available } : l);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const statusColor = listing?.is_available ? COLORS.success : COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t.host_hello}, {profile?.full_name?.split(' ')[0]} 👋</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {listing?.is_available ? t.host_charger_online : t.host_charger_offline}
              </Text>
            </View>
          </View>
          <View style={styles.langTag}>
            <Text style={styles.langTagText}>🏠 HOST</Text>
          </View>
        </View>

        {/* Quick toggle */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>{t.host_quick_toggle}</Text>
              <Text style={styles.cardSub}>
                {listing?.is_available ? t.host_set_unavailable : t.host_set_available}
              </Text>
            </View>
            {toggling
              ? <ActivityIndicator color={COLORS.primary} />
              : (
                <Switch
                  value={listing?.is_available ?? false}
                  onValueChange={toggleAvailability}
                  trackColor={{ true: COLORS.success, false: COLORS.border }}
                  thumbColor="#fff"
                />
              )
            }
          </View>
        </View>

        {/* Earnings stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderTopColor: COLORS.gold }]}>
            <Text style={styles.statValue}>{monthEarnings.toFixed(3)}</Text>
            <Text style={styles.statLabel}>{t.host_this_month} OMR</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: COLORS.primary }]}>
            <Text style={styles.statValue}>{allTimeEarnings.toFixed(3)}</Text>
            <Text style={styles.statLabel}>{t.host_total_earned} OMR</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#6366f1' }]}>
            <Text style={styles.statValue}>{listing?.total_bookings ?? 0}</Text>
            <Text style={styles.statLabel}>{t.host_total_sessions}</Text>
          </View>
        </View>

        {/* Today's bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.host_today_bookings}</Text>
          {todayBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>{t.host_no_bookings_today}</Text>
            </View>
          ) : (
            todayBookings.map(b => (
              <View key={b.id} style={styles.bookingRow}>
                <View style={styles.bookingTime}>
                  <Text style={styles.bookingTimeText}>
                    {new Date(b.booked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingDuration}>{b.duration_minutes} min</Text>
                  <Text style={styles.bookingCost}>{(b.estimated_cost ?? 0).toFixed(3)} OMR</Text>
                </View>
                <View style={[styles.bookingStatus, { backgroundColor: statusBg(b.status) }]}>
                  <Text style={[styles.bookingStatusText, { color: statusFg(b.status) }]}>{b.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function statusBg(status: string) {
  if (status === 'confirmed') return '#dcfce7';
  if (status === 'active') return '#dbeafe';
  return '#f1f5f9';
}
function statusFg(status: string) {
  if (status === 'confirmed') return '#15803d';
  if (status === 'active') return '#1d4ed8';
  return COLORS.textSecondary;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  langTag: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langTagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  emptyEmoji: { fontSize: 32 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  bookingRow: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingTime: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bookingTimeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  bookingDuration: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bookingCost: { fontSize: 12, color: COLORS.textSecondary },
  bookingStatus: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  bookingStatusText: { fontSize: 11, fontWeight: '700' },
});
