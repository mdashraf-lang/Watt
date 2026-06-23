import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GuestStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ZapIcon, EyeIcon, EyeOffIcon } from '../components/icons';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLang();
  const { signIn } = useAuth();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [emailFocus,  setEmailFocus]  = useState(false);
  const [passFocus,   setPassFocus]   = useState(false);

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert(t.error, t.auth_error_email);
      return;
    }
    if (password.length < 6) {
      Alert.alert(t.error, t.auth_error_password);
      return;
    }
    try {
      setLoading(true);
      await signIn(email.trim().toLowerCase(), password);
      // AppNavigator auto-routes on session change
    } catch {
      Alert.alert(t.error, t.auth_error_credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.heroDeco1} />
          <View style={styles.heroDeco2} />
          <View style={styles.logoBadge}>
            <ZapIcon size={34} color={COLORS.gold} strokeWidth={2} />
          </View>
          <Text style={styles.logoText}>WATT</Text>
          <Text style={styles.title}>{t.auth_signin_title}</Text>
          <Text style={styles.subtitle}>{t.auth_signin_subtitle}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_email_label}</Text>
            <View style={[styles.inputWrap, emailFocus && styles.inputWrapFocused]}>
              <TextInput
                style={styles.input}
                placeholder={t.auth_email_ph}
                placeholderTextColor={COLORS.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_password_label}</Text>
            <View style={[styles.inputWrap, styles.inputWrapRow, passFocus && styles.inputWrapFocused]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t.auth_password_ph}
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                onFocus={() => setPassFocus(true)}
                onBlur={() => setPassFocus(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPass(p => !p)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPass
                  ? <EyeOffIcon size={20} color={COLORS.textTertiary} strokeWidth={2} />
                  : <EyeIcon    size={20} color={COLORS.textTertiary} strokeWidth={2} />
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? t.auth_signing_in : t.auth_signin_btn}
            </Text>
          </TouchableOpacity>

          {/* Switch to Sign Up */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t.auth_no_account}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.switchLink}> {t.auth_signup_link}</Text>
            </TouchableOpacity>
          </View>

          {/* Browse as guest */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => navigation.navigate('GuestTabs')}
            activeOpacity={0.7}
          >
            <Text style={styles.guestBtnText}>{t.auth_browse_guest} →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingBottom: 48 },

  header: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: 64, paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center', gap: 8,
    overflow: 'hidden',
  },
  heroDeco1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -50 },
  heroDeco2: { position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  logoBadge: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  logoText: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: 8 },
  title:    { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },

  form: { paddingHorizontal: 24, paddingTop: 32, gap: 20 },

  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  inputWrap: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  inputWrapRow:     { flexDirection: 'row', alignItems: 'center' },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  input:  { paddingVertical: 15, fontSize: 15, color: COLORS.text, flex: 1 },
  eyeBtn: { paddingHorizontal: 4, paddingVertical: 15 },

  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18, paddingVertical: 17,
    alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  btnDisabled: { opacity: 0.55 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  switchText:{ color: COLORS.textSecondary, fontSize: 14 },
  switchLink:{ color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  guestBtn:     { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  guestBtnText: { fontSize: 14, color: COLORS.textTertiary, fontWeight: '500' },
});
