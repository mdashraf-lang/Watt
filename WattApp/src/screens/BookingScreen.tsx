import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { translateGov, stationDisplayName } from '../i18n/govMap';
import { COLORS } from '../constants/colors';
import { ZapIcon, ArrowLeftIcon, MapPinIcon } from '../components/icons';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'Booking'>;
type Route = RouteProp<MainStackParamList, 'Booking'>;

// ── Constants ─────────────────────────────────────────────────
const ITEM_H  = 56;
const VISIBLE = 3;                    // rows visible in drum
const PAD_H   = ITEM_H * Math.floor(VISIBLE / 2); // padding top/bottom

const HOURS   = [1,2,3,4,5,6,7,8,9,10,11,12] as const;
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM','PM'] as const;

const QUICK_DURATIONS = [30, 60, 90, 120, 180];

function getDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
}

function to24(hour: number, period: 'AM'|'PM', minute: string): string {
  let h = hour;
  if (period === 'AM' && hour === 12) h = 0;
  if (period === 'PM' && hour !== 12) h = hour + 12;
  return `${String(h).padStart(2,'0')}:${minute}`;
}

// ── Drum (wheel) picker ────────────────────────────────────────
// ScrollView with nestedScrollEnabled lets Android scroll the drum
// independently even when it's inside the outer ScrollView.
function DrumPicker<T extends string | number>({
  items,
  selected,
  onSelect,
  width = 80,
  format,
  disabled,
}: {
  items: readonly T[];
  selected: T;
  onSelect: (v: T) => void;
  width?: number;
  format?: (v: T) => string;
  disabled?: (v: T) => boolean;
}) {
  const svRef       = useRef<ScrollView>(null);
  const dragTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to the current selection on mount
  useEffect(() => {
    const idx = [...items].findIndex(it => String(it) === String(selected));
    if (idx < 0) return;
    const t = setTimeout(() => {
      svRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const snapTo = (offsetY: number) => {
    const idx     = Math.round(offsetY / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    onSelect(items[clamped]);
    svRef.current?.scrollTo({ y: clamped * ITEM_H, animated: false });
  };

  return (
    <View style={{ width, height: VISIBLE * ITEM_H }}>
      {/* Green highlight strip for the center / selected row */}
      <View style={[drum.highlight, { top: PAD_H }]} pointerEvents="none" />

      <ScrollView
        ref={svRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled                      // Android: scroll independently of parent
        contentContainerStyle={{ paddingVertical: PAD_H }}
        onMomentumScrollBegin={() => {
          if (dragTimeout.current) clearTimeout(dragTimeout.current);
        }}
        onMomentumScrollEnd={e => {
          if (dragTimeout.current) clearTimeout(dragTimeout.current);
          snapTo(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={e => {
          const y = e.nativeEvent.contentOffset.y;
          // Give momentum 80 ms to start; if it doesn't, snap from drag position
          dragTimeout.current = setTimeout(() => snapTo(y), 80);
        }}
      >
        {[...items].map((item, index) => {
          const isSel = String(item) === String(selected);
          const isDis = disabled?.(item) ?? false;
          return (
            <TouchableOpacity
              key={String(item) + index}
              style={[drum.item, { height: ITEM_H }]}
              onPress={() => {
                if (isDis) return;
                onSelect(item);
                svRef.current?.scrollTo({ y: index * ITEM_H, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text style={[drum.text, isSel && drum.sel, isDis && drum.dis]}>
                {format ? format(item) : String(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const drum = StyleSheet.create({
  highlight: {
    position: 'absolute', left: 4, right: 4, height: ITEM_H,
    backgroundColor: COLORS.primaryBg, borderRadius: 14,
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: COLORS.primaryTint,
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20, fontWeight: '400', color: COLORS.textTertiary },
  sel:  { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  dis:  { color: COLORS.border, textDecorationLine: 'line-through' },
});

// ── Main Screen ────────────────────────────────────────────────
export default function BookingScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { station, listingId } = route.params;
  const { profile } = useAuth();
  const { t, isRTL } = useLang();
  const insets = useSafeAreaInsets();

  const DAY_NAMES   = [t.day_0, t.day_1, t.day_2, t.day_3, t.day_4, t.day_5, t.day_6];
  const MONTH_NAMES = [t.month_0, t.month_1, t.month_2, t.month_3, t.month_4,
    t.month_5, t.month_6, t.month_7, t.month_8, t.month_9, t.month_10, t.month_11];

  const days = getDays();

  const [selectedDay,    setSelectedDay]    = useState(0);
  const [selectedHour,   setSelectedHour]   = useState<number>(() => {
    const h = new Date().getHours() % 12; return h === 0 ? 12 : h;
  });
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM'|'PM'>(() =>
    new Date().getHours() < 12 ? 'AM' : 'PM',
  );
  const [durationInput,  setDurationInput]  = useState('60');
  // Each range = [startMinutesFromMidnight, endMinutesFromMidnight]
  const [bookedRanges, setBookedRanges] = useState<[number, number][]>([]);
  const [loading,        setLoading]        = useState(false);
  const [fetchingSlots,  setFetchingSlots]  = useState(false);

  const selectedDuration = Math.max(15, Math.min(720, parseInt(durationInput) || 60));
  const estimatedKwh     = (selectedDuration / 60) * station.power_kw;
  const estimatedCost    = estimatedKwh * station.price_per_kwh;

  const currentSlot = to24(selectedHour, selectedPeriod, selectedMinute);

  const toMidnightMins = (h24: number, min: number) => h24 * 60 + min;
  const selected24 = (() => {
    let h = selectedHour;
    if (selectedPeriod === 'AM' && h === 12) h = 0;
    if (selectedPeriod === 'PM' && h !== 12) h += 12;
    return toMidnightMins(h, parseInt(selectedMinute));
  })();

  const slotBooked = bookedRanges.some(([start, end]) => selected24 >= start && selected24 < end);
  const slotPast   = selectedDay === 0 && (() => {
    const now = new Date();
    return selected24 <= toMidnightMins(now.getHours(), now.getMinutes());
  })();
  const slotUnavailable = slotBooked || slotPast;

  // For the minute drum: check if a minute value at the current hour/period is booked
  const isMinuteBooked = (minStr: string) => {
    let h = selectedHour;
    if (selectedPeriod === 'AM' && h === 12) h = 0;
    if (selectedPeriod === 'PM' && h !== 12) h += 12;
    const m = toMidnightMins(h, parseInt(minStr));
    return bookedRanges.some(([start, end]) => m >= start && m < end);
  };

  useEffect(() => {
    fetchBookedSlots();
  }, [selectedDay]);

  const fetchBookedSlots = async () => {
    setFetchingSlots(true);
    const day = days[selectedDay];
    const startOfDay = new Date(day); startOfDay.setHours(0,0,0,0);
    const endOfDay   = new Date(day); endOfDay.setHours(23,59,59,999);
    const { data } = await supabase
      .from('bookings')
      .select('booked_at, duration_minutes')
      .eq('station_id', station.id)
      .gte('booked_at', startOfDay.toISOString())
      .lte('booked_at', endOfDay.toISOString())
      .in('status', ['pending','confirmed','active']);
    if (data) {
      const ranges: [number, number][] = data.map(b => {
        const start = new Date(b.booked_at);
        const startMin = start.getHours() * 60 + start.getMinutes();
        return [startMin, startMin + b.duration_minutes];
      });
      setBookedRanges(ranges);
    }
    setFetchingSlots(false);
  };

  const handleDirections = () => {
    const { latitude, longitude, name } = station;
    const label = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${latitude},${longitude}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert(t.error, 'Unable to open maps.')
    );
  };

  const handleBook = async () => {
    if (slotUnavailable) {
      Alert.alert(t.warning, t.booking_select_time); return;
    }
    const dur = parseInt(durationInput);
    if (!dur || dur < 15 || dur > 720) {
      Alert.alert(t.warning, 'Enter a duration between 15 and 720 minutes.'); return;
    }
    if (!profile) return;
    // Pay-after-charging model: no wallet balance required to book.
    // The session is paid when charging stops (wallet first, card for the rest).
    // Debt cap: block new bookings until outstanding balance is settled.
    if (profile.wallet_balance < -0.5) {
      Alert.alert(
        t.booking_debt_title,
        `${t.booking_debt_msg} ${Math.abs(profile.wallet_balance).toFixed(3)} OMR`,
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
      const [h, m] = currentSlot.split(':').map(Number);
      const bookedAt = new Date(day); bookedAt.setHours(h, m, 0, 0);
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id:          profile.id,
          station_id:       listingId ? null : station.id,
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
        supabase.functions.invoke('notify-booking', { body: { phone: profile.phone, date: dateStr, time: timeStr } });
      }
      // Push the host a heads-up when their charger is booked (fire-and-forget)
      if (listingId) {
        supabase.functions.invoke('send-push', { body: { booking_id: data.id } })
          .catch(e => console.warn('[BookingScreen] host push failed:', e));
      }
      navigation.replace('ActiveBooking', { bookingId: data.id });
    } catch (e: any) {
      Alert.alert(t.booking_error, e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.booking_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} keyboardShouldPersistTaps="handled">

        {/* Station card */}
        <View style={s.stationCard}>
          <View style={s.stationIconWrap}>
            <ZapIcon size={22} color={COLORS.primary} strokeWidth={2.5} />
          </View>
          <View style={s.stationInfo}>
            <Text style={s.stationName}>{stationDisplayName(station, isRTL)}</Text>
            <Text style={s.stationSub}>
              {translateGov(station.governorate, isRTL)} · {station.price_per_kwh.toFixed(3)} OMR/kWh
            </Text>
          </View>
          <TouchableOpacity style={s.directionsBtn} onPress={handleDirections} activeOpacity={0.8}>
            <MapPinIcon size={14} color={COLORS.primary} strokeWidth={2.5} />
            <Text style={s.directionsBtnText}>{t.booking_directions}</Text>
          </TouchableOpacity>
        </View>

        {/* Day picker */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.booking_choose_day}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[s.dayChip, i === selectedDay && s.dayChipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[s.dayName, i === selectedDay && s.activeText]}>
                  {i === 0 ? t.booking_today : DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[s.dayNum, i === selectedDay && s.activeText]}>
                  {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Time picker ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.booking_choose_time}</Text>

          {fetchingSlots ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 28 }} />
          ) : (
            <>
              {/* 3-column drum */}
              <View style={s.drumRow}>
                {/* Hour */}
                <View style={s.drumCol}>
                  <Text style={s.drumLabel}>Hour</Text>
                  <DrumPicker
                    items={HOURS}
                    selected={selectedHour}
                    onSelect={v => setSelectedHour(v)}
                    width={80}
                    format={v => String(v)}
                  />
                </View>

                {/* Separator */}
                <View style={s.drumSep}>
                  <Text style={s.drumSepText}>:</Text>
                </View>

                {/* Minute */}
                <View style={s.drumCol}>
                  <Text style={s.drumLabel}>Min</Text>
                  <DrumPicker
                    items={MINUTES}
                    selected={selectedMinute}
                    onSelect={v => setSelectedMinute(v)}
                    width={72}
                    format={v => v}
                    disabled={v => isMinuteBooked(v)}
                  />
                </View>

                {/* Spacer */}
                <View style={{ width: 16 }} />

                {/* AM / PM */}
                <View style={s.drumCol}>
                  <Text style={s.drumLabel}>Period</Text>
                  <DrumPicker
                    items={PERIODS}
                    selected={selectedPeriod}
                    onSelect={v => setSelectedPeriod(v as 'AM'|'PM')}
                    width={72}
                    format={v => v}
                  />
                </View>
              </View>

              {/* Selected time display */}
              <View style={[s.timePill, slotUnavailable && s.timePillWarn]}>
                <Text style={[s.timePillText, slotUnavailable && s.timePillTextWarn]}>
                  {slotUnavailable
                    ? `⚠ ${slotPast ? 'This time has passed' : 'This slot is booked'}`
                    : `⏰ ${selectedHour}:${selectedMinute} ${selectedPeriod}`
                  }
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Duration ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.booking_duration}</Text>

          {/* Typable input */}
          <View style={s.durationInputWrap}>
            <TextInput
              style={s.durationInput}
              value={durationInput}
              onChangeText={v => setDurationInput(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={3}
              placeholder="60"
              placeholderTextColor={COLORS.textTertiary}
            />
            <Text style={s.durationUnit}>min</Text>
            {durationInput ? (
              <View style={s.durationHint}>
                <Text style={s.durationHintText}>
                  {parseInt(durationInput) >= 60
                    ? `${(parseInt(durationInput)/60).toFixed(1)} hr`
                    : `${durationInput} min`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Quick-select chips */}
          <View style={s.quickRow}>
            {QUICK_DURATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.quickChip, String(d) === durationInput && s.quickChipActive]}
                onPress={() => setDurationInput(String(d))}
                activeOpacity={0.8}
              >
                <Text style={[s.quickChipText, String(d) === durationInput && s.quickChipTextActive]}>
                  {d >= 60 ? `${d/60}${t.hour_abbr}` : `${d}${t.min_abbr}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={s.summary}>
          <Text style={s.summaryTitle}>{t.booking_summary}</Text>
          <SummaryRow label={t.booking_duration_label} value={`${selectedDuration} ${t.booking_minute}`} />
          <SummaryRow label={t.booking_kwh}            value={`${estimatedKwh.toFixed(1)} kWh`} />
          <SummaryRow label={t.booking_price_rate}     value={`${station.price_per_kwh.toFixed(3)} OMR/kWh`} />
          <View style={s.summaryDivider} />
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

      {/* Book button */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TouchableOpacity
          style={[s.bookBtn, (loading || slotUnavailable) && s.bookBtnDisabled]}
          onPress={handleBook}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.bookBtnText}>{t.booking_confirm_btn} · {estimatedCost.toFixed(3)} OMR</Text>
          }
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function SummaryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, bold && s.summaryLabelBold]}>{label}</Text>
      <Text style={[s.summaryValue, bold && s.summaryValueBold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },

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
  directionsBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.primaryTint },
  directionsBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  section: {
    backgroundColor: COLORS.card, borderRadius: 20,
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 },

  dayChip:       { minWidth: 72, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  dayChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  dayName:       { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  dayNum:        { fontSize: 13, fontWeight: '700', color: COLORS.text },
  activeText:    { color: COLORS.primary },

  // ── Drum ──
  drumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  drumCol: { alignItems: 'center', gap: 6 },
  drumLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  drumSep: { paddingBottom: 4, paddingHorizontal: 2 },
  drumSepText: { fontSize: 28, fontWeight: '700', color: COLORS.textTertiary, lineHeight: VISIBLE * ITEM_H },

  // Time pill
  timePill:         { marginTop: 16, backgroundColor: COLORS.primaryBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryTint },
  timePillWarn:     { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  timePillText:     { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  timePillTextWarn: { color: COLORS.error },

  // ── Duration ──
  durationInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14,
  },
  durationInput: { flex: 1, fontSize: 28, fontWeight: '800', color: COLORS.text, paddingVertical: 8 },
  durationUnit:  { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  durationHint:  { backgroundColor: COLORS.primaryBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  durationHintText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip:         { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.background },
  quickChipActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  quickChipText:     { fontSize: 12, fontWeight: '700', color: COLORS.text },
  quickChipTextActive: { color: COLORS.primary },

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
  footer:          { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  bookBtn:         { backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 17, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5 },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});
