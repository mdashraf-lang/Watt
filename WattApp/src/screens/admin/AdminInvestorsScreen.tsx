import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking,
  Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { ChargerApplication } from '../../types';
import {
  TrendingUpIcon, PhoneIcon, ZapIcon, UserIcon, MapPinIcon,
  ShieldIcon, XIcon, ChevronRightIcon, CheckIcon,
} from '../../components/icons';

// TODO: wire up once SMTP is configured
function sendEmail(_type: string, _email: string, _name: string, _comment?: string) {
  return Promise.resolve();
}

type StatusFilter = 'all' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_info';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:      { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  under_review: { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  approved:     { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  rejected:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  needs_info:   { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' },
};

// ── Main screen ────────────────────────────────────────────────

export default function AdminInvestorsScreen() {
  const { t } = useLang();

  const [applications, setApplications] = useState<ChargerApplication[]>([]);
  const [filtered, setFiltered]         = useState<ChargerApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState<StatusFilter>('all');
  const [selected, setSelected]         = useState<ChargerApplication | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('charger_applications')
        .select('*, profile:profiles(full_name, phone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplications((data ?? []) as ChargerApplication[]);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  useEffect(() => {
    let list = applications;
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.full_name.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.governorate.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [applications, filter, search]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending:      t.admin_inv_status_pending,
      under_review: t.admin_inv_status_under_review,
      approved:     t.admin_inv_status_approved,
      rejected:     t.admin_inv_status_rejected,
      needs_info:   t.admin_inv_status_needs_info,
    };
    return map[status] ?? status;
  };

  const handleUpdate = (updated: ChargerApplication) => {
    setApplications(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelected(updated);
  };

  const handleDelete = (id: string) => {
    setApplications(prev => prev.filter(a => a.id !== id));
    setSelected(null);
  };

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: t.admin_inv_filter_all },
    { key: 'pending',  label: t.admin_inv_filter_pending },
    { key: 'approved', label: t.admin_inv_filter_approved },
    { key: 'rejected', label: t.admin_inv_filter_rejected },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.admin_investors_title}</Text>
        <View style={styles.headerIcon}>
          <TrendingUpIcon size={22} color={COLORS.gold} strokeWidth={2} />
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{applications.length}</Text>
          <Text style={styles.statLbl}>{t.admin_inv_total}</Text>
        </View>
        {(['pending', 'approved', 'rejected'] as StatusFilter[]).map(s => (
          <View key={s} style={[styles.statChip, { backgroundColor: STATUS_COLORS[s]?.bg }]}>
            <Text style={[styles.statNum, { color: STATUS_COLORS[s]?.text }]}>
              {applications.filter(a =>
                a.status === s || (s === 'pending' && a.status === 'under_review')
              ).length}
            </Text>
            <Text style={[styles.statLbl, { color: STATUS_COLORS[s]?.text }]}>{statusLabel(s)}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.admin_inv_search}
          placeholderTextColor={COLORS.textTertiary}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <XIcon size={16} color={COLORS.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <TrendingUpIcon size={36} color={COLORS.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.admin_inv_empty}</Text>
          <Text style={styles.emptySub}>{t.admin_inv_empty_sub}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ApplicationCard
              app={item}
              statusLabel={statusLabel(item.status)}
              statusColor={STATUS_COLORS[item.status] ?? STATUS_COLORS.pending}
              onPress={() => setSelected(item)}
              t={t}
            />
          )}
        />
      )}

      {/* Full-screen detail modal — no overlay blocking scroll */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <ApplicationDetail
            app={selected}
            statusLabel={statusLabel}
            statusColors={STATUS_COLORS}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            t={t}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── ApplicationDetail — full-screen, freely scrollable ─────────

function ApplicationDetail({ app, statusLabel, statusColors, onClose, onUpdate, onDelete, t }: {
  app: ChargerApplication;
  statusLabel: (s: string) => string;
  statusColors: typeof STATUS_COLORS;
  onClose: () => void;
  onUpdate: (a: ChargerApplication) => void;
  onDelete: (id: string) => void;
  t: any;
}) {
  const [comment,  setComment]  = useState(app.admin_comment ?? '');
  const [saving,   setSaving]   = useState(false);
  const [listing,  setListing]  = useState<{ id: string; tuya_device_id: string | null; tuya_verified: boolean; price_per_kwh: number } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const sc = statusColors[app.status] ?? statusColors.pending;

  // Fetch the charger listing if application is approved
  useEffect(() => {
    if (app.status === 'approved') {
      supabase
        .from('charger_listings')
        .select('id, tuya_device_id, tuya_verified, price_per_kwh')
        .eq('host_id', app.user_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setListing(data as any);
            setPriceInput(String((data as any).price_per_kwh ?? ''));
          }
        });
    }
  }, [app.user_id, app.status]);

  // Admin-only: set the price per kWh for this investor's charger
  const handleSavePrice = async () => {
    if (!listing) return;
    const price = parseFloat(priceInput);
    if (!price || price <= 0 || price > 1) {
      Alert.alert(t.error, t.admin_price_invalid); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('charger_listings')
        .update({ price_per_kwh: price })
        .eq('id', listing.id);
      if (error) throw error;
      setListing(prev => prev ? { ...prev, price_per_kwh: price } : prev);
      Alert.alert('✓', t.admin_price_saved);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDevice = () => {
    if (!listing) return;
    Alert.alert(t.admin_tuya_verify_btn, t.admin_tuya_verify_confirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.admin_tuya_verify_btn,
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase
              .from('charger_listings')
              .update({ tuya_verified: true })
              .eq('id', listing.id);
            if (error) throw error;
            setListing(prev => prev ? { ...prev, tuya_verified: true } : prev);
            Alert.alert('✓', t.admin_tuya_verify_done);
          } catch (e: any) {
            Alert.alert(t.error, e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${app.phone.replace(/\s/g, '')}`);
  };

  const handleDelete = () => {
    Alert.alert(
      t.admin_inv_delete,
      t.admin_inv_delete_confirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.admin_inv_delete,
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase
                .from('charger_applications')
                .delete()
                .eq('id', app.id);
              if (error) throw error;
              Alert.alert('✓', t.admin_inv_deleted);
              onDelete(app.id);
            } catch (e: any) {
              Alert.alert(t.error, e.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveComment = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('charger_applications')
        .update({ admin_comment: comment.trim() || null })
        .eq('id', app.id);
      if (error) throw error;
      onUpdate({ ...app, admin_comment: comment.trim() || undefined });
      Alert.alert('✓', t.admin_inv_comment_saved);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'review') => {
    const rpcMap   = { accept: 'accept_investor_application', reject: 'reject_investor_application', review: 'set_application_under_review' };
    const statusMap = { accept: 'approved' as const, reject: 'rejected' as const, review: 'under_review' as const };
    const labelMap  = { accept: t.admin_inv_accept, reject: t.admin_inv_reject, review: t.admin_inv_on_review };

    Alert.alert(
      labelMap[action],
      `${labelMap[action]}: ${app.full_name}?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: labelMap[action],
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase.rpc(rpcMap[action], { p_application_id: app.id });
              if (error) throw error;
              const updated = { ...app, status: statusMap[action] };
              onUpdate(updated);
              if (action === 'accept') await sendEmail('application_accepted', '', app.full_name);
              if (action === 'reject') await sendEmail('application_rejected', '', app.full_name, comment);
              Alert.alert('✓', `${labelMap[action]} — Done`);
            } catch (e: any) {
              Alert.alert(t.error, e.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={detail.container} edges={['top', 'bottom']}>
      {/* Fixed header — always visible */}
      <View style={detail.header}>
        <TouchableOpacity style={detail.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <XIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={detail.headerTitle}>{t.admin_inv_detail_title}</Text>
        <TouchableOpacity style={detail.callHeaderBtn} onPress={handleCall}>
          <PhoneIcon size={16} color={COLORS.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={detail.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status + date */}
          <View style={[detail.statusCard, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <View style={[detail.statusBadge, { backgroundColor: sc.text }]}>
              <Text style={detail.statusBadgeText}>{statusLabel(app.status)}</Text>
            </View>
            <Text style={detail.statusDate}>
              {t.admin_inv_submitted}: {new Date(app.created_at).toLocaleDateString()}
            </Text>
          </View>

          {/* Call button */}
          <TouchableOpacity style={detail.callBtn} onPress={handleCall} activeOpacity={0.85}>
            <PhoneIcon size={18} color="#fff" strokeWidth={2} />
            <Text style={detail.callBtnText}>{t.admin_inv_call}: {app.phone}</Text>
          </TouchableOpacity>

          {/* ── Personal ── */}
          <SectionLabel icon={<UserIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_personal} />
          <InfoCard>
            <InfoRow label={t.profile_name}  value={app.full_name} />
            <InfoRow label={t.profile_phone} value={app.phone} last />
          </InfoCard>

          {/* ── Location ── */}
          <SectionLabel icon={<MapPinIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_location} />
          <InfoCard>
            <InfoRow label={t.inv_app_gov_label}  value={app.governorate} />
            <InfoRow label={t.inv_app_city_label} value={app.city} />
            <InfoRow
              label="GPS"
              value={app.latitude ? `${app.latitude.toFixed(5)}, ${app.longitude?.toFixed(5)}` : '—'}
              last
            />
          </InfoCard>

          {/* ── Charger ── */}
          <SectionLabel icon={<ZapIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_charger_type} />
          <InfoCard>
            <InfoRow label={t.admin_inv_charger_type} value={app.charger_type} />
            <InfoRow label={t.admin_inv_power} value={app.power_kw ? `${app.power_kw} kW` : t.admin_inv_power_na} last />
          </InfoCard>

          {/* ── Government docs ── */}
          <SectionLabel icon={<ShieldIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_gov_req} />
          <InfoCard>
            <InfoRow label={t.admin_inv_elec_form}  value={app.electricity_form_name} />
            <InfoRow label={t.admin_inv_commercial} value={app.commercial_registration} />
            <InfoRow label={t.admin_inv_id_card}    value={app.id_card_number} last />
          </InfoCard>

          {/* ── Actions ── */}
          <SectionLabel icon={<CheckIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_actions} />
          <View style={detail.actionsRow}>
            <ActionBtn
              label={t.admin_inv_accept}
              color={COLORS.success}
              icon="✓"
              active={app.status !== 'approved'}
              onPress={() => handleAction('accept')}
            />
            <ActionBtn
              label={t.admin_inv_on_review}
              color={COLORS.warning}
              icon="🔍"
              active={app.status !== 'under_review'}
              onPress={() => handleAction('review')}
            />
            <ActionBtn
              label={t.admin_inv_reject}
              color={COLORS.error}
              icon="✕"
              active={app.status !== 'rejected'}
              onPress={() => handleAction('reject')}
            />
          </View>

          {/* ── Charger Device (only for approved applications) ── */}
          {app.status === 'approved' && (
            <>
              <SectionLabel icon={<ZapIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_tuya_section} />
              <InfoCard>
                <InfoRow
                  label={t.admin_tuya_device_id}
                  value={listing?.tuya_device_id ?? t.admin_tuya_not_set}
                />
                <InfoRow
                  label={t.tuya_status_label}
                  value={listing?.tuya_verified ? t.admin_tuya_verified : t.admin_tuya_not_verified}
                  last
                />
              </InfoCard>
              {listing && !listing.tuya_verified && listing.tuya_device_id && (
                <TouchableOpacity
                  style={[detail.verifyBtn, saving && detail.saveBtnDisabled]}
                  onPress={handleVerifyDevice}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={detail.saveBtnText}>✓ {t.admin_tuya_verify_btn}</Text>
                  }
                </TouchableOpacity>
              )}

              {/* ── Pricing (admin-only control) ── */}
              {listing && (
                <>
                  <SectionLabel icon={<ZapIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_price_section} />
                  <View style={detail.commentCard}>
                    <TextInput
                      style={detail.commentInput}
                      value={priceInput}
                      onChangeText={setPriceInput}
                      placeholder={t.admin_price_ph}
                      placeholderTextColor={COLORS.textTertiary}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={[detail.saveBtn, saving && detail.saveBtnDisabled]}
                      onPress={handleSavePrice}
                      disabled={saving}
                      activeOpacity={0.85}
                    >
                      {saving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={detail.saveBtnText}>{t.admin_price_save}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {/* ── Comment ── */}
          <SectionLabel icon={<PhoneIcon size={14} color={COLORS.primary} strokeWidth={2} />} title={t.admin_inv_add_comment} />
          <View style={detail.commentCard}>
            <TextInput
              style={detail.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t.admin_inv_comment_ph}
              placeholderTextColor={COLORS.textTertiary}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[detail.saveBtn, saving && detail.saveBtnDisabled]}
              onPress={handleSaveComment}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={detail.saveBtnText}>{t.admin_inv_save_comment}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── Delete ── */}
          <TouchableOpacity
            style={[detail.deleteBtn, saving && detail.saveBtnDisabled]}
            onPress={handleDelete}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={detail.saveBtnText}>{t.admin_inv_delete}</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={shared.sectionLabel}>
      <View style={shared.sectionLabelIcon}>{icon}</View>
      <Text style={shared.sectionLabelText}>{title}</Text>
    </View>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={shared.infoCard}>{children}</View>;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[shared.infoRow, last && shared.infoRowLast]}>
      <Text style={shared.infoLabel}>{label}</Text>
      <Text style={shared.infoValue} selectable numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, color, icon, active, onPress }: {
  label: string; color: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        shared.actionBtn,
        { borderColor: color, backgroundColor: active ? color + '12' : color + '06' },
        !active && shared.actionBtnDone,
      ]}
      onPress={active ? onPress : undefined}
      disabled={!active}
      activeOpacity={0.75}
    >
      <Text style={[shared.actionIcon, { color: active ? color : color + '55' }]}>{icon}</Text>
      <Text style={[shared.actionLabel, { color: active ? color : color + '55' }]}>{label}</Text>
      {!active && (
        <View style={[shared.actionDoneDot, { backgroundColor: color }]} />
      )}
    </TouchableOpacity>
  );
}

function ApplicationCard({ app, statusLabel, statusColor, onPress, t }: {
  app: ChargerApplication;
  statusLabel: string;
  statusColor: { bg: string; text: string; border: string };
  onPress: () => void;
  t: any;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatar}>
          <UserIcon size={20} color={COLORS.primary} strokeWidth={2} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{app.full_name}</Text>
          <Text style={styles.cardMeta}>{app.governorate} · {app.city}</Text>
          <Text style={styles.cardMeta}>{app.charger_type}{app.power_kw ? ` · ${app.power_kw} kW` : ''}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
          <Text style={[styles.statusChipText, { color: statusColor.text }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{new Date(app.created_at).toLocaleDateString()}</Text>
        <View style={styles.cardRight}>
          <PhoneIcon size={12} color={COLORS.textTertiary} strokeWidth={2} />
          <Text style={styles.cardPhone}>{app.phone}</Text>
        </View>
        <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ── Styles: list screen ────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerIcon:  { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },

  statsBar: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  statChip: { flex: 1, alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  statNum:  { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLbl:  { fontSize: 10, color: COLORS.textTertiary, marginTop: 1, textAlign: 'center' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  filterBar: { marginBottom: 8, maxHeight: 46 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: COLORS.goldBg, borderWidth: 2, borderColor: COLORS.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptySub:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo:   { flex: 1 },
  cardName:   { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardMeta:   { fontSize: 12, color: COLORS.textSecondary },
  statusChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 8 },
  cardDate:   { fontSize: 11, color: COLORS.textTertiary, flex: 1 },
  cardRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardPhone:  { fontSize: 12, color: COLORS.textSecondary },
});

// ── Styles: detail screen ──────────────────────────────────────

const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, textAlign: 'center' },
  callHeaderBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, gap: 0 },

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  statusBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  statusDate:      { fontSize: 12, color: COLORS.textSecondary, flex: 1 },

  // Call button
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, marginBottom: 20 },
  callBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },

  // Comment
  commentCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  commentInput: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12,
    fontSize: 14, color: COLORS.text, minHeight: 100,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
    textAlignVertical: 'top',
  },
  saveBtn:         { backgroundColor: COLORS.primaryDark, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  verifyBtn:       { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  deleteBtn:       { backgroundColor: COLORS.error, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 4 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ── Styles: shared components ──────────────────────────────────

const shared = StyleSheet.create({
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, marginTop: 4 },
  sectionLabelIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  sectionLabelText: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7 },

  infoCard: { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel:   { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue:   { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'right', flex: 1.4 },

  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, gap: 4,
  },
  actionBtnDone: { opacity: 0.45 },
  actionIcon:  { fontSize: 16, fontWeight: '800' },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  actionDoneDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
