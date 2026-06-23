import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { CalendarIcon, WalletIcon, LockIcon, ZapIcon, ChevronRightIcon } from '../components/icons';
import type { GuestTabParamList } from '../types';

type BookingsRoute = RouteProp<GuestTabParamList, 'GuestBookings'>;
type WalletRoute   = RouteProp<GuestTabParamList, 'GuestWallet'>;

export default function GuestLockedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<BookingsRoute | WalletRoute>();
  const { t, isRTL } = useLang();

  const feature    = (route.params as { feature: 'bookings' | 'wallet' })?.feature ?? 'bookings';
  const isBookings = feature === 'bookings';
  const MainIcon   = isBookings ? CalendarIcon : WalletIcon;

  const subtitle = isBookings ? t.guest_locked_bookings_sub : t.guest_locked_wallet_sub;

  const features = isBookings
    ? [
        { Icon: CalendarIcon,    label: t.guest_feature_bookings_1 },
        { Icon: ZapIcon,         label: t.guest_feature_bookings_2 },
        { Icon: ChevronRightIcon, label: t.guest_feature_bookings_3 },
      ]
    : [
        { Icon: WalletIcon,      label: t.guest_feature_wallet_1 },
        { Icon: ZapIcon,         label: t.guest_feature_wallet_2 },
        { Icon: ChevronRightIcon, label: t.guest_feature_wallet_3 },
      ];

  return (
    <SafeAreaView style={[styles.root, isRTL && styles.rtl]} edges={['top', 'bottom']}>
      {/* Icon + lock badge */}
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <MainIcon size={48} color={COLORS.primary} strokeWidth={1.5} />
        </View>
        <View style={styles.lockBadge}>
          <LockIcon size={14} color="#fff" strokeWidth={2.5} />
        </View>
      </View>

      <Text style={[styles.title, isRTL && styles.rtlText]}>{t.guest_locked_title}</Text>
      <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{subtitle}</Text>

      {/* Feature preview */}
      <View style={styles.featureList}>
        {features.map(({ Icon, label }, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Icon size={16} color={COLORS.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.featureLabel, isRTL && styles.rtlText]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.signInBtn}
        onPress={() => navigation.getParent()?.navigate('SignIn')}
        activeOpacity={0.85}
      >
        <Text style={styles.signInBtnText}>{t.guest_sign_in}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signUpBtn}
        onPress={() => navigation.getParent()?.navigate('SignIn')}
        activeOpacity={0.85}
      >
        <Text style={styles.signUpBtnText}>{t.guest_create_account}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  rtl: {},
  rtlText: { textAlign: 'right' },

  // Icon
  iconWrap: { position: 'relative', marginBottom: 8 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primaryTint,
  },
  lockBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Features
  featureList: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Buttons
  signInBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  signInBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  signUpBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  signUpBtnText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
