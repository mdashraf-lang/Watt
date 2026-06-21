import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, BatteryChargingIcon, HomeIcon } from '../components/icons';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;
type Route = RouteProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLang();
  const { signIn } = useAuth();
  const role = route.params?.role ?? 'customer';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleSignIn = async () => {
    if (!phone.trim()) {
      Alert.alert(t.error, t.auth_error_phone);
      return;
    }
    if (password.length < 6) {
      Alert.alert(t.error, t.auth_error_password);
      return;
    }
    try {
      setLoading(true);
      await signIn(phone.trim(), password);
    } catch {
      Alert.alert(t.error, t.auth_error_credentials);
    } finally {
      setLoading(false);
    }
  };

  const isHost = role === 'host';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[styles.header, isHost && styles.headerHost]}>
          {/* Background decoration */}
          <View style={styles.headerDeco1} />
          <View style={styles.headerDeco2} />

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <ArrowLeftIcon size={22} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={[styles.headerBadge, isHost && styles.headerBadgeHost]}>
            {isHost
              ? <HomeIcon size={32} color={COLORS.gold} strokeWidth={1.8} />
              : <BatteryChargingIcon size={32} color={COLORS.primaryLight} strokeWidth={1.8} />
            }
          </View>
          <Text style={styles.title}>{t.auth_signin_title}</Text>
          <Text style={styles.subtitle}>{t.auth_signin_subtitle}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_phone_label}</Text>
            <View style={[styles.inputWrap, phoneFocused && styles.inputWrapFocused]}>
              <TextInput
                style={styles.input}
                placeholder={t.auth_phone_ph}
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoCorrect={false}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_password_label}</Text>
            <View style={[styles.inputWrap, styles.inputWrapRow, passFocused && styles.inputWrapFocused]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t.auth_password_ph}
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword
                  ? <EyeOffIcon size={20} color={COLORS.textTertiary} />
                  : <EyeIcon size={20} color={COLORS.textTertiary} />
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign in button */}
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

          {/* Switch to sign up */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t.auth_no_account}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp', { role })}>
              <Text style={styles.switchLink}> {t.auth_signup_link}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingBottom: 48 },

  // Header
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  headerHost: { backgroundColor: '#1a1400' },
  headerDeco1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -40,
  },
  headerDeco2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -20,
    left: 20,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  headerBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headerBadgeHost: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderColor: 'rgba(212,175,55,0.3)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },

  // Form
  form: {
    paddingHorizontal: 24,
    paddingTop: 36,
    gap: 20,
  },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  inputWrap: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  inputWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  input: {
    paddingVertical: 15,
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
  },
  eyeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 15,
  },

  // Button
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  switchText: { color: COLORS.textSecondary, fontSize: 14 },
  switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
