import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import { ArrowLeftIcon, ShieldIcon, UsersIcon, XIcon } from '../../components/icons';

type Admin = { id: string; full_name: string; email: string | null; phone: string; role: string; created_at: string };

export default function SuperAdminScreen() {
  const { t } = useLang();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  // Platform settings (strings as stored in app_config)
  const [commissionPct, setCommissionPct] = useState('0');   // shown as %
  const [defaultPrice,  setDefaultPrice]  = useState('0.028');
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [payoutThresh,  setPayoutThresh]  = useState('20.000');
  const [payoutProvider, setPayoutProvider] = useState('');

  // Admin management
  const [admins, setAdmins]       = useState<Admin[]>([]);
  const [newContact, setNewContact] = useState('');
  const [promoting, setPromoting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: adm }] = await Promise.all([
        supabase.rpc('sa_get_settings'),
        supabase.rpc('sa_list_admins'),
      ]);
      if (cfg) {
        const rate = parseFloat(cfg.host_commission_rate ?? '0');
        setCommissionPct(String(Math.round(rate * 100)));
        setDefaultPrice(cfg.default_price_per_kwh ?? '0.028');
        setPayoutEnabled((cfg.payout_auto_enabled ?? 'false') === 'true');
        setPayoutThresh(cfg.payout_threshold ?? '20.000');
        setPayoutProvider(cfg.payout_provider ?? '');
      }
      setAdmins((adm ?? []) as Admin[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      const { error } = await supabase.rpc('sa_set_setting', { p_key: key, p_value: value });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert(t.error, e.message);
      await load();
    } finally {
      setSaving(null);
    }
  };

  const saveCommission = () => {
    const pct = Math.max(0, Math.min(100, parseFloat(commissionPct) || 0));
    saveSetting('host_commission_rate', String(pct / 100));
  };

  const togglePayout = async (val: boolean) => {
    setPayoutEnabled(val);
    await saveSetting('payout_auto_enabled', val ? 'true' : 'false');
  };

  const makeAdmin = async () => {
    if (!newContact.trim()) return;
    setPromoting(true);
    try {
      const { data, error } = await supabase.rpc('sa_set_admin', { p_identifier: newContact.trim(), p_make: true });
      if (error) throw error;
      setNewContact('');
      await load();
      Alert.alert('', `${(data as any)?.name ?? 'User'} ${t.sa_now_admin}`);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setPromoting(false);
    }
  };

  const removeAdmin = (a: Admin) =>
    Alert.alert(t.sa_remove_admin_title, `${t.sa_remove_admin_msg} ${a.full_name || a.email || a.phone}?`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.sa_remove_admin_confirm, style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.rpc('sa_set_admin', { p_identifier: a.email || a.phone, p_make: false });
            if (error) throw error;
            await load();
          } catch (e: any) { Alert.alert(t.error, e.message); }
        },
      },
    ]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.sa_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

            {/* ── Platform settings ── */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <ShieldIcon size={18} color="#7C3AED" strokeWidth={2} />
                <Text style={s.cardTitle}>{t.sa_settings}</Text>
              </View>

              {/* Commission */}
              <SettingRow label={t.sa_commission} hint={t.sa_commission_hint}>
                <View style={s.inlineRow}>
                  <TextInput style={s.smallInput} value={commissionPct} onChangeText={setCommissionPct}
                    keyboardType="number-pad" maxLength={3} />
                  <Text style={s.unit}>%</Text>
                  <SaveChip onPress={saveCommission} busy={saving === 'host_commission_rate'} label={t.sa_save} />
                </View>
              </SettingRow>

              {/* Default price */}
              <SettingRow label={t.sa_default_price} hint={t.sa_default_price_hint}>
                <View style={s.inlineRow}>
                  <TextInput style={s.smallInput} value={defaultPrice} onChangeText={setDefaultPrice}
                    keyboardType="decimal-pad" maxLength={6} />
                  <Text style={s.unit}>OMR</Text>
                  <SaveChip onPress={() => saveSetting('default_price_per_kwh', defaultPrice)} busy={saving === 'default_price_per_kwh'} label={t.sa_save} />
                </View>
              </SettingRow>

              {/* Payout threshold */}
              <SettingRow label={t.sa_payout_threshold} hint={t.sa_payout_threshold_hint}>
                <View style={s.inlineRow}>
                  <TextInput style={s.smallInput} value={payoutThresh} onChangeText={setPayoutThresh}
                    keyboardType="decimal-pad" maxLength={7} />
                  <Text style={s.unit}>OMR</Text>
                  <SaveChip onPress={() => saveSetting('payout_threshold', payoutThresh)} busy={saving === 'payout_threshold'} label={t.sa_save} />
                </View>
              </SettingRow>

              {/* Auto payout toggle */}
              <SettingRow label={t.sa_payout_auto} hint={t.sa_payout_auto_hint}>
                <Switch
                  value={payoutEnabled}
                  onValueChange={togglePayout}
                  trackColor={{ false: COLORS.border, true: '#7C3AED' }}
                  thumbColor="#fff"
                />
              </SettingRow>

              {/* Provider */}
              <SettingRow label={t.sa_payout_provider} hint={t.sa_payout_provider_hint} last>
                <View style={s.inlineRow}>
                  <TextInput style={[s.smallInput, { minWidth: 120 }]} value={payoutProvider} onChangeText={setPayoutProvider}
                    autoCapitalize="none" placeholder="—" placeholderTextColor={COLORS.textTertiary} />
                  <SaveChip onPress={() => saveSetting('payout_provider', payoutProvider.trim())} busy={saving === 'payout_provider'} label={t.sa_save} />
                </View>
              </SettingRow>
            </View>

            {/* ── Admin management ── */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <UsersIcon size={18} color="#7C3AED" strokeWidth={2} />
                <Text style={s.cardTitle}>{t.sa_admins}</Text>
              </View>

              {admins.map(a => (
                <View key={a.id} style={s.adminRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.adminName}>{a.full_name || '—'}</Text>
                    <Text style={s.adminPhone}>{a.email || a.phone || '—'}</Text>
                  </View>
                  {a.role === 'superadmin' ? (
                    <View style={s.superBadge}><Text style={s.superBadgeText}>{t.sa_you}</Text></View>
                  ) : (
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeAdmin(a)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <XIcon size={14} color={COLORS.error} strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Add admin by phone */}
              <Text style={s.addLabel}>{t.sa_add_admin}</Text>
              <View style={s.inlineRow}>
                <TextInput
                  style={[s.smallInput, { flex: 1, textAlign: 'left' }]}
                  value={newContact}
                  onChangeText={setNewContact}
                  placeholder={t.sa_phone_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <TouchableOpacity style={s.makeAdminBtn} onPress={makeAdmin} disabled={promoting} activeOpacity={0.85}>
                  {promoting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.makeAdminText}>{t.sa_make_admin}</Text>}
                </TouchableOpacity>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function SettingRow({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[s.settingRow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={s.settingLabel}>{label}</Text>
        {hint ? <Text style={s.settingHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SaveChip({ onPress, busy, label }: { onPress: () => void; busy: boolean; label: string }) {
  return (
    <TouchableOpacity style={s.saveChip} onPress={onPress} disabled={busy} activeOpacity={0.85}>
      {busy ? <ActivityIndicator color="#7C3AED" size="small" /> : <Text style={s.saveChipText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  settingLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  settingHint:  { fontSize: 11, color: COLORS.textTertiary, marginTop: 2, lineHeight: 15 },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallInput: {
    minWidth: 56, backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'center',
  },
  unit: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  saveChip: { backgroundColor: '#EEE7FB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  saveChipText: { color: '#7C3AED', fontWeight: '800', fontSize: 12 },

  adminRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  adminName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  adminPhone: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  superBadge: { backgroundColor: '#EEE7FB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  superBadgeText: { color: '#7C3AED', fontWeight: '800', fontSize: 11 },
  removeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.errorBg, alignItems: 'center', justifyContent: 'center' },

  addLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginTop: 14, marginBottom: 8 },
  makeAdminBtn: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  makeAdminText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
