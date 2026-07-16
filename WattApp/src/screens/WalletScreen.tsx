import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { WalletTransaction } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import {
  WalletIcon, PlusIcon, XIcon, CheckIcon,
  ArrowUpIcon, ZapIcon, RotateCcwIcon, GiftIcon, CreditCardIcon,
} from '../components/icons';
import ErrorView from '../components/ErrorView';

const TOP_UP_AMOUNTS = [5, 10, 20, 50];

const TX_ICON_COMPONENT: Record<string, React.ComponentType<any>> = {
  topup: ArrowUpIcon,
  charge: ZapIcon,
  refund: RotateCcwIcon,
  bonus: GiftIcon,
};
const TX_ICON_COLOR: Record<string, string> = {
  topup: COLORS.success,
  charge: COLORS.error,
  refund: '#3b82f6',
  bonus: COLORS.gold,
};
const TX_ICON_BG: Record<string, string> = {
  topup: COLORS.successBg,
  charge: COLORS.errorBg,
  refund: '#eff6ff',
  bonus: COLORS.goldBg,
};

export default function WalletScreen() {
  const { t } = useLang();
  const TX_LABEL: Record<string, string> = {
    topup: t.wallet_tx_topup,
    charge: t.wallet_tx_charge,
    refund: t.wallet_tx_refund,
    bonus: t.wallet_tx_bonus,
  };
  const { profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'topup' | 'charge' | 'refund' | 'bonus'>('all');

  useEffect(() => { fetchTransactions(); }, [profile?.id]);

  const fetchTransactions = async () => {
    if (!profile) return;   // wait until the profile loads; effect re-runs on profile.id
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setTransactions(data as WalletTransaction[]);
      setLoadError(!!error && !data);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (!profile) return;
    setTopUpLoading(true);
    try {
      // 1. Create a Thawani checkout session on the server
      const { data: created, error: createErr } = await supabase.functions.invoke('thawani-checkout', {
        body: { action: 'create', amount: selectedAmount },
      });
      if (createErr || !created?.pay_url) {
        throw new Error(created?.error ?? createErr?.message ?? t.wallet_payment_error);
      }

      // 2. Open Thawani's hosted payment page; returns on the watt:// redirect
      const result = await WebBrowser.openAuthSessionAsync(created.pay_url, 'watt://wallet');
      if (result.type !== 'success' && result.type !== 'dismiss') {
        setTopUpLoading(false);
        return; // user backed out before paying
      }

      // 3. Verify with Thawani and credit the wallet only if actually paid
      const { data: verified, error: verifyErr } = await supabase.functions.invoke('thawani-checkout', {
        body: { action: 'verify', session_id: created.session_id },
      });
      if (verifyErr) throw new Error(verifyErr.message);

      await refreshProfile();
      await fetchTransactions();

      if (verified?.status === 'paid') {
        setShowTopUp(false);
        Alert.alert(t.wallet_success_title, `${t.wallet_success_msg} ${selectedAmount} ${t.wallet_success_suffix}`);
      } else {
        Alert.alert(t.wallet_pending_title, t.wallet_pending_msg);
      }
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? t.wallet_payment_error);
    } finally {
      setTopUpLoading(false);
    }
  };

  const renderTransaction = useCallback(({ item }: { item: WalletTransaction }) => {
    const isDebit = item.type === 'charge';
    const IconComp = TX_ICON_COMPONENT[item.type] ?? WalletIcon;
    const iconColor = TX_ICON_COLOR[item.type] ?? COLORS.primary;
    const iconBg = TX_ICON_BG[item.type] ?? COLORS.primaryBg;
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIconBox, { backgroundColor: iconBg }]}>
          <IconComp size={20} color={iconColor} strokeWidth={2} />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txTitle}>{TX_LABEL[item.type]}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>
            {new Date(item.created_at).toLocaleDateString('ar-OM')} · {new Date(item.created_at).toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: isDebit ? COLORS.error : COLORS.success }]}>
            {isDebit ? '-' : '+'}{Math.abs(item.amount).toFixed(3)}
          </Text>
          <Text style={styles.txBalance}>{item.balance_after.toFixed(3)} OMR</Text>
        </View>
      </View>
    );
  }, []);

  const totalSpent = transactions
    .filter(tx => tx.type === 'charge')
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        {/* Decorative elements */}
        <View style={styles.balanceDeco1} />
        <View style={styles.balanceDeco2} />

        <View style={styles.balanceTop}>
          <View style={styles.walletIconWrap}>
            <WalletIcon size={20} color="rgba(255,255,255,0.8)" strokeWidth={2} />
          </View>
          <Text style={styles.balanceLabel}>{t.wallet_balance_label}</Text>
        </View>

        <Text style={[styles.balanceAmount, (profile?.wallet_balance ?? 0) < 0 && { color: '#fca5a5' }]}>
          {profile?.wallet_balance.toFixed(3) ?? '0.000'}
        </Text>
        <Text style={styles.balanceCurrency}>OMR</Text>

        <TouchableOpacity style={styles.topUpBtn} onPress={() => setShowTopUp(true)} activeOpacity={0.85}>
          <PlusIcon size={16} color="#0F172A" strokeWidth={2.5} />
          <Text style={styles.topUpBtnText}>{t.wallet_top_up_clean}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_sessions ?? 0}</Text>
          <Text style={styles.statLabel}>{t.wallet_sessions}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_kwh?.toFixed(0) ?? 0}</Text>
          <Text style={styles.statLabel}>{t.wallet_total_kwh}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSpent.toFixed(2)}</Text>
          <Text style={styles.statLabel}>{t.wallet_spent}</Text>
        </View>
      </View>

      {/* Transactions */}
      <View style={styles.txSection}>
        <View style={styles.txHeader}>
          <Text style={styles.txSectionTitle}>{t.wallet_tx_title}</Text>
          <Text style={styles.txCount}>{transactions.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.txFilterRow} style={{ maxHeight: 44, marginBottom: 8 }}>
          {(['all', 'topup', 'charge', 'refund', 'bonus'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.txFilterChip, txFilter === f && styles.txFilterChipActive]}
              onPress={() => setTxFilter(f)}
            >
              <Text style={[styles.txFilterText, txFilter === f && styles.txFilterTextActive]}>
                {f === 'all' ? t.wallet_tx_all ?? 'All' : f === 'topup' ? t.wallet_tx_topup : f === 'charge' ? t.wallet_tx_charge : f === 'refund' ? t.wallet_tx_refund : t.wallet_tx_bonus}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : loadError ? (
          <ErrorView onRetry={fetchTransactions} />
        ) : transactions.filter(tx => txFilter === 'all' || tx.type === txFilter).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <WalletIcon size={32} color={COLORS.textTertiary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>{t.wallet_empty_title}</Text>
            <Text style={styles.emptySub}>{t.wallet_empty_sub}</Text>
          </View>
        ) : (
          <FlatList
            data={transactions.filter(tx => txFilter === 'all' || tx.type === txFilter)}
            keyExtractor={item => item.id}
            renderItem={renderTransaction}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 32 }}
          />
        )}
      </View>

      {/* Top Up Modal */}
      <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={() => setShowTopUp(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTopUp(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) + 8 }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{t.wallet_modal_title}</Text>
              <TouchableOpacity onPress={() => setShowTopUp(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <XIcon size={20} color={COLORS.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{t.wallet_modal_sub}</Text>

            {/* Amount selection */}
            <View style={styles.amountsGrid}>
              {TOP_UP_AMOUNTS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.amountChip, a === selectedAmount && styles.amountChipActive]}
                  onPress={() => setSelectedAmount(a)}
                >
                  {a === selectedAmount && (
                    <CheckIcon size={14} color={COLORS.primary} strokeWidth={2.5} />
                  )}
                  <Text style={[styles.amountText, a === selectedAmount && styles.amountTextActive]}>
                    {a} OMR
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t.wallet_current}</Text>
                <Text style={styles.summaryValue}>{profile?.wallet_balance.toFixed(3)} OMR</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t.wallet_adding}</Text>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>+{selectedAmount} OMR</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>{t.wallet_new}</Text>
                <Text style={styles.summaryTotalValue}>
                  {((profile?.wallet_balance ?? 0) + selectedAmount).toFixed(3)} OMR
                </Text>
              </View>
            </View>

            {/* Payment method */}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{t.wallet_payment_via}</Text>
              <View style={styles.paymentBadge}>
                <CreditCardIcon size={14} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.paymentText}>Thawani Pay</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, topUpLoading && styles.confirmBtnDisabled]}
              onPress={handleTopUp}
              disabled={topUpLoading}
              activeOpacity={0.85}
            >
              {topUpLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>{t.wallet_confirm_btn} · {selectedAmount} OMR</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Balance card
  balanceCard: {
    backgroundColor: COLORS.primaryDark,
    margin: 16,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  balanceDeco1: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(16,185,129,0.15)',
    top: -70, right: -70,
  },
  balanceDeco2: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -40, left: -30,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  walletIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  balanceAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 60,
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    fontWeight: '600',
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: COLORS.goldDark,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  topUpBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  // Transactions
  txSection: { flex: 1, paddingHorizontal: 16 },
  txFilterRow: { gap: 8, paddingBottom: 2 },
  txFilterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.border },
  txFilterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  txFilterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  txFilterTextActive: { color: '#fff' },
  txHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  txSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  txCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txIconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  txIcon: { fontSize: 20 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  txDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  txDate: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txBalance: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 44,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  amountsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  amountChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
  },
  amountChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryBg,
  },
  amountText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  amountTextActive: { color: COLORS.primary },

  // Summary
  summaryBox: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  summaryTotal: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 2,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },

  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  paymentLabel: { fontSize: 13, color: COLORS.textSecondary },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paymentText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnDisabled: { opacity: 0.55 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
