import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLang } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import type { PayoutRequest } from '../../types';
import { ArrowLeftIcon, WalletIcon } from '../../components/icons';
import PayoutStatusBadge from '../../components/PayoutStatusBadge';

export default function AdminPayoutsScreen() {
  const { t } = useLang();
  const navigation = useNavigation<any>();

  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all' | 'processing' | 'paid' | 'failed'>('all');

  // Read-only settlement log. Payouts are sent to investors' banks
  // automatically by the disburse-payouts job — no approve/reject here.
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.payouts.list(filter === 'all' ? undefined : filter);
      setRequests((data ?? []) as PayoutRequest[]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const renderItem = ({ item }: { item: PayoutRequest }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.customer_name ?? '—'}</Text>
            {item.customer_phone ? <Text style={styles.phone}>{item.customer_phone}</Text> : null}
          </View>
          <PayoutStatusBadge status={item.status} />
        </View>

        <Text style={styles.amount}>{item.amount.toFixed(3)} OMR</Text>

        <View style={styles.bankBox}>
          <Text style={styles.bankLine}>{item.bank_name ?? '—'}</Text>
          <Text style={styles.bankLine}>{item.account_holder ?? '—'}</Text>
          <Text style={styles.bankIban}>{item.iban ?? '—'}</Text>
        </View>

        <Text style={styles.date}>{new Date(item.requested_at).toLocaleString()}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t.a11y_back}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.payout_history}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Automatic payouts — this screen is a read-only settlement log */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>{t.admin_payout_auto_note}</Text>
      </View>

      <View style={styles.tabs}>
        {(['all', 'processing', 'paid', 'failed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f === 'all' ? t.admin_payout_tab_all
                : f === 'processing' ? t.admin_payout_tab_processing
                : f === 'paid' ? t.admin_payout_tab_paid
                : t.admin_payout_tab_failed}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}><ActivityIndicator color={COLORS.primary} /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <WalletIcon size={32} color={COLORS.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>{t.admin_payout_none}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },

  infoBanner: {
    marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.primaryBg, borderWidth: 1, borderColor: COLORS.primaryTint,
  },
  infoBannerText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.border },
  tabActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },

  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  amount: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  bankBox: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  bankLine: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  bankIban: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  date: { fontSize: 11, color: COLORS.textTertiary },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  rejectBtn: { backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: '#fecaca' },
  rejectText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },
  paidBtn: { backgroundColor: COLORS.success },
  paidText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  emptyWrap: { padding: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
