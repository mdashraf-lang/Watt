import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import {
  SearchIcon, XIcon, UserIcon, PhoneIcon, AwardIcon, MailIcon,
  CarIcon, ZapIcon, BatteryChargingIcon, StarIcon, WalletIcon, TrashIcon,
} from '../../components/icons';

// ── Types ────────────────────────────────────────────────────────

interface VehicleData { model: string; connector: string; year: string }

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role: string;
  is_active: boolean;
  wallet_balance: number;
  total_sessions: number;
  total_kwh: number;
  car_model?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

function parseVehicle(raw?: string): VehicleData {
  if (!raw) return { model: '', connector: '', year: '' };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && p.model !== undefined) return p as VehicleData;
  } catch {}
  return { model: raw, connector: '', year: '' };
}

// ── Screen ────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const { t, isRTL } = useLang();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<Customer | null>(null);

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_customers_with_email');
    if (data) setCustomers(data as Customer[]);
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  };

  const setActiveStatus = async (user: Customer, active: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: active })
      .eq('id', user.id);
    if (error) {
      Alert.alert(t.error, error.message);
    } else {
      const updated = { ...user, is_active: active };
      setCustomers(prev => prev.map(c => c.id === user.id ? updated : c));
      setSelected(updated);
    }
  };

  const confirmDeactivate = (user: Customer) => {
    Alert.alert(
      t.admin_deactivate_title,
      `${t.admin_deactivate_msg} "${user.full_name || user.email}"?`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.admin_deactivate_confirm, style: 'destructive', onPress: () => setActiveStatus(user, false) },
      ],
    );
  };

  const deleteCustomer = (user: Customer) => {
    Alert.alert(
      t.admin_delete_title,
      `${t.admin_delete_msg} "${user.full_name || user.email}"?\n\n${t.admin_delete_warning}`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.admin_delete_confirm,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_user_account', {
              target_user_id: user.id,
            });
            if (error) {
              Alert.alert(t.error, error.message);
            } else {
              setSelected(null);
              setCustomers(prev => prev.filter(c => c.id !== user.id));
            }
          },
        },
      ],
    );
  };

  const filtered = search.trim()
    ? customers.filter(c =>
        (c.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? '').includes(search),
      )
    : customers;

  const renderCustomer = useCallback(({ item }: { item: Customer }) => {
    const initial  = item.full_name ? item.full_name[0].toUpperCase() : '?';
    const inactive = !item.is_active;
    return (
      <TouchableOpacity
        style={[styles.card, inactive && styles.cardInactive]}
        onPress={() => setSelected(item)}
        activeOpacity={0.75}
      >
        {/* Left stripe for inactive */}
        {inactive && <View style={styles.cardStripe} />}

        <View style={[styles.cardAvatar, inactive && styles.cardAvatarInactive]}>
          <Text style={[styles.cardAvatarText, inactive && { color: COLORS.textTertiary }]}>
            {initial}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardName, inactive && { color: COLORS.textTertiary }]} numberOfLines={1}>
              {item.full_name || '—'}
            </Text>
            {inactive && (
              <View style={styles.inactivePill}>
                <Text style={styles.inactivePillText}>{t.admin_deactivated}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{item.email || '—'}</Text>
          <Text style={styles.cardMeta}>
            {t.admin_customer_joined}: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.cardBalance}>
          <Text style={styles.cardBalanceAmount}>{Number(item.wallet_balance).toFixed(3)}</Text>
          <Text style={styles.cardBalanceCurrency}>OMR</Text>
        </View>
      </TouchableOpacity>
    );
  }, [isRTL, t]);

  const activeCount   = customers.filter(c => c.is_active).length;
  const inactiveCount = customers.filter(c => !c.is_active).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t.admin_customers_title}</Text>
          <Text style={styles.headerSub}>
            {activeCount} active · {inactiveCount} deactivated
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <UserIcon size={20} color={COLORS.primary} strokeWidth={2} />
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchBar}>
        <SearchIcon size={15} color={COLORS.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
          placeholder={t.admin_customers_search}
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <XIcon size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <UserIcon size={32} color={COLORS.textTertiary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.admin_customers_empty}</Text>
          <Text style={styles.emptySub}>{t.admin_customers_empty_sub}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderCustomer}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchCustomers}
          refreshing={loading}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          {/* Backdrop — tap to dismiss */}
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />

          {/* Sheet — plain View so ScrollView inside scrolls freely */}
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {selected && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetScroll}
              >
                <CustomerDetail
                  user={selected}
                  t={t}
                  onDeactivate={() => confirmDeactivate(selected)}
                  onReactivate={() => setActiveStatus(selected, true)}
                  onDelete={() => deleteCustomer(selected)}
                  onClose={() => setSelected(null)}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Customer Detail ────────────────────────────────────────────────

