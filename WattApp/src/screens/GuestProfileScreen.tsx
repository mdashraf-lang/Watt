import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import {
  UserIcon, ZapIcon, MapPinIcon, WalletIcon,
  GlobeIcon, ChevronRightIcon,
} from '../components/icons';
import type { GuestStackParamList } from '../types';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

export default function GuestProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { t, isRTL, toggleLanguage, lang } = useLang();

  const langToggle = lang === 'ar' ? 'English' : 'عربي';

  const features = [
    { Icon: ZapIcon,      label: t.guest_feature_sessions },
    { Icon: MapPinIcon,   label: t.guest_feature_stations },
    { Icon: WalletIcon,   label: t.guest_feature_spending },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Avatar hero */}
      <View style={styles.hero}>
        <View style={styles.avatarCircle}>
          <UserIcon size={52} color={COLORS.textTertiary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.name, isRTL && styles.rtlText]}>{t.guest_profile_name}</Text>
        <Text style={[styles.tagline, isRTL && styles.rtlText]}>{t.guest_profile_tagline}</Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureCard}>
        {features.map(({ Icon, label }, i) => (
          <View
            key={i}
            style={[styles.featureRow, i < features.length - 1 && styles.featureBorder]}
          >
            <View style={styles.featureIcon}>
              <Icon size={16} color={COLORS.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.featureLabel, isRTL && styles.rtlText]}>{label}</Text>
            <ChevronRightIcon
              size={16}
              color={COLORS.borderStrong}
              strokeWidth={2}
            />
          </View>
        ))}
      </View>

      {/* Sign In */}
      <TouchableOpacity
        style={styles.signInBtn}
        onPress={() => navigation.getParent()?.navigate('SignIn')}
        activeOpacity={0.85}
      >
        <Text style={styles.signInBtnText}>{t.guest_sign_in}</Text>
      </TouchableOpacity>

      {/* Create Account */}
      <TouchableOpacity
        style={styles.signUpBtn}
        onPress={() => navigation.getParent()?.navigate('SignIn')}
        activeOpacity={0.85}
      >
        <Text style={styles.signUpBtnText}>{t.guest_create_account_short}</Text>
      </TouchableOpacity>

      {/* Language toggle */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage} activeOpacity={0.7}>
        <GlobeIcon size={15} color={COLORS.textSecondary} strokeWidth={2} />
        <Text style={styles.langBtnText}>{langToggle}</Text>
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
    paddingHorizontal: 28,
    gap: 14,
  },
  rtlText: { textAlign: 'right' },

  // Hero
  hero: { alignItems: 'center', gap: 10, marginBottom: 4 },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Features
  featureCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  featureBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  featureIcon: {
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
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  signUpBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  signUpBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },

  // Language
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginTop: 4,
  },
  langBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});
