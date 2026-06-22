import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Linking, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { ChargerApplication } from '../../types';

// TODO: wire up once SMTP is configured
// async function sendEmail(type: string, toEmail: string, toName: string, adminComment?: string) {
//   await supabase.functions.invoke('send-watt-email', {
//     body: { type, to_email: toEmail, to_name: toName, admin_comment: adminComment },
//   });
// }
function sendEmail(_type: string, _email: string, _name: string, _comment?: string) {
  return Promise.resolve(); // mock — no-op until SMTP configured
}
import {
  TrendingUpIcon, PhoneIcon, ZapIcon, UserIcon, MapPinIcon,
  ShieldIcon, CheckIcon, XIcon, ChevronRightIcon,
} from '../../components/icons';

type StatusFilter = 'all' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_info';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:      { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  under_review: { bg: '#FFFBEB', text: '#D97706', border: '#FEF3C7' },
  approved:     { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  rejected:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  needs_info:   { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' },
};

export default function AdminInvestorsScreen() {
  const { t } = useLang();

  const [applications, setApplications] = useState<ChargerApplication[]>([]);
  const [filtered, setFiltered]         = useState<ChargerApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState<StatusFilter>('all');
  const [selected, setSelected]         = useState<ChargerApplication | null>(null);
  const [comment, setComment]           = useState('');
  const [saving, setSaving]             = useState(false);

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

  const handleOpenDetail = (app: ChargerApplication) => {
    setSelected(app);
    setComment(app.admin_comment ?? '');
  };

  const handleSaveComment = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('charger_applications')
        .update({ admin_comment: comment.trim() || null })
        .eq('id', selected.id);
      if (error) throw error;
      setApplications(prev =>
        prev.map(a => a.id === selected.id ? { ...a, admin_comment: comment.trim() || undefined } : a)
      );
      setSelected(prev => prev ? { ...prev, admin_comment: comment.trim() || undefined } : null);
      Alert.alert('', t.admin_inv_comment_saved);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'review') => {
    if (!selected) return;
    const rpcMap = {
      accept: 'accept_investor_application',
      reject: 'reject_investor_application',
      review: 'set_application_under_review',
    };
    const statusMap = {
      accept: 'approved' as const,
      reject: 'rejected' as const,
      review: 'under_review' as const,
    };
    const labelMap = {
      accept: t.admin_inv_accept,
      reject: t.admin_inv_reject,
      review: t.admin_inv_on_review,
    };

    Alert.alert(
      labelMap[action],
      `${labelMap[action]}: ${selected.full_name}?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: labelMap[action],
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase.rpc(rpcMap[action], { p_application_id: selected.id });
              if (error) throw error;

              const newStatus = statusMap[action];
              setApplications(prev =>
                prev.map(a => a.id === selected.id ? { ...a, status: newStatus } : a)
              );
              setSelected(prev => prev ? { ...prev, status: newStatus } : null);

              // Send email notification
              const userEmail = selected.profile
                ? (selected as any)._email ?? ''
                : '';
              if (action === 'accept') {
                await sendEmail('application_accepted', userEmail, selected.full_name);
              } else if (action === 'reject') {
                await sendEmail('application_rejected', userEmail, selected.full_name, comment);
              }

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

  const handleCall = (phone: string) => {
    const tel = `tel:${phone.replace(/\s/g, '')}`;
    Linking.openURL(tel);
  };

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: t.admin_inv_filter_all },
    { key: 'pending',  label: t.admin_inv_filter_pending },
    { key: 'approved', label: t.admin_inv_filter_approved },
    { key: 'rejected', label: t.admin_inv_filter_rejected },
  ];

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
        {(['pending','approved','rejected'] as StatusFilter[]).map(s => (
          <View key={s} style={[styles.statChip, { backgroundColor: STATUS_COLORS[s]?.bg }]}>
            <Text style={[styles.statNum, { color: STATUS_COLORS[s]?.text }]}>
              {applications.filter(a => a.status === s || (s === 'pending' && a.status === 'under_review')).length}
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
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
              onPress={() => handleOpenDetail(item)}
              onCall={() => handleCall(item.phone)}
              t={t}
            />
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal header */}
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>{t.admin_inv_detail_title}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <XIcon size={20} color={COLORS.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* Status badge */}
                <View style={[styles.detailStatusWrap, { backgroundColor: (STATUS_COLORS[selected.status] ?? STATUS_COLORS.pending).bg, borderColor: (STATUS_COLORS[selected.status] ?? STATUS_COLORS.pending).border }]}>
                  <View style={[styles.detailStatusBadge, { backgroundColor: (STATUS_COLORS[selected.status] ?? STATUS_COLORS.pending).text }]}>
                    <Text style={styles.detailStatusBadgeText}>{statusLabel(selected.status)}</Text>
                  </View>
                  <Text style={styles.detailSubmitted}>{t.admin_inv_submitted}: {new Date(selected.created_at).toLocaleDateString()}</Text>
                </View>

                {/* Call button */}
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCall(selected.phone)}
                  activeOpacity={0.8}
                >
                  <PhoneIcon size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.callBtnText}>{t.admin_inv_call}: {selected.phone}</Text>
                </TouchableOpacity>

                {/* Personal info */}
                <DetailSection title={t.admin_inv_personal} icon={<UserIcon size={14} color={COLORS.primary} strokeWidth={2} />}>
                  <DetailRow label={t.profile_name} value={selected.full_name} />
                  <DetailRow label={t.profile_phone} value={selected.phone} last />
                </DetailSection>

                {/* Location */}
                <DetailSection title={t.admin_inv_location} icon={<MapPinIcon size={14} color={COLORS.primary} strokeWidth={2} />}>
                  <DetailRow label={t.inv_app_gov_label}  value={selected.governorate} />
                  <DetailRow label={t.inv_app_city_label} value={selected.city} />
                  {selected.latitude ? (
                    <DetailRow
                      label="GPS"
                      value={`${selected.latitude.toFixed(5)}, ${selected.longitude?.toFixed(5)}`}
                      last
                    />
                  ) : (
                    <DetailRow label="GPS" value="—" last />
                  )}
                </DetailSection>

                {/* Charger */}
                <DetailSection title={t.admin_inv_charger_type} icon={<ZapIcon size={14} color={COLORS.primary} strokeWidth={2} />}>
                  <DetailRow label={t.admin_inv_charger_type} value={selected.charger_type} />
                  <DetailRow label={t.admin_inv_power} value={selected.power_kw ? `${selected.power_kw} kW` : t.admin_inv_power_na} last />
                </DetailSection>

                {/* Government requirements */}
                <DetailSection title={t.admin_inv_gov_req} icon={<ShieldIcon size={14} color={COLORS.primary} strokeWidth={2} />}>
                  <DetailRow label={t.admin_inv_elec_form}  value={selected.electricity_form_name} />
                  <DetailRow label={t.admin_inv_commercial} value={selected.commercial_registration} />
                  <DetailRow label={t.admin_inv_id_card}    value={selected.id_card_number} last />
                </DetailSection>

                {/* ── Actions ──────────────────────────────────────── */}
                <View style={styles.actionsSection}>
                  <Text style={styles.actionsSectionTitle}>{t.admin_inv_actions}</Text>
                  <View style={styles.actionsRow}>
                    <RealActionBtn
                      label={t.admin_inv_accept}
                      color={COLORS.success}
                      active={selected.status !== 'approved'}
                      onPress={() => handleAction('accept')}
                    />
                    <RealActionBtn
                      label={t.admin_inv_on_review}
                      color={COLORS.warning}
                      active={selected.status !== 'under_review'}
                      onPress={() => handleAction('review')}
                    />
                    <RealActionBtn
                      label={t.admin_inv_reject}
                      color={COLORS.error}
                      active={selected.status !== 'rejected'}
                      onPress={() => handleAction('reject')}
                    />
                  </View>
                </View>

                {/* ── Admin Comment ────────────────────────────────── */}
                <View style={styles.commentSection}>
                  <Text style={styles.commentSectionTitle}>{t.admin_inv_add_comment}</Text>
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={t.admin_inv_comment_ph}
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.saveCommentBtn, saving && styles.saveCommentBtnDisabled]}
                    onPress={handleSaveComment}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveCommentBtnText}>{t.admin_inv_save_comment}</Text>
                    }
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function ApplicationCard({ app, statusLabel, statusColor, onPress, onCall, t }: {
  app: ChargerApplication;
  statusLabel: string;
  statusColor: { bg: string; text: string; border: string };
  onPress: () => void;
  onCall: () => void;
  t: any;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatarWrap}>
          <UserIcon size={20} color={COLORS.primary} strokeWidth={2} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{app.full_name}</Text>
          <Text style={styles.cardMeta}>{app.governorate} · {app.city}</Text>
          <Text style={styles.cardMeta}>{app.charger_type} {app.power_kw ? `· ${app.power_kw} kW` : ''}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
          <Text style={[styles.statusChipText, { color: statusColor.text }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{new Date(app.created_at).toLocaleDateString()}</Text>
        <TouchableOpacity
          style={styles.cardCallBtn}
          onPress={e => { e.stopPropagation(); onCall(); }}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <PhoneIcon size={13} color={COLORS.primary} strokeWidth={2.5} />
          <Text style={styles.cardCallText}>{app.phone}</Text>
        </TouchableOpacity>
        <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.detailSection}>
      <View style={styles.detailSectionHeader}>
        <View style={styles.detailSectionIcon}>{icon}</View>
        <Text style={styles.detailSectionTitle}>{title}</Text>
      </View>
      <View style={styles.detailSectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue} selectable>{value}</Text>
    </View>
  );
}

function RealActionBtn({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        active
          ? { borderColor: color, backgroundColor: color + '15' }
          : { borderColor: color + '30', backgroundColor: color + '08', opacity: 0.45 },
      ]}
      onPress={active ? onPress : undefined}
      activeOpacity={active ? 0.75 : 1}
      disabled={!active}
    >
      <Text style={[styles.actionBtnText, { color: active ? color : color + '60' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerIcon:  { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsBar: {
    flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12,
  },
  statChip: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  statNum: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1, textAlign: 'center' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // Filter bar
  filterBar: { marginBottom: 8, maxHeight: 46 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // Loading / empty
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: COLORS.goldBg, borderWidth: 2, borderColor: COLORS.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptySub:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Application card
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardAvatarWrap: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardInfo:     { flex: 1 },
  cardName:     { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardMeta:     { fontSize: 12, color: COLORS.textSecondary },
  statusChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 8 },
  cardDate:     { fontSize: 11, color: COLORS.textTertiary, flex: 1 },
  cardCallBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCallText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // Modal
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, maxHeight: '92%',
  },
  sheetHandle:  { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.text },

  // Detail status
  detailStatusWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  detailStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  detailStatusBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  detailSubmitted: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },

  // Call button
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, marginBottom: 16,
  },
  callBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Detail sections
  detailSection: { marginBottom: 12 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  detailSectionIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  detailSectionBody: { backgroundColor: COLORS.background, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailRowLast:  { borderBottomWidth: 0 },
  detailRowLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  detailRowValue: { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'right', flex: 1.2 },

  // Actions (deactivated)
  actionsSection: { marginBottom: 16 },
  actionsSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    borderRadius: 12, borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  // Comment
  commentSection: { marginBottom: 8 },
  commentSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  commentInput: {
    backgroundColor: COLORS.background, borderRadius: 14, padding: 12,
    fontSize: 14, color: COLORS.text, minHeight: 96,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
  saveCommentBtn: {
    backgroundColor: COLORS.primaryDark, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  saveCommentBtnDisabled: { opacity: 0.55 },
  saveCommentBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