function CustomerDetail({
  user, t, onDeactivate, onReactivate, onDelete, onClose,
}: {
  user: Customer;
  t: any;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const vehicle  = parseVehicle(user.car_model);
  const initial  = user.full_name ? user.full_name[0].toUpperCase() : '?';
  const inactive = !user.is_active;

  return (
    <View style={styles.detail}>

      {/* ── Hero ── */}
      <View style={[styles.detailHero, inactive && styles.detailHeroInactive]}>
        <View style={[styles.detailAvatar, inactive && styles.detailAvatarInactive]}>
          <Text style={styles.detailAvatarText}>{initial}</Text>
        </View>
        <Text style={styles.detailName}>{user.full_name || '—'}</Text>
        {inactive ? (
          <View style={styles.statusPillInactive}>
            <Text style={styles.statusPillInactiveText}>{t.admin_deactivated}</Text>
          </View>
        ) : (
          <View style={styles.statusPillActive}>
            <Text style={styles.statusPillActiveText}>Active</Text>
          </View>
        )}
      </View>

      {/* ── Contact & Account ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact & Account</Text>
        <InfoRow Icon={MailIcon}    iconBg="#eff6ff" iconColor="#3b82f6" label="Email"         value={user.email || '—'} />
        <InfoRow Icon={PhoneIcon}   iconBg={COLORS.primaryBg} iconColor={COLORS.primary}  label={t.admin_profile_phone} value={user.phone || '—'} />
        <InfoRow Icon={AwardIcon}   iconBg="#fefce8" iconColor="#ca8a04" label={t.admin_customer_joined} value={new Date(user.created_at).toLocaleDateString()} />
      </View>

      {/* ── Wallet ── */}
      <View style={styles.walletCard}>
        <View style={styles.walletLeft}>
          <View style={styles.walletIconWrap}>
            <WalletIcon size={20} color={COLORS.primary} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.walletLabel}>{t.admin_customer_wallet}</Text>
            <Text style={styles.walletSub}>Available balance</Text>
          </View>
        </View>
        <Text style={styles.walletAmount}>
          {Number(user.wallet_balance).toFixed(3)}{' '}
          <Text style={styles.walletCurrency}>OMR</Text>
        </Text>
      </View>

      {/* ── Activity Stats ── */}
      <View style={styles.statsRow}>
        <StatBox value={String(user.total_sessions)}        label={t.admin_customer_sessions} Icon={ZapIcon}             color={COLORS.primary} bg={COLORS.primaryBg} />
        <StatBox value={Number(user.total_kwh).toFixed(0)} label={t.admin_customer_kwh}      Icon={BatteryChargingIcon} color="#3b82f6"          bg="#eff6ff" />
      </View>

      {/* ── Vehicle ── */}
      {vehicle.model ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.admin_customer_vehicle}</Text>
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIcon}>
              <CarIcon size={18} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.vehicleModel}>{vehicle.model}</Text>
              {vehicle.connector ? (
                <Text style={styles.vehicleSub}>
                  {vehicle.connector}{vehicle.year ? ` · ${vehicle.year}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        {inactive ? (
          <TouchableOpacity style={styles.reactivateBtn} onPress={onReactivate} activeOpacity={0.85}>
            <Text style={styles.reactivateBtnText}>{t.admin_reactivate}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.deactivateBtn} onPress={onDeactivate} activeOpacity={0.85}>
            <Text style={styles.deactivateBtnText}>{t.admin_deactivate_confirm}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.85}>
          <TrashIcon size={15} color={COLORS.error} strokeWidth={2.5} />
          <Text style={styles.deleteBtnText}>{t.admin_delete_confirm}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeBtnText}>{t.close}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function InfoRow({
  Icon, iconBg, iconColor, label, value,
}: { Icon: any; iconBg: string; iconColor: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        <Icon size={14} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatBox({
  value, label, Icon, color, bg,
}: { value: string; label: string; Icon: any; color: string; bg: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Icon size={16} color={color} strokeWidth={2} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  headerBadge: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: COLORS.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10, paddingTop: 4 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 18,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardInactive:    { opacity: 0.7, borderStyle: 'dashed' },
  cardStripe:      { width: 4, alignSelf: 'stretch', backgroundColor: '#fcd34d' },
  cardAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  cardAvatarInactive: { backgroundColor: COLORS.backgroundAlt },
  cardAvatarText:  { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  cardBody:        { flex: 1, paddingVertical: 13, paddingLeft: 12, paddingRight: 8 },
  cardTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  cardName:        { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  cardEmail:       { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  cardMeta:        { fontSize: 11, color: COLORS.textTertiary },
  cardBalance:     { alignItems: 'flex-end', paddingRight: 14, paddingVertical: 13 },
  cardBalanceAmount:{ fontSize: 15, fontWeight: '800', color: COLORS.primary },
  cardBalanceCurrency: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },

  inactivePill:     { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#fcd34d' },
  inactivePillText: { fontSize: 9, fontWeight: '700', color: '#92400e' },

  // Empty
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.backgroundAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub:     { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Modal
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 4 },
  sheetScroll: { paddingBottom: Platform.OS === 'ios' ? 34 : 24 },

  // Detail layout
  detail: { paddingHorizontal: 20 },

  // Hero
  detailHero: {
    alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primaryBg,
    marginHorizontal: -20, paddingHorizontal: 20,
    paddingVertical: 28, marginBottom: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.primaryTint,
  },
  detailHeroInactive: { backgroundColor: '#fafafa', borderBottomColor: '#e5e7eb' },
  detailAvatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', borderWidth: 3, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  detailAvatarInactive:{ borderColor: COLORS.border },
  detailAvatarText:   { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  detailName:         { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  statusPillActive:   { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: '#86efac' },
  statusPillActiveText:{ fontSize: 12, fontWeight: '700', color: '#166534' },
  statusPillInactive:  { backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: '#fcd34d' },
  statusPillInactiveText:{ fontSize: 12, fontWeight: '700', color: '#92400e' },

  // Section
  section:      { backgroundColor: COLORS.background, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Info row
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon:  { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, maxWidth: '55%', textAlign: 'right' },

  // Wallet card
  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primaryBg, borderRadius: 18,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.primaryTint,
  },
  walletLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIconWrap:{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryTint },
  walletLabel:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  walletSub:     { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  walletAmount:  { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  walletCurrency:{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox:  { flex: 1, backgroundColor: COLORS.background, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue:{ fontSize: 20, fontWeight: '800' },
  statLabel:{ fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },

  // Vehicle
  vehicleCard:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon:  { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryTint },
  vehicleModel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  vehicleSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Action buttons
  actions:         { gap: 10, marginTop: 4, paddingBottom: 8 },
  reactivateBtn:    { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: '#6ee7b7' },
  reactivateBtnText:{ fontSize: 15, fontWeight: '700', color: '#065f46' },
  deactivateBtn:    { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3c7', borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: '#fcd34d' },
  deactivateBtnText:{ fontSize: 15, fontWeight: '700', color: '#92400e' },
  deleteBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.errorBg, borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnText:    { fontSize: 15, fontWeight: '700', color: COLORS.error },
  closeBtn:         { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: COLORS.border },
  closeBtnText:     { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
});
