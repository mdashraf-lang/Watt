import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;

export default function RoleSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLang();

  const choose = (role: 'customer' | 'host') => {
    navigation.navigate('SignIn', { role });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>⚡</Text>
        </View>
        <Text style={styles.logo}>WATT</Text>
        <Text style={styles.title}>{t.auth_role_title}</Text>
        <Text style={styles.subtitle}>{t.auth_role_subtitle}</Text>
      </View>

      <View style={styles.cards}>
        {/* Customer card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.88}
          onPress={() => choose('customer')}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#e0f2fe' }]}>
            <Text style={styles.cardEmoji}>🔋</Text>
          </View>
          <Text style={styles.cardTitle}>{t.auth_role_customer_title}</Text>
          <Text style={styles.cardSub}>{t.auth_role_customer_sub}</Text>
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Host card */}
        <TouchableOpacity
          style={[styles.card, styles.cardHost]}
          activeOpacity={0.88}
          onPress={() => choose('host')}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#fef9c3' }]}>
            <Text style={styles.cardEmoji}>🏠</Text>
          </View>
          <Text style={styles.cardTitle}>{t.auth_role_host_title}</Text>
          <Text style={styles.cardSub}>{t.auth_role_host_sub}</Text>
          <View style={[styles.cardArrow, { backgroundColor: COLORS.gold }]}>
            <Text style={[styles.cardArrowText, { color: '#0F172A' }]}>→</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>© 2025 Watt EV — Oman</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 40,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: { fontSize: 36 },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 6,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  cards: {
    width: '100%',
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHost: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardEmoji: { fontSize: 28 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardArrow: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardArrowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
});
