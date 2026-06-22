import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TouchableOpacity, View, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import type { WalletTransaction } from '../../types';
import { ZapIcon, TrendingUpIcon, WalletIcon } from '../../components/icons';

const TX_ICON: Record<string, string> = {
  topup: '⬆️', charge: '⚡', refund: '↩️', bonus: '🎁',
};

export default function InvestorEarningsScreen() {
  const { profile } = useAuth();
  const { t } = useLang();

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading]           = useState(true);

  const fetchTx = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions((data ?? []) as WalletTransaction[]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const thisMonthTotal = transactions
    .filter(tx => {
      const d = new Date(tx.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        && (tx.type === 'bonus' || tx.type === 'topup');
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const allTimeTotal = transactions
    .filter(tx => tx.type === 'bonus' || tx.type === 'topup')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.inv_earnings_title}</Text>
        <View style={styles.headerIcon}>
          <TrendingUpIcon size={22} color={COLORS.gold} strokeWidth={2} />
        </View>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Balance card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceDeco1} />
              <View style={styles.balanceDeco2} />
              <Text style={styles.balanceLabel}>{t.inv_earnings_balance}</Text>
              <Text style={styles.balanceAmount}>{profile?.wallet_balance.toFixed(3) ?? '0.000'}</Text>
              <Text style={styles.balanceCurrency}>OMR</Text>
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => Alert.alert('Coming Soon', 'Withdrawal feature coming in next update.')}
                activeOpacity={0.85}
              >
                <Text style={styles.withdrawBtnText}>{t.inv_earnings_withdraw}</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <TrendingUpIcon size={18} color={COLORS.gold} strokeWidth={2} />
                <Text style={styles.statValue}>{thisMonthTotal.toFixed(3)}</Text>
                <Text style={styles.statLabel}>{t.inv_earnings_this_month} (OMR)</Text>
              </View>
              <View style={styles.statCard}>
                <WalletIcon size={18} color={COLORS.primary} strokeWidth={2} />
                <Text style={[styles.statValue, { color: COLORS.primary }]}>{allTimeTotal.toFixed(3)}</Text>
                <Text style={styles.statLabel}>{t.inv_earnings_all_time} (OMR)</Text>
              </View>
            </View>

            {/* Coming soon banner */}
            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonEmoji}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.comingSoonTitle}>{t.inv_earnings_coming_soon}</Text>
                <Text style={styles.comingSoonSub}>{t.inv_earnings_coming_soon_sub}</Text>
              </View>
            </View>

            {/* TX header */}
            <View style={styles.txHeader}>
              <Text style={styles.txHeaderText}>{t.inv_earnings_tx_title}</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <WalletIcon size={32} color={COLORS.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>{t.wallet_empty_title}</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={[styles.txIconWrap, item.amount > 0 ? styles.txIconPlus : styles.txIconMinus]}>
              <Text style={styles.txEmoji}>{TX_ICON[item.type] ?? '💳'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txDesc}>{item.description}</Text>
              <Text style={styles.txDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmount, item.amount > 0 ? styles.txPos : styles.txNeg]}>
                {item.amount > 0 ? '+' : ''}{item.amount.toFixed(3)} OMR
              </Text>
              <Text style={styles.txBalance}>{item.balance_after.toFixed(3)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerIcon:  { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },

  // Balance card
  balanceCard: {
    margin: 16, borderRadius: 24, padding: 24,
    backgroundColor: COLORS.primaryDark, alignItems: 'center',
    overflow: 'hidden', gap: 4,
  },
  balanceDeco1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40 },
  balanceDeco2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  balanceLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginBottom: 4 },
  balanceAmount: { fontSize: 46, fontWeight: '900', color: '#fff' },
  balanceCurrency: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  withdrawBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 28, paddingVertical: 11, borderRadius: 14 },
  withdrawBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 18, padding: 16,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.gold },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },

  // Coming soon
  comingSoonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: COLORS.goldBg, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.goldTint,
  },
  comingSoonEmoji: { fontSize: 28 },
  comingSoonTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  comingSoonSub:   { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  // Tx header
  txHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  txHeaderText: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7 },

  loadingWrap: { padding: 40, alignItems: 'center' },
  emptyWrap:   { padding: 40, alignItems: 'center', gap: 10 },
  emptyText:   { fontSize: 14, color: COLORS.textSecondary },

  // Tx rows
  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  txIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txIconPlus: { backgroundColor: COLORS.successBg },
  txIconMinus:{ backgroundColor: COLORS.errorBg },
  txEmoji:    { fontSize: 18 },
  txDesc:     { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  txDate:     { fontSize: 11, color: COLORS.textTertiary },
  txRight:    { alignItems: 'flex-end' },
  txAmount:   { fontSize: 14, fontWeight: '800' },
  txPos:      { color: COLORS.success },
  txNeg:      { color: COLORS.error },
  txBalance:  { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
});
