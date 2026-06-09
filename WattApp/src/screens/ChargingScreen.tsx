import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ChargingSession, MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Charging'>;
type Route = RouteProp<MainStackParamList, 'Charging'>;

const PRICE_PER_KWH_DEFAULT = 0.028;
const KW_RATE = 22; // kW delivered per hour

export default function ChargingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sessionId, stationName } = route.params;
  const { profile, refreshProfile } = useAuth();
  const { t } = useLang();

  const [session, setSession] = useState<ChargingSession | null>(null);
  const [batteryPct, setBatteryPct] = useState(20);
  const [kwhDelivered, setKwhDelivered] = useState(0);
  const [cost, setCost] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stopLoading, setStopLoading] = useState(false);
  const [pricePerKwh, setPricePerKwh] = useState(PRICE_PER_KWH_DEFAULT);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
      const kwh = hours * KW_RATE;
      const c = kwh * pricePerKwh;
      setKwhDelivered(kwh);
      setCost(c);
      const bat = Math.min(100, Math.floor(20 + kwh * 4));
      setBatteryPct(bat);
      Animated.timing(progressAnim, { toValue: bat / 100, duration: 500, useNativeDriver: false }).start();

      // Sync to DB every 30 seconds
      if (elapsed % 30 === 0) {
        await supabase.from('charging_sessions').update({ kwh_delivered: kwh, cost: c }).eq('id', sessionId);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session, pricePerKwh]);

  const fetchSession = async () => {
    const { data } = await supabase
      .from('charging_sessions')
      .select('*, station:stations(*)')
      .eq('id', sessionId)
      .single();
    if (data) {
      setSession(data as any);
      if ((data as any).station?.price_per_kwh) {
        setPricePerKwh((data as any).station.price_per_kwh);
      }
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const handleStop = () => {
    Alert.alert(
      t.charging_stop_title,
      `${t.charging_stop_msg}\n${kwhDelivered.toFixed(2)} kWh - ${cost.toFixed(3)} OMR`,
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
      // End session
      await supabase.from('charging_sessions').update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        kwh_delivered: kwhDelivered,
        cost,
        battery_end_pct: batteryPct,
      }).eq('id', sessionId);

      // Deduct from wallet
      const newBalance = profile.wallet_balance - cost;
      await supabase.from('profiles').update({
        wallet_balance: newBalance,
        total_sessions: profile.total_sessions + 1,
        total_kwh: profile.total_kwh + kwhDelivered,
      }).eq('id', profile.id);

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: profile.id,
        type: 'charge',
        amount: -cost,
        balance_after: newBalance,
        description: `شحن في ${stationName}`,
        reference_id: sessionId,
      });

      await refreshProfile();
      navigation.navigate('Tabs');
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setStopLoading(false);
    }
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [COLORS.fault, COLORS.warning, COLORS.available, COLORS.primary],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>{t.charging_header}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Station name */}
      <Text style={styles.stationName}>{stationName}</Text>

      {/* Main charging display */}
      <View style={styles.chargeDisplay}>
        {/* Pulsing bolt */}
        <Animated.View style={[styles.boltOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.boltInner}>
            <Text style={styles.boltEmoji}>⚡</Text>
          </View>
        </Animated.View>

        {/* Battery ring */}
        <View style={styles.batteryRing}>
          <View style={styles.batteryLabel}>
            <Text style={styles.batteryPct}>{batteryPct}%</Text>
            <Text style={styles.batteryText}>{t.charging_battery}</Text>
          </View>
          <Animated.View style={[styles.progressBar, { backgroundColor: progressColor, width: `${batteryPct}%` }]} />
        </View>
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <StatCard label={t.charging_energy} value={kwhDelivered.toFixed(2)} unit="kWh" icon="⚡" color={COLORS.primary} />
        <StatCard label={t.charging_cost} value={cost.toFixed(3)} unit="OMR" icon="💰" color={COLORS.gold} />
        <StatCard label={t.charging_duration} value={formatElapsed(elapsedSeconds)} unit="" icon="⏱" color={COLORS.text} />
      </View>

      {/* Wallet balance */}
      {profile && (
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>{t.charging_balance_after}</Text>
          <Text style={[styles.walletBalance, { color: profile.wallet_balance - cost < 0 ? COLORS.error : COLORS.primary }]}>
            {(profile.wallet_balance - cost).toFixed(3)} OMR
          </Text>
        </View>
      )}

      {/* Stop button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.stopBtn, stopLoading && styles.stopBtnDisabled]}
          onPress={handleStop}
          disabled={stopLoading}
          activeOpacity={0.85}
        >
          {stopLoading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={styles.stopIcon}>⏹</Text>
              <Text style={styles.stopText}>{t.charging_stop}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, icon, color }: {
  label: string; value: string; unit: string; icon: string; color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  stationName: { textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 8 },
  chargeDisplay: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  boltOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  boltInner: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  boltEmoji: { fontSize: 48 },
  batteryRing: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16, padding: 16, gap: 10,
  },
  batteryLabel: { alignItems: 'center', gap: 2 },
  batteryPct: { fontSize: 40, fontWeight: '800', color: '#fff' },
  batteryText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: COLORS.available },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    padding: 12, alignItems: 'center', gap: 2,
  },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statUnit: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  walletInfo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16, borderRadius: 14, padding: 14,
  },
  walletLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  walletBalance: { fontSize: 16, fontWeight: '800' },
  footer: { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 32 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.error, borderRadius: 16, paddingVertical: 16,
  },
  stopBtnDisabled: { opacity: 0.6 },
  stopIcon: { fontSize: 20 },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
