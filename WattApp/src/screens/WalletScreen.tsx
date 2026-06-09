import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WalletTransaction } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';

const TOP_UP_AMOUNTS = [5, 10, 20, 50];

const TX_ICON: Record<string, string> = {
  topup: '⬆️', charge: '⚡', refund: '↩️', bonus: '🎁',
};
const TX_LABEL: Record<string, string> = {
  topup: 'شحن رصيد', charge: 'شحن سيارة', refund: 'استرداد', bonus: 'مكافأة',
};

export default function WalletScreen() {
  const { profile, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [topUpLoading, setTopUpLoading] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setTransactions(data as WalletTransaction[]);
    setLoading(false);
  };

  const handleTopUp = async () => {
    if (!profile) return;
    setTopUpLoading(true);
    try {
      const newBalance = profile.wallet_balance + selectedAmount;
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', profile.id);
      await supabase.from('wallet_transactions').insert({
        user_id: profile.id,
        type: 'topup',
        amount: selectedAmount,
        balance_after: newBalance,
        description: `شحن رصيد - ${selectedAmount} OMR`,
        payment_method: 'thawani',
      });
      await refreshProfile();
      await fetchTransactions();
      setShowTopUp(false);
      Alert.alert('تم الشحن', `تم إضافة ${selectedAmount} OMR إلى محفظتك بنجاح ✅`);
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    } finally {
      setTopUpLoading(false);
    }
  };

  const renderTransaction = useCallback(({ item }: { item: WalletTransaction }) => {
    const isDebit = item.type === 'charge';
    return (
      <View style={styles.txCard}>
        <View style={styles.txIconBox}>
          <Text style={styles.txIcon}>{TX_ICON[item.type]}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txTitle}>{TX_LABEL[item.type]}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{new Date(item.created_at).toLocaleDateString('ar-OM')} · {new Date(item.created_at).toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>رصيد المحفظة</Text>
        <Text style={styles.balanceAmount}>{profile?.wallet_balance.toFixed(3) ?? '0.000'}</Text>
        <Text style={styles.balanceCurrency}>OMR</Text>
        <TouchableOpacity style={styles.topUpBtn} onPress={() => setShowTopUp(true)} activeOpacity={0.85}>
          <Text style={styles.topUpBtnText}>⬆️ شحن الرصيد</Text>
        </TouchableOpacity>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_sessions ?? 0}</Text>
          <Text style={styles.statLabel}>جلسات الشحن</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_kwh?.toFixed(0) ?? 0}</Text>
          <Text style={styles.statLabel}>kWh إجمالي</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {transactions.filter(t => t.type === 'charge').reduce((s, t) => s + Math.abs(t.amount), 0).toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>OMR أنفق</Text>
        </View>
      </View>

      {/* Transactions */}
      <View style={styles.txSection}>
        <Text style={styles.txSectionTitle}>سجل المعاملات</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyText}>لا توجد معاملات بعد</Text>
            <Text style={styles.emptySub}>ابدأ بشحن سيارتك لرؤية سجل المعاملات</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>شحن الرصيد</Text>
            <Text style={styles.modalSub}>اختر المبلغ المراد إضافته</Text>

            <View style={styles.amountsGrid}>
              {TOP_UP_AMOUNTS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.amountChip, a === selectedAmount && styles.amountChipActive]}
                  onPress={() => setSelectedAmount(a)}
                >
                  <Text style={[styles.amountText, a === selectedAmount && styles.amountTextActive]}>{a} OMR</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryLabel}>الرصيد الحالي</Text>
              <Text style={styles.modalSummaryValue}>{profile?.wallet_balance.toFixed(3)} OMR</Text>
            </View>
            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryLabel}>المبلغ المضاف</Text>
              <Text style={[styles.modalSummaryValue, { color: COLORS.success }]}>+{selectedAmount} OMR</Text>
            </View>
            <View style={[styles.modalSummary, styles.modalTotal]}>
              <Text style={styles.modalTotalLabel}>الرصيد الجديد</Text>
              <Text style={styles.modalTotalValue}>{((profile?.wallet_balance ?? 0) + selectedAmount).toFixed(3)} OMR</Text>
            </View>

            <Text style={styles.paymentLabel}>الدفع عبر</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentText}>💳 Thawani Pay</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, topUpLoading && styles.confirmBtnDisabled]}
              onPress={handleTopUp}
              disabled={topUpLoading}
              activeOpacity={0.85}
            >
              {topUpLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.confirmBtnText}>تأكيد الشحن · {selectedAmount} OMR</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  balanceCard: {
    backgroundColor: COLORS.primary, margin: 16, borderRadius: 24, padding: 24, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 8 },
  balanceAmount: { fontSize: 52, fontWeight: '800', color: '#fff', lineHeight: 60 },
  balanceCurrency: { fontSize: 18, color: 'rgba(255,255,255,0.75)', marginBottom: 20 },
  topUpBtn: {
    backgroundColor: COLORS.gold, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24,
  },
  topUpBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16,
    marginHorizontal: 16, marginBottom: 8, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  txSection: { flex: 1, paddingHorizontal: 16 },
  txSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  txCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 14, padding: 12, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  txIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  txIcon: { fontSize: 20 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  txDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  txDate: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txBalance: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'right', marginBottom: 4 },
  modalSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'right', marginBottom: 20 },
  amountsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  amountChip: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  amountChipActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  amountText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  amountTextActive: { color: COLORS.primary },
  modalSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  modalSummaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  modalSummaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 12 },
  modalTotalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  modalTotalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  paymentLabel: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'right', marginTop: 12, marginBottom: 6 },
  paymentBadge: { alignSelf: 'flex-end', backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20 },
  paymentText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
