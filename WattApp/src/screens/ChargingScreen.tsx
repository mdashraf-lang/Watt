import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, StyleSheet,
  Text, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ChargingSession, MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useCharging } from '../context/ChargingContext';
import { COLORS } from '../constants/colors';
import { HomeIcon, ZapIcon } from '../components/icons';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'Charging'>;
type Route = RouteProp<MainStackParamList, 'Charging'>;

const PRICE_PER_KWH_DEFAULT = 0.028;
const KW_RATE = 22;

export default function ChargingScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { sessionId, stationName } = route.params;
  const { profile, refreshProfile } = useAuth();
  const { t, isRTL } = useLang();
  const { setActiveSession, clearActiveSession } = useCharging();

  const [session,        setSession]        = useState<ChargingSession | null>(null);
  const [kwhDelivered,   setKwhDelivered]   = useState(0);
  const [cost,           setCost]           = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stopLoading,    setStopLoading]    = useState(false);
  const [pricePerKwh,    setPricePerKwh]    = useState(PRICE_PER_KWH_DEFAULT);

  // Radar-ping pulse animation
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Mark session active in global context so the banner shows on other screens
  useEffect(() => {
    setActiveSession(sessionId, stationName);
  }, [sessionId, stationName]);

  useEffect(() => {
    fetchSession();
    startPulse();
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    const startTime = new Date(session.started_at).getTime();
    const interval = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
      const hours = elapsed / 3600;
      const kwh   = hours * KW_RATE;
      const c     = kwh * pricePerKwh;
      setKwhDelivered(kwh);
      setCost(c);
      // Sync to DB every 30 s
      if (elapsed % 30 === 0 && elapsed > 0) {
        await supabase
          .from('charging_sessions')
          .update({ kwh_delivered: kwh, cost: c })
          .eq('id', sessionId);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session, pricePerKwh]);

  const fetchSession = async () => {
    const { data } = await supabase
      .from('charging_sessions')
      .select('*, station:stations(*), booking:bookings(id, listing_id), listing:charger_listings(id, tuya_device_id, power_kw, price_per_kwh, address)')
      .eq('id', sessionId)
      .single();
    if (data) {
      setSession(data as any);
      const d = data as any;
      if (d.station?.price_per_kwh) setPricePerKwh(d.station.price_per_kwh);
      else if (d.listing?.price_per_kwh) setPricePerKwh(d.listing.price_per_kwh);
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1400,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0, duration: 300, useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Go home without stopping — session keeps running in background
  const handleMinimize = useCallback(() => {
    (navigation as any).popToTop();
  }, [navigation]);

  const handleStop = () => {
    Alert.alert(
      t.charging_stop_title,
      t.charging_stop_msg,
      [
        { text: t.charging_back, style: 'cancel' },
        { text: t.charging_stop_confirm, style: 'destructive', onPress: stopCharging },
      ]
    );
  };

  const stopCharging = async () => {
    if (!session || !profile) return;
    setStopLoading(true);
    try {
      // Turn off Tuya switch — non-blocking on failure
      const bookingId = (session as any).booking?.id;
      const listingId = (session as any).booking?.listing_id ?? (session as any).listing_id;
      if (listingId) {
        const body = bookingId
          ? { action: 'off', booking_id: bookingId }   // customer booking path
          : { action: 'off', listing_id: listingId };  // investor self-charge path
        supabase.functions.invoke('control-tuya-switch', { body })
          .catch(e => console.warn('[ChargingScreen] switch off failed:', e));
      }

      const batteryEnd = Math.min(100, Math.floor(20 + kwhDelivered * 4));
      await supabase.from('charging_sessions').update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        kwh_delivered: kwhDelivered,
        cost,
        battery_end_pct: batteryEnd,
      }).eq('id', sessionId);

      const newBalance = profile.wallet_balance - cost;
      await supabase.from('profiles').update({
        wallet_balance: newBalance,
        total_sessions: profile.total_sessions + 1,
        total_kwh:      profile.total_kwh + kwhDelivered,
      }).eq('id', profile.id);

      await supabase.from('wallet_transactions').insert({
        user_id:       profile.id,
        type:          'charge',
        amount:        -cost,
        balance_after: newBalance,
        description:   isRTL ? `شحن في ${stationName}` : `Charging at ${stationName}`,
        reference_id:  sessionId,
      });

      clearActiveSession();
      await refreshProfile();
      navigation.replace('SessionSummary', {
        kwhDelivered,
        cost,
        durationSeconds: elapsedSeconds,
        stationName,
      });
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setStopLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const remainingBalance = (profile?.wallet_balance ?? 0) - cost;

  // Animated ring values
  const ringScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.6] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={handleMinimize}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <HomeIcon size={19} color="rgba(255,255,255,0.85)" strokeWidth={2} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t.charging_header}</Text>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* ── Station name ───────────────────────── */}
      <Text style={styles.stationName} numberOfLines={1}>{stationName}</Text>

      {/* ── Charging animation ─────────────────── */}
      <View style={styles.animWrap}>
        {/* Radar ping ring */}
        <Animated.View
          style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        />
        {/* Bolt circle */}
        <View style={styles.boltCircle}>
          <ZapIcon size={48} color="#fff" strokeWidth={1.5} />
        </View>
      </View>

      {/* ── Timer ──────────────────────────────── */}
      <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
      <Text style={styles.timerLabel}>{t.charging_duration}</Text>

      {/* ── Two metrics ────────────────────────── */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{kwhDelivered.toFixed(2)}</Text>
          <Text style={styles.metricUnit}>kWh</Text>
          <Text style={styles.metricLabel}>{t.charging_energy}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={styles.metricValue}>{cost.toFixed(3)}</Text>
          <Text style={styles.metricUnit}>OMR</Text>
          <Text style={styles.metricLabel}>{t.charging_cost}</Text>
        </View>
      </View>

      {/* ── Remaining balance ──────────────────── */}
      {profile && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>{t.charging_balance_after}</Text>
          <Text style={[
            styles.balanceValue,
            { color: remainingBalance < 0 ? '#fca5a5' : 'rgba(255,255,255,0.9)' },
          ]}>
            {remainingBalance.toFixed(3)} OMR
          </Text>
        </View>
      )}

      {/* ── Stop button ────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.stopBtn, stopLoading && { opacity: 0.6 }]}
          onPress={handleStop}
          disabled={stopLoading}
          activeOpacity={0.85}
        >
          {stopLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.stopSquare} />
              <Text style={styles.stopText}>{t.charging_stop}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  homeBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: '#fff',
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
  },
  liveText: {
    fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8,
  },

  // Station name
  stationName: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)',
    marginBottom: 8, paddingHorizontal: 32, textAlign: 'center',
  },

  // Animation
  animWrap: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 16, marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: COLORS.primaryLight,
  },
  boltCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primaryLight,
    shadowOpacity: 0.5, shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, elevation: 10,
  },

  // Timer
  timer: {
    fontSize: 52, fontWeight: '800', color: '#fff',
    letterSpacing: 2, fontVariant: ['tabular-nums'] as any,
  },
  timerLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
    marginTop: 2, marginBottom: 28, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, paddingVertical: 20, marginBottom: 14,
  },
  metric: {
    flex: 1, alignItems: 'center', gap: 2,
  },
  metricValue: {
    fontSize: 28, fontWeight: '800', color: '#fff',
  },
  metricUnit: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600',
  },
  metricLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1, height: 52,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Balance
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  balanceLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
  },
  balanceValue: {
    fontSize: 15, fontWeight: '700',
  },

  // Stop
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 32,
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: COLORS.error, borderRadius: 18, paddingVertical: 18,
    shadowColor: COLORS.error, shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  stopSquare: {
    width: 16, height: 16, borderRadius: 4, backgroundColor: '#fff',
  },
  stopText: {
    color: '#fff', fontWeight: '700', fontSize: 17,
  },
});
