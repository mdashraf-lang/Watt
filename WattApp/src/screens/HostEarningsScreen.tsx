import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function HostEarningsScreen() {
  const { profile } = useAuth();
  const { t } = useLang();

  const [balance, setBalance] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [allTimeEarnings, setAllTimeEarnings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!profile) return;
    try {
      // Get host profile balance
      const { data: profileData } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', profile.id)
        .single();
      setBalance(profileData?.wallet_balance ?? 0);

      // Month earnings
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const { data: monthTx } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', profile.id)
        .eq('type', 'earning')
        .gte('created_at', thisMonthStart.toISOString());

      setMonthEarnings(
        (monthTx ?? []).reduce((sum, tx: any) => sum + (tx.amount ?? 0), 0)
      );

      // All-time earnings
      const { data: allTx } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', profile.id)
        .eq('type', 'earning');

      setAllTimeEarnings(
        (allTx ?? []).reduce((sum, tx: any) => sum + (tx.amount ?? 0), 0)
      );

      // Recent transactions
      const { data: txList } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30);

      setTransactions((txList ?? []) as Transaction[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [profile]);

  const handleWithdraw = () => {
    Alert.alert(
      t.host_withdraw_btn,
      `Withdraw ${balance.toFixed(3)} OMR?\n\nPayment will be sent to your registered bank account within 2-3 business days.`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirm,
          onPress: () => Alert.alert('✅', 'Withdrawal request submitted!'),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        <Text style={styles.screenTitle}>{t.host_earnings_title}</Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <Text style={styles.balanceLabel}>{t.host_balance_label}</Text>
          <Text style={styles.balanceAmount}>{balance.toFixed(3)}</Text>
          <Text style={styles.balanceCurrency}>OMR</Text>
          <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} activeOpacity={0.85}>
            <Text style={styles.withdrawBtnText}>💸 {t.host_withdraw_btn}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderTopColor: COLORS.gold }]}>
            <Text style={styles.statEmoji}>📅</Text>
            <Text style={styles.statVal}>{monthEarnings.toFixed(3)}</Text>
            <Text style={styles.statLbl}>{t.host_this_month_earned}</Text>
            <Text style={styles.statUnit}>OMR</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#6366f1' }]}>
            <Text style={styles.statEmoji}>📈</Text>
            <Text style={styles.statVal}>{allTimeEarnings.toFixed(3)}</Text>
            <Text style={styles.statLbl}>{t.host_all_time_earned}</Text>
            <Text style={styles.statUnit}>OMR</Text>
          </View>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>{t.host_tx_history}</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💰</Text>
            <Text style={styles.emptyTitle}>{t.host_no_transactions}</Text>
            <Text style={styles.emptySub}>{t.host_no_transactions_sub}</Text>
          </View>
        ) : (
          transactions.map(tx => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: txBg(tx.type) }]}>
                <Text style={styles.txEmoji}>{txEmoji(tx.type)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>
                  {new Date(tx.created_at).toLocaleDateString('en-OM', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount >= 0 ? COLORS.success : COLORS.error }]}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(3)} OMR
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function txEmoji(type: string) {
  if (type === 'earning') return '⚡';
  if (type === 'withdrawal') return '💸';
  if (type === 'bonus') return '🎁';
  return '💳';
}

function txBg(type: string) {
  if (type === 'earning') return '#dcfce7';
  if (type === 'withdrawal') return '#fee2e2';
  if (type === 'bonus') return '#fef9c3';
  return '#f1f5f9';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -60,
    right: -40,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: '800', lineHeight: 52 },
  balanceCurrency: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 24 },
  withdrawBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  withdrawBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  statUnit: { fontSize: 12, color: COLORS.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  txRow: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txEmoji: { fontSize: 20 },
  txDesc: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  txDate: { fontSize: 12, color: COLORS.textSecondary },
  txAmount: { fontSize: 14, fontWeight: '700' },
});
