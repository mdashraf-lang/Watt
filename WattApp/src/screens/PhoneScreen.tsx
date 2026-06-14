import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Phone'>;
type Route = RouteProp<RootStackParamList, 'Phone'>;

export default function PhoneScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { signInWithEmailPassword, signUpWithEmailPassword } = useAuth();
  const { t, isRTL } = useLang();
  const role = route.params.role;

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const align = isRTL ? 'right' : 'left';
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValid =
    isValidEmail &&
    password.length >= 6 &&
    (mode === 'signin' || fullName.trim().length >= 2);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmailPassword(email.trim().toLowerCase(), password, fullName.trim(), role);
      } else {
        await signInWithEmailPassword(email.trim().toLowerCase(), password);
      }
      // AppNavigator handles routing once session + profile are set
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (mode === 'signup' && msg.toLowerCase().includes('already registered')) {
        Alert.alert(
          t.error,
          'This email is already registered. Switch to Sign In.',
        );
      } else if (mode === 'signin' && msg.toLowerCase().includes('invalid')) {
        Alert.alert(t.error, t.auth_error_credentials);
      } else {
        Alert.alert(t.error, msg || t.auth_error_credentials);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <Text style={styles.headerEmoji}>{role === 'host' ? '🏠' : '🔋'}</Text>
        </View>
        <Text style={styles.headerTitle}>
          {mode === 'signup' ? t.auth_signup_title : t.auth_signin_title}
        </Text>
        <Text style={styles.headerSub}>
          {mode === 'signup' ? t.auth_signup_subtitle : t.auth_signin_subtitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full name — only for signup */}
        {mode === 'signup' && (
          <View style={styles.field}>
            <Text style={[styles.label, { textAlign: align }]}>{t.auth_name_label}</Text>
            <TextInput
              style={[styles.input, { textAlign: align }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t.auth_name_ph}
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>
        )}

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { textAlign: align }]}>Email</Text>
          <TextInput
            style={[styles.input, { textAlign: align }]}
            value={email}
            onChangeText={setEmail}
            placeholder="example@gmail.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { textAlign: align }]}>{t.auth_password_label}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { textAlign: align }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t.auth_password_ph}
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!showPassword}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              style={styles.eyeBtn}
            >
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {mode === 'signup' && (
            <Text style={styles.hint}>At least 6 characters</Text>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'signup' ? t.auth_signup_btn : t.auth_signin_btn}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle mode */}
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? t.auth_have_account : t.auth_no_account}
          </Text>
          <TouchableOpacity onPress={() => setMode(m => m === 'signup' ? 'signin' : 'signup')}>
            <Text style={styles.switchLink}>
              {' '}{mode === 'signup' ? t.auth_signin_link : t.auth_signup_link}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  back: { marginBottom: 20 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  headerBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  headerEmoji: { fontSize: 30 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  form: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: 18 },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchText: { color: COLORS.textSecondary, fontSize: 14 },
  switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
