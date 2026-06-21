import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { translateGov, stationDisplayName } from '../i18n/govMap';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Booking'>;
type Route = RouteProp<MainStackParamList, 'Booking'>;

const DURATIONS = [30, 60, 90, 120, 180];

function getDays() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

function getTimeSlots() {
  const slots = [];
  for (let h = 6; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

export default function BookingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { station } = route.params;
  const { profile } = useAuth();
  const { t, isRTL } = useLang();

  const DAY_NAMES = [t.day_0, t.day_1, t.day_2, t.day_3, t.day_4, t.day_5, t.day_6];
  const MONTH_NAMES = [t.month_0, t.month_1, t.month_2, t.month_3, t.month_4, t.month_5, t.month_6, t.month_7, t.month_8, t.month_9, t.month_10, t.month_11];

  const days = getDays();
  const timeSlots = getTimeSlots();

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    fetchBookedSlots();
  }, [selectedDay]);

  const fetchBookedSlots = async () => {
    setFetchingSlots(true);
    const day = days[selectedDay];
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('bookings')
      .select('booked_at, duration_minutes')
      .eq('station_id', station.id)
      .gte('booked_at', startOfDay.toISOString())
      .lte('booked_at', endOfDay.toISOString())
      .in('status', ['pending', 'confirmed', 'active']);

    if (data) {
      const occupied: string[] = [];
      data.forEach(b => {
        const start = new Date(b.booked_at);
        const slots = Math.ceil(b.duration_minutes / 30);
        for (let i = 0; i < slots; i++) {
          const slotTime = new Date(start.getTime() + i * 30 * 60000);
          const h = String(slotTime.getHours()).padStart(2, '0');
          const m = slotTime.getMinutes() === 0 ? '00' : '30';
          occupied.push(`${h}:${m}`);
        }
      });
      setBookedSlots(occupied);
    }
    setFetchingSlots(false);
  };

  const estimatedKwh = (selectedDuration / 60) * station.power_kw;
  const estimatedCost = estimatedKwh * station.price_per_kwh;

  const handleBook = async () => {
    if (!selectedTime) {
      Alert.alert(t.warning, t.booking_select_time);
      return;
    }
    if (!profile) return;

    if (profile.wallet_balance < estimatedCost) {
      Alert.alert(
        t.booking_low_balance,
        `${t.booking_low_balance_msg} ${profile.wallet_balance.toFixed(3)} OMR. ${t.booking_low_balance_needed} ${estimatedCost.toFixed(3)} OMR`,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.booking_top_up, onPress: () => navigation.navigate('Tabs') },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const day = days[selectedDay];
      const [h, m] = selectedTime.split(':').map(Number);
      const bookedAt = new Date(day);
      bookedAt.setHours(h, m, 0, 0);

      const { data, error } = await supabase.from('bookings').insert({
        user_id: profile.id,
        station_id: station.id,
        status: 'confirmed',
        booked_at: bookedAt.toISOString(),
        duration_minutes: selectedDuration,
        estimated_kwh: estimatedKwh,
        estimated_cost: estimatedCost,
      }).select().single();

      if (error) throw error;

      // Send WhatsApp booking confirmation (fire-and-forget)
      if (profile.phone) {
        const dateStr = bookedAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '/');
        const timeStr = bookedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        supabase.functions.invoke('notify-booking', {
          body: { phone: profile.phone, date: dateStr, time: timeStr },
        });
      }

      navigation.replace('ActiveBooking', { bookingId: data.id });
    } catch (e: any) {
      Alert.alert(t.booking_error, e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.booking_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Station info */}
        <View style={styles.stationCard}>
          <Text style={styles.stationEmoji}>⚡</Text>
          <View style={styles.stationInfo}>
            <Text style={styles.stationName}>{stationDisplayName(station, isRTL)}</Text>
            <Text style={styles.stationSub}>{translateGov(station.governorate, isRTL)} · {station.price_per_kwh.toFixed(3)} OMR/kWh</Text>
          </View>
        </View>

        {/* Day selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_choose_day}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, i === selectedDay && styles.dayChipActive]}
                onPress={() => { setSelectedDay(i); setSelectedTime(''); }}
              >
                <Text style={[styles.dayName, i === selectedDay && styles.dayTextActive]}>
                  {i === 0 ? t.booking_today : DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, i === selectedDay && styles.dayTextActive]}>
                  {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Time slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_choose_time}</Text>
          {fetchingSlots ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.slotsGrid}>
              {timeSlots.map(t => {
                const isBooked = bookedSlots.includes(t);
                const isSelected = t === selectedTime;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.slot, isBooked && styles.slotBooked, isSelected && styles.slotSelected]}
                    onPress={() => !isBooked && setSelectedTime(t)}
                    disabled={isBooked}
                  >
                    <Text style={[styles.slotText, isBooked && styles.slotTextBooked, isSelected && styles.slotTextSelected]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_duration}</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.durationChip, d === selectedDuration && styles.durationActive]}
                onPress={() => setSelectedDuration(d)}
              >
                <Text style={[styles.durationText, d === selectedDuration && styles.durationTextActive]}>
                  {d >= 60 ? `${d / 60}${t.hour_abbr}` : `${d}${t.min_abbr}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{t.booking_summary}</Text>
          <SummaryRow label={t.booking_duration_label} value={`${selectedDuration} ${t.booking_minute}`} />
          <SummaryRow label={t.booking_kwh} value={`${estimatedKwh.toFixed(1)} kWh`} />
          <SummaryRow label={t.booking_price_rate} value={`${station.price_per_kwh.toFixed(3)} OMR/kWh`} />
          <View style={styles.summaryDivider} />
          <SummaryRow label={t.booking_total} value={`${estimatedCost.toFixed(3)} OMR`} bold />
          {profile && (
            <SummaryRow
              label={t.booking_balance_after}
              value={`${(profile.wallet_balance - estimatedCost).toFixed(3)} OMR`}
              color={profile.wallet_balance >= estimatedCost ? COLORS.success : COLORS.error}
            />
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, loading && styles.bookBtnDisabled]}
          onPress={handleBook}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>{`${t.booking_confirm_btn} ·`} {estimatedCost.toFixed(3)} OMR</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: COLORS.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  stationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, margin: 16, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  stationEmoji: { fontSize: 32, width: 52, textAlign: 'center' },
  stationInfo: { flex: 1 },
  stationName: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 4 },
  stationSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'right' },
  section: { backgroundColor: COLORS.card, borderRadius: 20, margin: 16, marginTop: 0, marginBottom: 12, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 14 },
  dayChip: {
    minWidth: 72, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  dayChipActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  dayName: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  dayNum: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  dayTextActive: { color: COLORS.primary },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  slotBooked: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  slotSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  slotTextBooked: { color: '#fca5a5', textDecorationLine: 'line-through' },
  slotTextSelected: { color: '#fff' },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.border, alignItems: 'center',
  },
  durationActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  durationText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  durationTextActive: { color: COLORS.primary },
  summary: { backgroundColor: COLORS.card, borderRadius: 20, margin: 16, marginTop: 0, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryLabelBold: { fontWeight: '700', color: COLORS.text },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  summaryValueBold: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  footer: { padding: 16, paddingBottom: 32, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  bookBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
