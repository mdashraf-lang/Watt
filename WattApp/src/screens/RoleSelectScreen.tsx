import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { ChevronRightIcon, ZapIcon, HomeIcon, BatteryChargingIcon } from '../components/icons';

const { height } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;

export default function RoleSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLang();

  const choose = (role: 'customer' | 'host') => {
    navigation.navigate('Phone', { role });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Background decorations */}
      <View style={styles.decoBig} />
      <View style={styles.decoSmall} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRing}>
          <ZapIcon size={40} color={COLORS.gold} strokeWidth={2} />
        </View>
        <Text style={styles.logo}>WATT</Text>
        <View style={styles.divider} />
        <Text style={styles.title}>{t.auth_role_title}</Text>
        <Text style={styles.subtitle}>{t.auth_role_subtitle}</Text>
      </View>

      {/* Role cards */}
      <View style={styles.cards}>
        {/* Customer card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.88}
          onPress={() => choose('customer')}
        >
          <View style={styles.cardTop}>
            <View style={[styles.cardIconWrap, { backgroundColor: COLORS.primaryBg }]}>
              <BatteryChargingIcon size={28} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View style={[styles.cardBadge, { backgroundColor: COLORS.primaryBg }]}>
              <Text style={[styles.cardBadgeText, { color: COLORS.primary }]}>Customer</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{t.auth_role_customer_title}</Text>
          <Text style={styles.cardSub}>{t.auth_role_customer_sub}</Text>
          <View style={[styles.cardAction, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.cardActionText}>{t.auth_role_customer_title}</Text>
            <ChevronRightIcon size={16} color="#fff" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* Host card */}
        <TouchableOpacity
          style={[styles.card, styles.cardHost]}
          activeOpacity={0.88}
          onPress={() => choose('host')}
        >
          <View style={styles.cardTop}>
            <View style={[styles.cardIconWrap, { backgroundColor: COLORS.goldBg }]}>
              <HomeIcon size={28} color={COLORS.goldDark} strokeWidth={2} />
            </View>
            <View style={[styles.cardBadge, { backgroundColor: COLORS.goldBg, borderColor: COLORS.gold }]}>
              <Text style={[styles.cardBadgeText, { color: COLORS.goldLight }]}>Host</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{t.auth_role_host_title}</Text>
          <Text style={styles.cardSub}>{t.auth_role_host_sub}</Text>
          <View style={[styles.cardAction, { backgroundColor: COLORS.goldDark }]}>
            <Text style={[styles.cardActionText, { color: '#fff' }]}>{t.auth_role_host_title}</Text>
            <ChevronRightIcon size={16} color="#fff" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>© 2025 Watt — Oman</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  decoBig: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(16,185,129,0.1)',
    top: -120,
    right: -120,
  },
  decoSmall: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 60,
    left: -80,
  },
  header: {
    alignItems: 'center',
    paddingTop: height > 700 ? 72 : 52,
    paddingBottom: 32,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },
  cards: {
    width: '100%',
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    gap: 10,
  },
  cardHost: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 11,
    marginTop: 4,
  },
  cardActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
});
