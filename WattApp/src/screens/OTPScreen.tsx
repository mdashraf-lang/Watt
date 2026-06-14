import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OTP'>;
type Route = RouteProp<RootStackParamList, 'OTP'>;
const OTP_LENGTH = 6;

export default function OTPScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { email, role, fullName } = route.params;
  const { verifyEmailOTP, signInWithEmail } = useAuth();
  const { t } = useLang();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every(d => d !== '')) verifyCode(next.join(''));
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (code: string) => {
    setLoading(true);
    try {
      await verifyEmailOTP(email, code, fullName, role);
      // AppNavigator handles routing once session + profile are set
    } catch (e: any) {
      Alert.alert(t.otp_wrong_code, e.message || t.otp_wrong_code_msg);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await signInWithEmail(email);
      setResendCountdown(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch (e: any) {
      Alert.alert(t.otp_error, e.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.logoSmall}>
          <Text style={styles.logoEmoji}>⚡</Text>
          <Text style={styles.logoLabel}>Watt</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>✉️</Text>
        </View>
        <Text style={styles.title}>{t.otp_title}</Text>
        <Text style={styles.subtitle}>
          {t.otp_subtitle}{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={t => handleChange(t, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.verifyingText}>{t.otp_verifying}</Text>
          </View>
        )}

        <View style={styles.resendRow}>
          {resendCountdown > 0 ? (
            <Text style={styles.resendTimer}>
              {t.otp_resend_after}{' '}
              <Text style={styles.timerNum}>{resendCountdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendBtn}>{t.otp_resend_btn}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  backText: { fontSize: 20, color: COLORS.text },
  logoSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoEmoji: { fontSize: 22 },
  logoLabel: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconEmoji: { fontSize: 40 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  emailHighlight: { fontWeight: '700', color: COLORS.primary },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  otpBox: { width: 48, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card, fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  verifyingText: { color: COLORS.textSecondary, fontSize: 14 },
  resendRow: { alignItems: 'center', marginTop: 8 },
  resendTimer: { fontSize: 14, color: COLORS.textSecondary },
  timerNum: { fontWeight: '700', color: COLORS.text },
  resendBtn: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
});
