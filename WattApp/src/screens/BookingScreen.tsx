import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
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
import { ZapIcon, ArrowLeftIcon } from '../components/icons';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'Booking'>;
type Route = RouteProp<MainStackParamList, 'Booking'>;

const DURATIONS = [30, 60, 90, 120, 180];
const HOURS     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES   = ['00', '30'] as const;

function getDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

// Convert 12-hour to 24-hour "HH:MM" string
function to24(hour: number, period: 'AM' | 'PM', minute: '00' | '30'): string {
  let h = hour;
  if (period === 'AM' && hour === 12) h = 0;
  if (period === 'PM' && hour !== 12) h = hour + 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export default function BookingScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { station, listingId } = route.params;
  const { profile } = useAuth();
  const { t, isRTL } = useLang();

  const DAY_NAMES   = [t.day_0, t.day_1, t.day_2, t.day_3, t.day_4, t.day_5, t.day_6];
  const MONTH_NAMES = [t.month_0, t.month_1, t.month_2, t.month_3, t.month_4,
    t.month_5, t.month_6, t.month_7, t.month_8, t.month_9, t.month_10, t.month_11];

  const days = getDays();

  const [selectedDay,      setSelectedDay]      = useState(0);
  const [selectedPeriod,   setSelectedPeriod]   = useState<'AM' | 'PM'>(() =>
    new Date().getHours() < 12 ? 'AM' : 'PM',
  );
  const [selectedHour,     setSelectedHour]     = useState<number | null>(null);
  const [selectedMinute,   setSelectedMinute]   = useState<'00' | '30'>('00');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [bookedSlots,      setBookedSlots]      = useState<string[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [fetchingSlots,    setFetchingSlots]    = useState(false);

  useEffect(() => {
    setSelectedHour(null);
    fetchBookedSlots();
  }, [selectedDay]);

  const fetchBookedSlots = async () => {
    setFetchingSlots(true);
    const day = days[selectedDay];
    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(day); endOfDay.setHours(23, 59, 59, 999);

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
          const t = new Date(start.getTime() + i * 30 * 60_000);
          occupied.push(`${String(t.getHours()).padStart(2, '0')}:${t.getMinutes() === 0 ? '00' : '30'}`);
        }
      });
      setBookedSlots(occupied);
    }
    setFetchingSlots(false);
  };

  // True if this slot is in the past (only applies to today)
  const isPast = (hour: number, period: 'AM' | 'PM', minute: '00' | '30'): boolean => {
    if (selectedDay !== 0) return false;
    let h = hour;
    if (period === 'AM' && hour === 12) h = 0;
    if (period === 'PM' && hour !== 12) h = hour + 12;
    const now = new Date();
    return h < now.getHours() || (h === now.getHours() && parseInt(minute) <= now.getMinutes());
  };

  // True if ALL 30-min slots in this hour are unavailable (past or booked)
  const isHourFullyDisabled = (hour: number, period: 'AM' | 'PM'): boolean =>
    MINUTES.every(m => isPast(hour, period, m) || bookedSlots.includes(to24(hour, period, m)));

  const estimatedKwh  = (selectedDuration / 60) * station.power_kw;
  const estimatedCost = estimatedKwh * station.price_per_kwh;

  const handleBook = async () => {
    if (selectedHour === null) {
      Alert.alert(t.warning, t.booking_select_time);
      return;
    }
    if (!profile) return;

    const slot = to24(selectedHour, selectedPeriod, selectedMinute);
    if (isPast(selectedHour, selectedPeriod, selectedMinute) ||
        bookedSlots.includes(slot)) {
      Alert.alert(t.warning, t.booking_select_time);
      return;
    }

    if (profile.wallet_balance < estimatedCost) {
      Alert.alert(
        t.booking_low_balance,
        `${t.booking_low_balance_msg} ${profile.wallet_balance.toFixed(3)} OMR. ${t.booking_low_balance_needed} ${estimatedCost.toFixed(3)} OMR`,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.booking_top_up, onPress: () => navigation.navigate('Tabs') },
        ],
      );
      return;
    }

    setLoading(true);
    try {
      const day = days[selectedDay];
      const [h, m] = slot.split(':').map(Number);
      const bookedAt = new Date(day);
      bookedAt.setHours(h, m, 0, 0);

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id:          profile.id,
          station_id:       station.id,
          listing_id:       listingId ?? null,
          status:           'confirmed',
          booked_at:        bookedAt.toISOString(),
          duration_minutes: selectedDuration,
          estimated_kwh:    estimatedKwh,
          estimated_cost:   estimatedCost,
        })
        .select()
        .single();

      if (error) throw error;

      if (profile.phone) {
        const dateStr = bookedAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const timeStr = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
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

  // ── Derived display ──────────────────────────────────────────
  const selectedTimeDisplay = selectedHour !== null
    ? `${selectedHour}:${selectedMinute} ${selectedPeriod}`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.booking_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Station info ── */}
        <View style={styles.stationCard}>
          <View style={styles.stationIconWrap}>
            <ZapIcon size={22} color={COLORS.primary} strokeWidth={2.5} />
          </View>
          <View style={styles.stationInfo}>
            <Text style={styles.stationName}>{stationDisplayName(station, isRTL)}</Text>
            <Text style={styles.stationSub}>
              {translateGov(station.governorate, isRTL)} · {station.price_per_kwh.toFixed(3)} OMR/kWh
            </Text>
          </View>
        </View>

        {/* ── Day picker ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_choose_day}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, i === selectedDay && styles.dayChipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[styles.dayName, i === selectedDay && styles.activeText]}>
                  {i === 0 ? t.booking_today : DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, i === selectedDay && styles.activeText]}>
                  {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Time picker ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_choose_time}</Text>

          {/* AM / PM toggle */}
          <View style={styles.periodRow}>
            {(['AM', 'PM'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, selectedPeriod === p && styles.periodBtnActive]}
                onPress={() => { setSelectedPeriod(p); setSelectedHour(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodText, selectedPeriod === p && styles.periodTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hour grid 1–12 */}
          {fetchingSlots ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.hourGrid}>
              {HOURS.map(h => {
                const disabled = isHourFullyDisabled(h, selectedPeriod);
                const selected = selectedHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.hourChip,
                      selected   && styles.hourChipSelected,
                      disabled   && styles.hourChipDisabled,
                    ]}
                    onPress={() => {
                      setSelectedHour(h);
                      // Auto-pick first available minute
                      const first = MINUTES.find(m =>
                        !isPast(h, selectedPeriod, m) && !bookedSlots.includes(to24(h, selectedPeriod, m)),
                      );
                      if (first) setSelectedMinute(first);
                    }}
                    disabled={disabled}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.hourText,
                      selected && styles.hourTextSelected,
                      disabled && styles.hourTextDisabled,
                    ]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Minute selector — appears once an hour is chosen */}
          {selectedHour !== null && (
            <View style={styles.minuteSection}>
              <Text style={styles.minuteLabel}>Choose minutes</Text>
              <View style={styles.minuteRow}>
                {MINUTES.map(m => {
                  const slot     = to24(selectedHour, selectedPeriod, m);
                  const disabled = isPast(selectedHour, selectedPeriod, m) || bookedSlots.includes(slot);
                  const selected = selectedMinute === m && !disabled;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.minuteChip,
                        selected  && styles.minuteChipSelected,
                        disabled  && styles.minuteChipDisabled,
                      ]}
                      onPress={() => !disabled && setSelectedMinute(m)}
                      disabled={disabled}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.minuteText,
                        selected && styles.minuteTextSelected,
                        disabled && styles.minuteTextDisabled,
                      ]}>
                        :{m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Selected time confirmation pill */}
          {selectedTimeDisplay && (
            <View style={styles.selectedTimePill}>
              <Text style={styles.selectedTimePillText}>⏰ {selectedTimeDisplay}</Text>
            </View>
          )}
        </View>

        {/* ── Duration ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.booking_duration}</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.durationChip, d === selectedDuration && styles.durationChipActive]}
                onPress={() => setSelectedDuration(d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.durationText, d === selectedDuration && styles.durationTextActive]}>
                  {d >= 60 ? `${d / 60}${t.hour_abbr}` : `${d}${t.min_abbr}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Summary ── */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{t.booking_summary}</Text>
          <SummaryRow label={t.booking_duration_label} value={`${selectedDuration} ${t.booking_minute}`} />
          <SummaryRow label={t.booking_kwh}            value={`${estimatedKwh.toFixed(1)} kWh`} />
          <SummaryRow label={t.booking_price_rate}     value={`${station.price_per_kwh.toFixed(3)} OMR/kWh`} />
          <View style={styles.summaryDivider} />
          <SummaryRow label={t.booking_total}          value={`${estimatedCost.toFixed(3)} OMR`} bold />
          {profile && (
            <SummaryRow
              label={t.booking_balance_after}
              value={`${(profile.wallet_balance - estimatedCost).toFixed(3)} OMR`}
              color={profile.wallet_balance >= estimatedCost ? COLORS.success : COLORS.error}
            />
          )}
        </View>

      </ScrollView>

      {/* ── Book button ── */}
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
            <Text style={styles.bookBtnText}>
              {t.booking_confirm_btn} · {estimatedCost.toFixed(3)} OMR
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function SummaryRow({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Station card
  stationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, margin: 16, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  stationIconWrap: { width: 48, height: 48, borderRadius: 15, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryTint },
  stationInfo:     { flex: 1 },
  stationName:     { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  stationSub:      { fontSize: 13, color: COLORS.textSecondary },

  // Section wrapper
  section: {
    backgroundColor: COLORS.card, borderRadius: 20,
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },

  // Day chips
  dayChip: {
    minWidth: 72, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', backgroundColor: COLORS.background,
  },
  dayChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  dayName:       { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  dayNum:        { fontSize: 13, fontWeight: '700', color: COLORS.text },
  activeText:    { color: COLORS.primary },

  // AM / PM toggle
  periodRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  periodBtn:       { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  periodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  periodText:      { fontSize: 16, fontWeight: '800', color: COLORS.textSecondary },
  periodTextActive:{ color: COLORS.primary },

  // Hour grid
  hourGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hourChip:          { width: '21%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  hourChipSelected:  { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  hourChipDisabled:  { backgroundColor: COLORS.backgroundAlt, borderColor: COLORS.border, opacity: 0.45 },
  hourText:          { fontSize: 18, fontWeight: '700', color: COLORS.text },
  hourTextSelected:  { color: '#fff' },
  hourTextDisabled:  { color: COLORS.textTertiary },

  // Minute selector
  minuteSection:       { marginTop: 16 },
  minuteLabel:         { fontSize: 12, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  minuteRow:           { flexDirection: 'row', gap: 10 },
  minuteChip:          { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  minuteChipSelected:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  minuteChipDisabled:  { backgroundColor: COLORS.backgroundAlt, borderColor: COLORS.border, opacity: 0.45 },
  minuteText:          { fontSize: 18, fontWeight: '700', color: COLORS.text },
  minuteTextSelected:  { color: COLORS.primary },
  minuteTextDisabled:  { color: COLORS.textTertiary },

  // Selected time pill
  selectedTimePill:     { marginTop: 14, backgroundColor: COLORS.primaryBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryTint },
  selectedTimePillText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },

  // Duration
  durationRow:        { flexDirection: 'row', gap: 8 },
  durationChip:       { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  durationChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  durationText:       { fontSize: 13, fontWeight: '700', color: COLORS.text },
  durationTextActive: { color: COLORS.primary },

  // Summary
  summary:          { backgroundColor: COLORS.card, borderRadius: 20, marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  summaryTitle:     { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  summaryLabel:     { fontSize: 14, color: COLORS.textSecondary },
  summaryLabelBold: { fontWeight: '700', color: COLORS.text },
  summaryValue:     { fontSize: 14, fontWeight: '600', color: COLORS.text },
  summaryValueBold: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  summaryDivider:   { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Footer
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  bookBtn:        { backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 17, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5 },
  bookBtnDisabled:{ opacity: 0.6 },
  bookBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
