import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';

/**
 * Reusable load-failure state: friendly message + Retry button.
 * Use whenever a screen's primary data fetch fails, instead of leaving an
 * empty list or infinite spinner (indistinguishable from "no data").
 */
export default function ErrorView({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const { t } = useLang();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.emoji}>📡</Text>
      <Text style={styles.title}>{t.error_load_title}</Text>
      <Text style={styles.msg}>{t.error_load_msg}</Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t.retry}>
        <Text style={styles.btnText}>{t.retry}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  wrapCompact: { padding: 20 },
  emoji: { fontSize: 34, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  msg:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  btn: {
    marginTop: 10, backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 11,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
