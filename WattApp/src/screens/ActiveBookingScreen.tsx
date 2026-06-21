import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { Booking, MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { stationDisplayName } from '../i18n/govMap';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ActiveBooking'>;
type Route = RouteProp<MainStackParamList, 'ActiveBooking'>;

export default function ActiveBookingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;
  const { profile, refreshProfile } = useAuth();
  const { t, isRTL } = useLang();
  const locale = isRTL ? 'ar-OM' : 'en-GB';

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchBooking();
    startScanAnimation();

    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        payload => setBooking(prev => prev ? { ...prev, ...payload.new } : null))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;
    const interval = setInterval(() => {
      const bookedAt = new Date(booking.booked_at);
      const expiresAt = new Date(bookedAt.getTime() + booking.duration_minutes * 60000);
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(t.active_time_expired);
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [booking]);

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  };

  const fetchBooking = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, station:stations(*)')
      .eq('id', bookingId)
      .single();
    if (data) setBooking(data as Booking);
    setLoading(false);
  };

  const handleStartCharging = async () => {
    if (!booking || !profile) return;
    setStartLoading(true);
    try {
      const { data: session, error } = await supabase.from('charging_sessions').insert({
        user_id: profile.id,
        station_id: booking.station_id,
        connector_id: booking.connector_id,
        booking_id: booking.id,
        status: 'active',
        battery_start_pct: 20,
      }).select().single();

      if (error) throw error;

      await supabase.from('bookings').update({ status: 'active' }).eq('id', booking.id);
      navigation.replace('Charging', {
        sessionId: session.id,
        stationName: booking.station?.name || '',
      });
    } catch (e: any) {
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
          text: t.active_cancel_btn, style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            await supabase.from('bookings').update({ status: 'cancelled', cancellation_reason: 'user_cancelled' }).eq('id', bookingId);
            setCancelLoading(false);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!booking) return null;

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 140] });
  const bookedAt = new Date(booking.booked_at);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.active_header}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Status badge */}
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.statusTitle}>{t.active_confirmed}</Text>
          <Text style={styles.statusSub}>{t.active_confirmed_sub}</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t.active_qr_title}</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={booking.qr_code}
              size={160}
              color={COLORS.primary}
              backgroundColor="#fff"
            />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
          </View>
          <Text style={styles.qrCode}>{booking.qr_code.slice(0, 8).toUpperCase()}</Text>
        </View>

        {/* Countdown */}
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>{t.active_countdown_label}</Text>
          <Text style={styles.countdownTime}>{timeLeft || '--:--:--'}</Text>
          <Text style={styles.countdownSub}>{t.active_countdown_sub}</Text>
        </View>

        {/* Booking details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>{t.active_details_title}</Text>
          <DetailRow label={t.active_station} value={booking.station ? stationDisplayName(booking.station, isRTL) : ''} />
          <DetailRow label={t.active_date} value={bookedAt.toLocaleDateString(locale)} />
          <DetailRow label={t.active_time} value={bookedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} />
          <DetailRow label={t.active_duration} value={`${booking.duration_minutes} ${t.active_duration_min}`} />
          <DetailRow label={t.active_kwh} value={`${booking.estimated_kwh?.toFixed(1) || '—'} kWh`} />
          <View style={styles.divider} />
          <DetailRow label={t.active_cost} value={`${booking.estimated_cost?.toFixed(3) || '—'} OMR`} bold />
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, startLoading && styles.btnDisabled]}
          onPress={handleStartCharging}
          disabled={startLoading}
          activeOpacity={0.85}
        >
          {startLoading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={styles.startBtnIcon}>⚡</Text>
              <Text style={styles.startBtnText}>{t.active_start_btn}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, cancelLoading && styles.btnDisabled]}
          onPress={handleCancel}
          disabled={cancelLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelBtnText}>{t.active_cancel_btn}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && styles.detailValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: COLORS.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusCard: {
    backgroundColor: '#f0fdf4', borderRadius: 20, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0',
  },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 6 },
  statusSub: { fontSize: 14, color: COLORS.primary, textAlign: 'center' },
  qrCard: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  qrTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  qrContainer: {
    position: 'relative', padding: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#bbf7d0', overflow: 'hidden', marginBottom: 10,
  },
  scanLine: {
    position: 'absolute', left: 16, right: 16, height: 2,
    backgroundColor: COLORS.primary, opacity: 0.6,
  },
  qrCode: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 2 },
  countdownCard: {
    backgroundColor: COLORS.primary, borderRadius: 20, padding: 20, alignItems: 'center',
  },
  countdownLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  countdownTime: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: 4 },
  countdownSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  detailsCard: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  detailsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  detailValueBold: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  footer: { padding: 16, paddingBottom: 32, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15,
  },
  startBtnIcon: { fontSize: 20 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { borderWidth: 1.5, borderColor: COLORS.error, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
