import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Phone'>;

export default function PhoneScreen() {
  const navigation = useNavigation<Nav>();
  const { signInWithEmail } = useAuth();
  const { t, isRTL } = useLang();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase());
      navigation.navigate('OTP', { email: email.trim().toLowerCase() });
    } catch (e: any) {
      Alert.alert(t.error, e.message || t.login_error);
    } finally {
      setLoading(false);
    }
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <View style={styles.logoSmall}>
          <Text style={styles.logoEmoji}>⚡</Text>
          <Text style={styles.logoLabel}>Watt</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { textAlign: align }]}>{t.login_title}</Text>
        <Text style={[styles.subtitle, { textAlign: align }]}>{t.login_subtitle}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={[styles.input, { textAlign: align }]}
            value={email}
            onChangeText={setEmail}
            placeholder={t.login_placeholder}
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        <Text style={[styles.hint, { textAlign: align }]}>{t.login_hint}</Text>

        <TouchableOpacity
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.login_btn}</Text>}
        </TouchableOpacity>

        <Text style={styles.terms}>
          {t.login_terms}{' '}
          <Text style={styles.termsLink}>{t.login_privacy}</Text>
          {' '}{t.login_and}{' '}
          <Text style={styles.termsLink}>{t.login_usage}</Text>
        </Text>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 32 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 12 },
  inputIcon: { fontSize: 20, marginRight: 10 },
  input: { flex: 1, paddingVertical: 18, fontSize: 16, color: COLORS.text },
  hint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 32 },
  button: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  terms: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  termsLink: { color: COLORS.primary, fontWeight: '600' },
});
