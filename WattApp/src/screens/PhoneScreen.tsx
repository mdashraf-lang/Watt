import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Phone'>;

export default function PhoneScreen() {
  const navigation = useNavigation<Nav>();
  const { signInWithPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const fullPhone = `+968${phone.replace(/\s/g, '')}`;
  const isValid = phone.replace(/\s/g, '').length === 8;

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await signInWithPhone(fullPhone);
      navigation.navigate('OTP', { phone: fullPhone });
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إرسال رمز التحقق، تحقق من رقم الهاتف');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      {/* Header */}
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
        <Text style={styles.title}>تسجيل الدخول</Text>
        <Text style={styles.subtitle}>أدخل رقم هاتفك لاستقبال رمز التحقق</Text>

        {/* Phone Input */}
        <View style={styles.inputContainer}>
          <View style={styles.prefix}>
            <Text style={styles.flag}>🇴🇲</Text>
            <Text style={styles.prefixText}>+968</Text>
          </View>
          <View style={styles.divider} />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={t => setPhone(formatPhone(t))}
            placeholder="9123 4567"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
            maxLength={9}
            autoFocus
          />
        </View>

        <Text style={styles.hint}>سيتم إرسال رمز التحقق عبر رسالة SMS</Text>

        <TouchableOpacity
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>إرسال الرمز</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          بالمتابعة، أنت توافق على{' '}
          <Text style={styles.termsLink}>سياسة الخصوصية</Text>
          {' '}و{' '}
          <Text style={styles.termsLink}>شروط الاستخدام</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backText: { fontSize: 20, color: COLORS.text },
  logoSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoEmoji: { fontSize: 22 },
  logoLabel: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, textAlign: 'right', marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'right', marginBottom: 32 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  prefix: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 18,
    backgroundColor: '#f8fafc',
  },
  flag: { fontSize: 20 },
  prefixText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  divider: { width: 1, height: 32, backgroundColor: COLORS.border },
  input: {
    flex: 1, paddingHorizontal: 16, fontSize: 18,
    color: COLORS.text, letterSpacing: 2,
  },
  hint: {
    fontSize: 13, color: COLORS.textSecondary,
    textAlign: 'right', marginBottom: 32,
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  terms: {
    fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18,
  },
  termsLink: { color: COLORS.primary, fontWeight: '600' },
});
