import React, { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AdminStackParamList, AdminCustomer } from '../../types';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import {
  ArrowLeftIcon, MailIcon, PhoneIcon, AwardIcon, CarIcon, WalletIcon, TrashIcon,
} from '../../components/icons';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminCustomerDetail'>;
type Rt  = RouteProp<AdminStackParamList, 'AdminCustomerDetail'>;

interface VehicleData { model: string; connector: string; year: string }

function parseVehicle(raw?: string): VehicleData {
  if (!raw) return { model: '', connector: '', year: '' };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && p.model !== undefined) return p as VehicleData;
  } catch {}
  return { model: raw, connector: '', year: '' };
}

const ACTIVE   = '#10B981';
const INACTIVE = '#F59E0B';

export default function AdminCustomerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { t, isRTL } = useLang();

  const [user, setUser] = useState<AdminCustomer>(route.params.customer);
  const [busy, setBusy] = useState(false);

  const vehicle  = parseVehicle(user.car_model);
  const initial  = user.full_name ? user.full_name[0].toUpperCase() : '?';
  const inactive = !user.is_active;
  const accent   = inactive ? INACTIVE : ACTIVE;

  const setActiveStatus = async (active: boolean) => {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', user.id);
    setBusy(false);
    if (error) { Alert.alert(t.error, error.message); return; }
    setUser(prev => ({ ...prev, is_active: active }));
  };

  const confirmDeactivate = () => {
    Alert.alert(
      t.admin_deactivate_title,
      `${t.admin_deactivate_msg} "${user.full_name || user.email}"?`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.admin_deactivate_confirm, style: 'destructive', onPress: () => setActiveStatus(false) },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      t.admin_delete_title,
      `${t.admin_delete_msg} "${user.full_name || user.email}"?\n\n${t.admin_delete_warning}`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.admin_delete_confirm,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_user_account', { target_user_id: user.id });
            if (error) { Alert.alert(t.error, error.message); return; }
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={[s.header, isRTL && s.rowReverse]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={isRTL && s.flipX}>
            <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{t.admin_customer_detail_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Identity ── */}
        <View style={s.identity}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={[s.presence, { backgroundColor: accent }]} />
          </View>
          <Text style={s.name}>{user.full_name || '—'}</Text>
          <View style={[s.statusRow, isRTL && s.rowReverse]}>
            <View style={[s.statusDot, { backgroundColor: accent }]} />
            <Text style={[s.statusText, { color: accent }]}>
              {inactive ? t.admin_deactivated : t.admin_customer_status_active}
            </Text>
          </View>
        </View>

        {/* ── Wallet — the one bold, premium moment ── */}
        <View style={s.wallet}>
          <View style={s.walletDeco} />
          <View style={[s.walletTop, isRTL && s.rowReverse]}>
            <Text style={s.walletLabel}>{t.admin_customer_wallet}</Text>
            <WalletIcon size={18} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          </View>
          <View style={[s.walletAmountRow, isRTL && s.rowReverse]}>
            <Text style={s.walletAmount}>{Number(user.wallet_balance).toFixed(3)}</Text>
            <Text style={s.walletCurrency}>OMR</Text>
          </View>
          <Text style={s.walletSub}>{t.admin_customer_balance_available}</Text>
        </View>

        {/* ── Stats ── */}
        <View style={s.statsCard}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{user.total_sessions}</Text>
            <Text style={s.statLabel}>{t.admin_customer_sessions}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{Number(user.total_kwh).toFixed(0)}</Text>
            <Text style={s.statLabel}>{t.admin_customer_kwh}</Text>
          </View>
        </View>

        {/* ── Details ── */}
        <View style={s.card}>
          <DetailRow Icon={MailIcon}  label="Email"                value={user.email || '—'} isRTL={isRTL} />
          <DetailRow Icon={PhoneIcon} label={t.admin_profile_phone} value={user.phone || '—'} isRTL={isRTL} />
          <DetailRow Icon={AwardIcon} label={t.admin_customer_joined} value={new Date(user.created_at).toLocaleDateString()} isRTL={isRTL}
                     last={!vehicle.model} />
          {vehicle.model ? (
            <DetailRow
              Icon={CarIcon}
              label={t.admin_customer_vehicle}
              value={vehicle.connector ? `${vehicle.model} · ${vehicle.connector}${vehicle.year ? ` · ${vehicle.year}` : ''}` : vehicle.model}
              isRTL={isRTL}
              last
            />
          ) : null}
        </View>

        {/* ── Actions ── */}
        <View style={s.actions}>
          {inactive ? (
            <TouchableOpacity style={[s.primaryBtn, busy && s.btnOff]} onPress={() => setActiveStatus(true)} disabled={busy} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>{t.admin_reactivate}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.ghostBtn, busy && s.btnOff]} onPress={confirmDeactivate} disabled={busy} activeOpacity={0.85}>
              <Text style={[s.ghostBtnText, { color: INACTIVE }]}>{t.admin_deactivate_confirm}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.ghostBtn, isRTL && s.rowReverse]} onPress={confirmDelete} activeOpacity={0.85}>
            <TrashIcon size={15} color={COLORS.error} strokeWidth={2.5} />
            <Text style={[s.ghostBtnText, { color: COLORS.error }]}>{t.admin_delete_confirm}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function DetailRow({
  Icon, label, value, last, isRTL,
}: { Icon: any; label: string; value: string; last?: boolean; isRTL?: boolean }) {
  return (
    <View style={[s.row, last && s.rowLast, isRTL && s.rowReverse]}>
      <Icon size={16} color={COLORS.textTertiary} strokeWidth={2} />
      <Text style={[s.rowLabel, isRTL && s.rtlText]}>{label}</Text>
      <Text style={[s.rowValue, isRTL ? s.ltrText : s.rtlText]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // RTL helpers
  rtlText:    { textAlign: 'right' },
  ltrText:    { textAlign: 'left' },
  rowReverse: { flexDirection: 'row-reverse' },
  flipX:      { transform: [{ scaleX: -1 }] },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  back: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text, marginHorizontal: 8 },

  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },

  // Identity
  identity: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: COLORS.text },
  presence: {
    position: 'absolute', bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 3, borderColor: COLORS.background,
  },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },

  // Wallet — premium dark card
  wallet: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 24, padding: 20,
    overflow: 'hidden',
  },
  walletDeco: {
    position: 'absolute', top: -40, right: -30,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  walletTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  walletLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 },
  walletAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  walletAmount: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  walletCurrency: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  walletSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 2 },

  // Details card
  card: { backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLast:  { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary, flexShrink: 0 },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Actions
  actions: { gap: 10, marginTop: 2 },
  primaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: COLORS.border,
  },
  ghostBtnText: { fontSize: 15, fontWeight: '700' },
  btnOff: { opacity: 0.55 },
});
