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

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;
type Route = RouteProp<RootStackParamList, 'SignUp'>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLang();
  const { signUp } = useAuth();
  const role = route.params?.role ?? 'customer';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert(t.error, t.auth_error_name);
      return;
    }
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
      await signUp(phone.trim(), password, fullName.trim(), role);
      // Navigation handled by AppNavigator when session changes
    } catch (e: any) {
      Alert.alert(t.error, e?.message ?? t.auth_error_credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Text style={styles.headerEmoji}>{role === 'host' ? '🏠' : '🔋'}</Text>
          </View>
          <Text style={styles.title}>{t.auth_signup_title}</Text>
          <Text style={styles.subtitle}>{t.auth_signup_subtitle}</Text>
        </View>

        <View style={styles.form}>
          {role === 'host' && (
            <View style={styles.roleBanner}>
              <Text style={styles.roleBannerText}>🏠 {t.auth_role_host_sub}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_name_label}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.auth_name_ph}
              placeholderTextColor={COLORS.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_phone_label}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.auth_phone_ph}
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.auth_password_label}</Text>
            <View>
              <TextInput
                style={styles.input}
                placeholder={t.auth_password_ph}
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? t.auth_signing_up : (role === 'host' ? t.splash_next : t.auth_signup_btn)}
            </Text>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t.auth_have_account}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn', { role })}>
              <Text style={styles.switchLink}> {t.auth_signin_link}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingBottom: 40 },
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerEmoji: { fontSize: 30 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  form: { paddingHorizontal: 24, paddingTop: 28, gap: 20 },
  roleBanner: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  roleBannerText: { color: '#78350f', fontSize: 13, fontWeight: '600' },
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
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: 18 },
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
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  switchText: { color: COLORS.textSecondary, fontSize: 14 },
  switchLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
