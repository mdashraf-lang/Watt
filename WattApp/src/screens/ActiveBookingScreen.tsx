import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { Booking, MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { stationDisplayName } from '../i18n/govMap';
import { COLORS } from '../constants/colors';
import {
  ArrowLeftIcon, ZapIcon, CalendarIcon, ClockIcon,
  BatteryChargingIcon, WalletIcon, MapPinIcon,
} from '../components/icons';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'ActiveBooking'>;
type Route = RouteProp<MainStackParamList, 'ActiveBooking'>;

export default function ActiveBookingScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { bookingId } = route.params;
  const { profile } = useAuth();
  const { t, isRTL } = useLang();
  const locale = isRTL ? 'ar-OM' : 'en-GB';

  const [booking,       setBooking]       = useState<Booking | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [startLoading,  setStartLoading]  = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [now,           setNow]           = useState(Date.now());

  // Tick every second so the countdown and button state stay live
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch booking + real-time updates
  useEffect(() => {
    fetchBooking();

    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'bookings', filter: `id=eq.${bookingId}`,
      }, payload => setBooking(prev => prev ? { ...prev, ...payload.new } : null))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);


  const fetchBooking = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, station:stations(*), listing:charger_listings(id, address, station_name)')
      .eq('id', bookingId)
      .single();
    if (data) setBooking(data as Booking);
    setLoading(false);
  };

  const handleStartCharging = async () => {
    if (!booking || !profile) return;

    // Client-side time guard — prevents calling the edge function too early
    const bookedAt = new Date(booking.booked_at).getTime();
    const bookingEnd = bookedAt + booking.duration_minutes * 60_000;
    if (now < bookedAt) {
      const secsLeft = Math.ceil((bookedAt - now) / 1000);
      const minsLeft = Math.ceil(secsLeft / 60);
      Alert.alert(
        t.active_time_expired,
        isRTL
          ? `الحجز يبدأ بعد ${minsLeft} دقيقة`
          : `Booking starts in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}`,
      );
      return;
    }
    if (now > bookingEnd) {
      Alert.alert(t.error, isRTL ? 'انتهت نافذة الحجز' : 'Booking window has expired');
      return;
    }

    setStartLoading(true);
    let switchedOn = false;
    try {
      // Private charger booking — activate Tuya switch before creating the session
      if (booking.listing_id) {
        const { data: switchResult, error: switchError } = await supabase.functions.invoke(
          'control-tuya-switch',
          { body: { action: 'on', booking_id: booking.id } },
        );
        // Extract the real error message from the response body when possible
        let errMsg: string | null = null;
        if (switchResult?.error) errMsg = switchResult.error;
        else if (switchError) {
          try {
            const raw = await (switchError as any)?.context?.json?.();
            errMsg = raw?.error ?? switchError.message;
          } catch { errMsg = switchError.message; }
        }
        if (errMsg) {
          Alert.alert(t.active_charger_err_title, errMsg);
          return;
        }
        switchedOn = true;
      }

      const { data: session, error } = await supabase
        .from('charging_sessions')
        .insert({
          user_id:           profile.id,
          station_id:        booking.station_id ?? null,
          listing_id:        (booking as any).listing_id ?? null,
          connector_id:      booking.connector_id,
          booking_id:        booking.id,
          status:            'active',
          battery_start_pct: 20,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('bookings').update({ status: 'active' }).eq('id', booking.id);

      const listingData = (booking as any).listing;
      const displayName = booking.station?.name
        || listingData?.station_name
        || listingData?.address
        || 'Private Charger';

      navigation.replace('Charging', {
        sessionId:   session.id,
        stationName: displayName,
      });
    } catch (e: any) {
      // If we powered the charger on but couldn't start the session, turn it
      // back off so it isn't left running untracked (auto-shutoff can't catch
      // a session that was never created).
      if (switchedOn && booking.listing_id) {
        supabase.functions.invoke('control-tuya-switch', { body: { action: 'off', booking_id: booking.id } })
          .catch(() => {});
      }
      Alert.alert(t.error, e.message);
    } finally {
      setStartLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      t.active_cancel_title,
      t.active_cancel_msg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.active_cancel_btn,
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            await supabase
              .from('bookings')
              .update({ status: 'cancelled', cancellation_reason: 'user_cancelled' })
              .eq('id', bookingId);
            setCancelLoading(false);
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!booking) return null;

  const bookedAt   = new Date(booking.booked_at);
  const dateStr    = bookedAt.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr    = bookedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const refCode    = booking.qr_code.slice(0, 8).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.active_header}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Confirmation hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ZapIcon size={36} color={COLORS.primary} strokeWidth={2.5} />
          </View>
          <Text style={styles.heroTitle}>{t.active_confirmed}</Text>
          <Text style={styles.heroSub}>{t.active_confirmed_sub}</Text>
          <View style={styles.refBadge}>
            <Text style={styles.refLabel}>Ref #</Text>
            <Text style={styles.refCode}>{refCode}</Text>
          </View>
        </View>

        {/* ── Booking details ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.active_details_title}</Text>

          <InfoRow
            Icon={MapPinIcon}
            iconColor="#7c3aed" iconBg="#f5f3ff"
            label={t.active_station}
            value={booking.station ? stationDisplayName(booking.station, isRTL) : '—'}
          />
          <InfoRow
            Icon={CalendarIcon}
            iconColor="#2563eb" iconBg="#eff6ff"
            label={t.active_date}
            value={dateStr}
          />
          <InfoRow
            Icon={ClockIcon}
            iconColor="#0891b2" iconBg="#ecfeff"
            label={t.active_time}
            value={timeStr}
          />
          <InfoRow
            Icon={BatteryChargingIcon}
            iconColor={COLORS.primary} iconBg={COLORS.primaryBg}
            label={t.active_kwh}
            value={`~${booking.estimated_kwh?.toFixed(1) || '—'} kWh`}
          />

          <View style={styles.divider} />

          <View style={styles.costRow}>
            <View style={[styles.costIcon, { backgroundColor: '#fefce8' }]}>
              <WalletIcon size={16} color="#ca8a04" strokeWidth={2} />
            </View>
            <Text style={styles.costLabel}>{t.active_cost}</Text>
            <Text style={styles.costValue}>
              {booking.estimated_cost?.toFixed(3) || '—'} OMR
            </Text>
          </View>
        </View>


      </ScrollView>

      {/* ── Footer buttons ── */}
      <View style={styles.footer}>
        {/* Countdown badge — visible before booking time */}
        {booking && now < new Date(booking.booked_at).getTime() && (() => {
          const secsLeft = Math.max(0, Math.ceil((new Date(booking.booked_at).getTime() - now) / 1000));
          const h = Math.floor(secsLeft / 3600);
          const m = Math.floor((secsLeft % 3600) / 60);
          const s = secsLeft % 60;
          const label = h > 0
            ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
          return (
            <View style={styles.countdownBadge}>
              <ClockIcon size={14} color={COLORS.gold} strokeWidth={2} />
              <Text style={styles.countdownText}>
                {isRTL ? `يبدأ الحجز خلال  ${label}` : `Booking starts in  ${label}`}
              </Text>
            </View>
          );
        })()}

        <TouchableOpacity
          style={[
            styles.startBtn,
            (startLoading || (booking && now < new Date(booking.booked_at).getTime())) && styles.btnDisabled,
          ]}
          onPress={handleStartCharging}
          disabled={startLoading || (!!booking && now < new Date(booking.booked_at).getTime())}
          activeOpacity={0.85}
        >
          {startLoading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.startBtnText}>
                {booking?.listing_id ? t.active_activating : t.active_start_btn}
              </Text>
            </>
          ) : (
            <>
              <ZapIcon size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.startBtnText}>{t.active_start_btn}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelBtn, cancelLoading && styles.btnDisabled]}
          onPress={handleCancel}
          disabled={cancelLoading}
          activeOpacity={0.75}
        >
          <Text style={styles.cancelBtnText}>{t.active_cancel_btn}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function InfoRow({
  Icon, iconColor, iconBg, label, value,
}: { Icon: any; iconColor: string; iconBg: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        <Icon size={15} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },

  scroll: { padding: 16, gap: 14, paddingBottom: 32 },

  // Hero
  hero: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.primaryTint,
  },
  heroIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.primaryTint, marginBottom: 4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  heroSub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  refBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4, borderWidth: 1, borderColor: COLORS.border },
  refLabel:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  refCode:   { fontSize: 14, fontWeight: '800', color: COLORS.text, letterSpacing: 1.5 },

  // Details card
  card: {
    backgroundColor: COLORS.card, borderRadius: 22,
    padding: 18, gap: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, maxWidth: '55%', textAlign: 'right' },
  divider:   { height: 1, backgroundColor: COLORS.border },
  costRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  costIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  costLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  costValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },

  // Footer
  footer: {
    padding: 16, paddingBottom: 32, gap: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.goldBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.goldTint, marginBottom: 4,
  },
  countdownText: { fontSize: 13, fontWeight: '700', color: COLORS.goldDark, fontVariant: ['tabular-nums'] as any },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 17,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  cancelBtn:    { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:{ fontSize: 14, color: COLORS.error, fontWeight: '600' },
  btnDisabled:  { opacity: 0.5 },
});
