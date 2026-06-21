import React, { useRef } from 'react';
import {
  Animated, StyleSheet, Text,
  TouchableOpacity, View, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CustomerStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import {
  ZapIcon, CheckIcon, WalletIcon, TimerIcon, LeafIcon, ShareIcon,
} from '../components/icons';

type Nav   = NativeStackNavigationProp<CustomerStackParamList, 'SessionSummary'>;
type Route = RouteProp<CustomerStackParamList, 'SessionSummary'>;

export default function SessionSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { t, isRTL } = useLang();
  const { kwhDelivered, cost, durationSeconds, stationName } = route.params;

  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 7,
    }).start();
  }, []);

  const co2Saved = kwhDelivered * 0.5;

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}${t.hour_abbr} ${m}${t.min_abbr}`;
    return `${m}${t.min_abbr} ${sec}s`;
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: isRTL
          ? `شحنت سيارتي الكهربائية مع واط ⚡\n${kwhDelivered.toFixed(2)} kWh · ${cost.toFixed(3)} OMR · ${co2Saved.toFixed(1)} كجم CO₂ موفّر\n\nحمّل واط – تطبيق شحن السيارات الكهربائية في عُمان`
          : `Just charged my EV with Watt ⚡\n${kwhDelivered.toFixed(2)} kWh · ${cost.toFixed(3)} OMR · ${co2Saved.toFixed(1)} kg CO₂ saved\n\nDownload Watt – Oman's EV charging app`,
      });
    } catch {}
  };

  const goHome = () => {
    // Reset the stack so the user lands on Map tab, not the session stack
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* Success icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconOuter}>
            <View style={styles.iconInner}>
              <CheckIcon size={48} color="#fff" strokeWidth={3} />
            </View>
          </View>
        </Animated.View>

        <Text style={styles.title}>{t.session_summary_title}</Text>
        <Text style={styles.sub}>{t.session_summary_sub}</Text>
        <Text style={styles.stationName}>{stationName}</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            Icon={ZapIcon}
            label={t.session_summary_kwh}
            value={kwhDelivered.toFixed(2)}
            unit="kWh"
            color={COLORS.primary}
          />
          <StatCard
            Icon={WalletIcon}
            label={t.session_summary_cost}
            value={cost.toFixed(3)}
            unit="OMR"
            color={COLORS.gold}
          />
          <StatCard
            Icon={TimerIcon}
            label={t.session_summary_duration}
            value={formatDuration(durationSeconds)}
            unit=""
            color="#6366f1"
          />
          <StatCard
            Icon={LeafIcon}
            label={t.session_summary_co2}
            value={co2Saved.toFixed(1)}
            unit="kg"
            color={COLORS.success}
          />
        </View>

        {/* CO₂ context card */}
        <View style={[styles.co2Card, isRTL && styles.co2CardRTL]}>
          <LeafIcon size={28} color={COLORS.success} strokeWidth={1.5} />
          <Text style={[styles.co2Text, isRTL && styles.rtlText]}>
            {t.session_summary_co2_prefix}{' '}
            <Text style={styles.co2Highlight}>{co2Saved.toFixed(1)} kg</Text>
            {' '}{t.session_summary_co2_suffix}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <ShareIcon size={17} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.shareBtnText}>{t.session_summary_share}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={goHome} activeOpacity={0.85}>
          <ZapIcon size={18} color="#fff" strokeWidth={2.5} />
          <Text style={styles.homeBtnText}>{t.session_summary_done}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ Icon, label, value, unit, color }: {
  Icon: React.ComponentType<any>; label: string; value: string; unit: string; color: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 16 },

  iconWrap:  { marginBottom: 4 },
  iconOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.primaryLight,
  },
  iconInner: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  title:       { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  sub:         { fontSize: 14, color: COLORS.textSecondary, marginTop: -8 },
  stationName: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' },
  rtlText:     { textAlign: 'right' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16,
    alignItems: 'center', gap: 4,
    borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue:    { fontSize: 22, fontWeight: '800' },
  statUnit:     { fontSize: 11, color: COLORS.textTertiary },
  statLabel:    { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },

  // CO₂ card
  co2Card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.successBg, borderRadius: 18,
    padding: 14, width: '100%',
    borderWidth: 1, borderColor: COLORS.primaryTint,
  },
  co2CardRTL:    { flexDirection: 'row-reverse' },
  co2Text:       { flex: 1, fontSize: 13, color: COLORS.successDark, lineHeight: 20 },
  co2Highlight:  { fontWeight: '800', color: COLORS.primary },

  // Footer
  footer:   { padding: 20, paddingBottom: 32, gap: 12 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16, paddingVertical: 14,
  },
  shareBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  homeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
