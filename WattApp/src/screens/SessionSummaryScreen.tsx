import React, { useRef } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CustomerStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { CheckIcon, ZapIcon, LeafIcon, HomeIcon } from '../components/icons';

type Nav   = NativeStackNavigationProp<CustomerStackParamList, 'SessionSummary'>;
type Route = RouteProp<CustomerStackParamList, 'SessionSummary'>;

export default function SessionSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { t, isRTL } = useLang();
  const { kwhDelivered, cost, durationSeconds, stationName } = route.params;

  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 7 }).start();
  }, []);

  const co2Saved  = kwhDelivered * 0.5;
  const rate      = kwhDelivered > 0 ? cost / kwhDelivered : 0.028;
  const now       = new Date();
  const dateStr   = now.toLocaleDateString(isRTL ? 'ar-OM' : 'en-OM', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr   = now.toLocaleTimeString(isRTL ? 'ar-OM' : 'en-OM', { hour: '2-digit', minute: '2-digit' });

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Success header */}
        <View style={styles.headerSection}>
          <Animated.View style={[styles.checkWrap, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.checkOuter}>
              <CheckIcon size={44} color="#fff" strokeWidth={3} />
            </View>
          </Animated.View>
          <Text style={styles.title}>{t.session_summary_title}</Text>
          <Text style={styles.subtitle}>{t.session_summary_sub}</Text>
        </View>

        {/* Receipt card */}
        <View style={styles.receiptCard}>
          {/* Receipt header row */}
          <View style={styles.receiptHeader}>
            <View style={styles.receiptBrand}>
              <ZapIcon size={14} color={COLORS.primary} strokeWidth={2.5} />
              <Text style={styles.receiptBrandText}>Watt</Text>
            </View>
            <Text style={styles.receiptLabel}>{t.session_receipt_header}</Text>
          </View>

          {/* Station name */}
          <View style={[styles.receiptRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.receiptKey, { textAlign: align }]}>{t.session_receipt_station}</Text>
            <Text style={[styles.receiptVal, { textAlign: isRTL ? 'left' : 'right' }]} numberOfLines={1}>
              {stationName}
            </Text>
          </View>

          {/* Date & time */}
          <View style={[styles.receiptRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.receiptKey, { textAlign: align }]}>{t.session_receipt_date}</Text>
            <Text style={[styles.receiptVal, { textAlign: isRTL ? 'left' : 'right' }]}>
              {dateStr} · {timeStr}
            </Text>
          </View>

          <View style={styles.dashed} />

          {/* Energy */}
          <View style={[styles.receiptRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.receiptKey, { textAlign: align }]}>{t.session_receipt_energy}</Text>
            <Text style={[styles.receiptVal, { textAlign: isRTL ? 'left' : 'right' }]}>
              {kwhDelivered.toFixed(2)} kWh
            </Text>
          </View>

          {/* Duration */}
          <View style={[styles.receiptRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.receiptKey, { textAlign: align }]}>{t.session_receipt_duration_label}</Text>
            <Text style={[styles.receiptVal, { textAlign: isRTL ? 'left' : 'right' }]}>
              {formatDuration(durationSeconds)}
            </Text>
          </View>

          {/* Rate */}
          <View style={[styles.receiptRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.receiptKey, { textAlign: align }]}>{t.session_receipt_rate}</Text>
            <Text style={[styles.receiptVal, { textAlign: isRTL ? 'left' : 'right' }]}>
              {rate.toFixed(3)} OMR/kWh
            </Text>
          </View>

          {/* Total divider */}
          <View style={styles.solidDivider} />

          {/* Total */}
          <View style={[styles.totalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.totalKey, { textAlign: align }]}>{t.session_receipt_total}</Text>
            <Text style={[styles.totalVal, { textAlign: isRTL ? 'left' : 'right' }]}>
              {cost.toFixed(3)} OMR
            </Text>
          </View>

          <View style={styles.solidDivider} />

          {/* CO₂ row */}
          <View style={[styles.co2Row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.co2Badge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <LeafIcon size={14} color={COLORS.success} strokeWidth={2} />
              <Text style={styles.co2BadgeText}>{t.session_receipt_co2}</Text>
            </View>
            <Text style={[styles.co2Val, { textAlign: isRTL ? 'left' : 'right' }]}>
              {co2Saved.toFixed(1)} kg
            </Text>
          </View>

          {/* Tear-off decoration */}
          <View style={styles.tearOff}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={styles.tearCircle} />
            ))}
          </View>
        </View>

        {/* Bottom done button */}
        <TouchableOpacity style={styles.doneBtn} onPress={goHome} activeOpacity={0.85}>
          <HomeIcon size={18} color="#fff" strokeWidth={2.5} />
          <Text style={styles.doneBtnText}>{t.session_summary_done}</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },

  // Header
  headerSection: { alignItems: 'center', marginBottom: 24 },
  checkWrap:  { marginBottom: 16 },
  checkOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  title:    { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },

  // Receipt card
  receiptCard: {
    backgroundColor: COLORS.card, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    marginBottom: 20,
  },
  receiptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primaryBg, paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.primaryTint,
  },
  receiptBrand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  receiptBrandText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  receiptLabel:     { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  receiptKey: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  receiptVal: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },

  // Dividers
  dashed: {
    height: 1, marginHorizontal: 18, marginVertical: 2,
    borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.borderStrong,
  },
  solidDivider: { height: 1.5, backgroundColor: COLORS.borderStrong, marginHorizontal: 0 },

  // Total row
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  totalKey: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalVal: { fontSize: 22, fontWeight: '800', color: COLORS.primary, flex: 1 },

  // CO₂ row
  co2Row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.successBg,
  },
  co2Badge:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  co2BadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.success },
  co2Val:       { fontSize: 14, fontWeight: '700', color: COLORS.success, flex: 1, textAlign: 'right' },

  // Tear-off perforated edge
  tearOff: {
    flexDirection: 'row', justifyContent: 'space-evenly',
    backgroundColor: COLORS.background, paddingVertical: 0,
    paddingHorizontal: 4, paddingTop: 6,
  },
  tearCircle: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Done button
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 16,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
