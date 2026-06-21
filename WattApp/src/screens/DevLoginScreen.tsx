/**
 * DEV-ONLY login screen — real email + password form with tap-to-fill test credentials.
 * Delete this file and restore the normal auth flow (Splash → RoleSelect → SignIn) before production.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, StatusBar, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { supabase } from '../lib/supabase';
import {
  ZapIcon, EyeIcon, EyeOffIcon,
  UserIcon, MapPinIcon,
} from '../components/icons';
import type { GuestStackParamList } from '../types';

type Nav = NativeStackNavigationProp<GuestStackParamList>;

// ── Test accounts ─────────────────────────────────────────────

const TEST_ACCOUNTS = [
  {
    role:     'guest' as const,
    label:    'Guest',
    email:    '',
    password: '',
    desc:     'Browse map · No account needed',
    color:    '#64748B',
    bg:       '#1E293B',
    Icon:     MapPinIcon,
  },
  {
    role:     'customer' as const,
    label:    'Customer',
    email:    'customer@watt-test.com',
    password: 'Watt@test1',
    desc:     'Gold member · 25 OMR · Tesla Model 3',
    color:    '#3B82F6',
    bg:       '#1E3A5F',
    Icon:     UserIcon,
    profile: {
      full_name: 'Ahmed Al-Rashidi',
      role: 'customer',
      membership_level: 'gold',
      wallet_balance: 25.0,
      total_sessions: 12,
      total_kwh: 148,
      rating: 4.9,
      car_model: 'Tesla Model 3',
    },
  },
] as const;

// ── Auth helper ────────────────────────────────────────────────

async function ensureAndLogin(email: string, password: string) {
  // Try signing in first
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInErr) {
    // Ensure profile exists with correct data
    const account = TEST_ACCOUNTS.find(a => a.email === email);
    if (account && account.profile) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('profiles').upsert(
          { id: session.user.id, ...account.profile },
          { onConflict: 'id' },
        );
      }
    }
    return;
  }

  // Account doesn't exist yet — create it
  const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) throw signUpErr;
  if (!data.user) throw new Error('Sign up returned no user');

  const account = TEST_ACCOUNTS.find(a => a.email === email);
  if (account && account.profile) {
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      ...account.profile,
    });
    if (profileErr && profileErr.code !== '23505') throw profileErr;
  }

  // Now sign in
  const { error: finalErr } = await supabase.auth.signInWithPassword({ email, password });
  if (finalErr) throw finalErr;
}

// ── Screen ─────────────────────────────────────────────────────

export default function DevLoginScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus]   = useState(false);

  const fillAccount = (acc: typeof TEST_ACCOUNTS[number]) => {
    if (acc.role === 'guest') {
      navigation.navigate('GuestTabs');
      return;
    }
    setEmail(acc.email);
    setPassword(acc.password);
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Enter an email address or tap a test account below.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Missing password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await ensureAndLogin(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoBadge}>
              <ZapIcon size={32} color={COLORS.gold} strokeWidth={2} />
            </View>
            <Text style={styles.logoText}>WATT</Text>
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV MODE</Text>
            </View>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Text style={styles.formSub}>Enter credentials or tap a test account below</Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={[styles.inputWrap, emailFocus && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor={COLORS.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={[styles.inputWrap, styles.inputWrapRow, passFocus && styles.inputWrapFocused]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCorrect={false}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(p => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPass
                    ? <EyeOffIcon size={19} color={COLORS.textTertiary} strokeWidth={2} />
                    : <EyeIcon    size={19} color={COLORS.textTertiary} strokeWidth={2} />
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signInBtnText}>Sign In</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>TEST ACCOUNTS</Text>
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.dividerHint}>Tap any card to auto-fill credentials</Text>

          {/* Test account cards */}
          <View style={styles.accountCards}>
            {TEST_ACCOUNTS.map(acc => (
              <TouchableOpacity
                key={acc.role}
                style={[styles.accountCard, { borderColor: acc.color + '50' }]}
                onPress={() => fillAccount(acc)}
                activeOpacity={0.8}
                disabled={loading}
              >
                {/* Role colour stripe */}
                <View style={[styles.cardStripe, { backgroundColor: acc.color }]} />

                <View style={[styles.cardIconWrap, { backgroundColor: acc.bg }]}>
                  <acc.Icon size={22} color={acc.color} strokeWidth={2} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardRole, { color: acc.color }]}>{acc.label}</Text>
                    {acc.role !== 'guest' && (
                      <View style={[styles.tapBadge, { backgroundColor: acc.color + '22' }]}>
                        <Text style={[styles.tapBadgeText, { color: acc.color }]}>tap to fill</Text>
                      </View>
                    )}
                    {acc.role === 'guest' && (
                      <View style={[styles.tapBadge, { backgroundColor: acc.color + '22' }]}>
                        <Text style={[styles.tapBadgeText, { color: acc.color }]}>no login</Text>
                      </View>
                    )}
                  </View>

                  {acc.role !== 'guest' ? (
                    <>
                      <View style={styles.credRow}>
                        <Text style={styles.credKey}>Email</Text>
                        <Text style={styles.credVal}>{acc.email}</Text>
                      </View>
                      <View style={styles.credRow}>
                        <Text style={styles.credKey}>Pass</Text>
                        <Text style={[styles.credVal, { color: COLORS.gold }]}>{acc.password}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.credVal}>Browse the map without signing in</Text>
                  )}

                  <Text style={styles.cardDesc}>{acc.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.footer}>First sign-in creates the account automatically</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primaryDark },
  scroll: { paddingHorizontal: 20, paddingBottom: 36 },

  // Logo
  logoWrap: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, gap: 10 },
  logoBadge: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  logoText: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: 8 },
  devBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  devBadgeText: { fontSize: 11, fontWeight: '800', color: '#F59E0B', letterSpacing: 1.5 },

  // Form card
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24, padding: 20,
    gap: 14,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  formSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: -6 },

  // Fields
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  inputWrap: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14,
  },
  inputWrapRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOpacity: 0.15,
    shadowRadius: 6, elevation: 3,
  },
  input: { paddingVertical: 13, fontSize: 15, color: COLORS.text, flex: 1 },

  // Sign in button
  signInBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  btnDisabled: { opacity: 0.55 },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5 },
  dividerHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 14 },

  // Account cards
  accountCards: { gap: 10 },
  accountCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardStripe: { width: 4 },
  cardIconWrap: {
    width: 52, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16,
  },
  cardBody: { flex: 1, paddingVertical: 13, paddingRight: 14, paddingLeft: 10, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardRole: { fontSize: 15, fontWeight: '800' },
  tapBadge: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  tapBadgeText: { fontSize: 10, fontWeight: '700' },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  credKey: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', width: 36 },
  credVal: { fontSize: 12, color: COLORS.text, fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardDesc: { fontSize: 11, color: COLORS.textTertiary, marginTop: 3 },

  // Footer
  footer: {
    textAlign: 'center', fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 20,
  },
});
