import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';

// Single source of truth for payout-request status colors and labels,
// shared by the investor Earnings screen and the admin Payouts screen.
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:    { color: COLORS.warning, bg: COLORS.warningBg },
  processing: { color: COLORS.warning, bg: COLORS.warningBg },
  paid:       { color: COLORS.success, bg: COLORS.successBg },
  rejected:   { color: COLORS.error,   bg: COLORS.errorBg },
  failed:     { color: COLORS.error,   bg: COLORS.errorBg },
};

export default function PayoutStatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const label =
    status === 'paid'       ? t.payout_status_paid :
    status === 'rejected'   ? t.payout_status_rejected :
    status === 'failed'     ? t.payout_status_failed :
    status === 'processing' ? t.payout_status_processing :
    t.payout_status_pending;
  return (
    <View style={[styles.badge, { backgroundColor: st.bg }]}>
      <Text style={[styles.text, { color: st.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  text:  { fontSize: 12, fontWeight: '700' },
});
