import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import type { ChargerListing, Booking } from '../../types';
import {
  ZapIcon, MapPinIcon, CheckIcon, XIcon, StarIcon,
  CalendarIcon, ClockIcon, ChevronRightIcon,
} from '../../components/icons';

export default function InvestorChargerScreen() {
  const { profile } = useAuth();
  const { t } = useLang();

  const [listing, setListing]         = useState<ChargerListing | null | undefined>(undefined);
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState(false);
  const [editModal, setEditModal]     = useState(false);
  const [saving, setSaving]           = useState(false);

  // Edit form
  const [editAddress,   setEditAddress]   = useState('');
  const [editPowerKw,   setEditPowerKw]   = useState('');
  const [editPrice,     setEditPrice]     = useState('');
  const [editStart,     setEditStart]     = useState('08:00');
  const [editEnd,       setEditEnd]       = useState('22:00');
  const [editDesc,      setEditDesc]      = useState('');

  const fetchListing = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: listData } = await supabase
        .from('charger_listings')
        .select('*')
        .eq('host_id', profile.id)
        .maybeSingle();
      setListing(listData as ChargerListing | null);

      if (listData) {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*, station:stations(name)')
          .eq('listing_id', listData.id)
          .order('booked_at', { ascending: false })
          .limit(5);
        setBookings((bData ?? []) as Booking[]);
      }
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  const openEdit = () => {
    if (listing) {
      setEditAddress(listing.address);
      setEditPowerKw(String(listing.power_kw));
      setEditPrice(String(listing.price_per_kwh));
      setEditStart(listing.availability_start ?? '08:00');
      setEditEnd(listing.availability_end ?? '22:00');
      setEditDesc(listing.description ?? '');
    }
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!listing || !editAddress.trim()) {
      Alert.alert(t.error, t.inv_charger_address);
      return;
    }
    setSaving(true);
    try {
      const updates = {
        address: editAddress.trim(),
        power_kw: parseFloat(editPowerKw) || listing.power_kw,
        price_per_kwh: parseFloat(editPrice) || listing.price_per_kwh,
        availability_start: editStart,
        availability_end: editEnd,
        description: editDesc.trim() || undefined,
      };
      const { error } = await supabase
        .from('charger_listings')
        .update({ ...updates, description: editDesc.trim() || null })
        .eq('id', listing.id);
      if (error) throw error;
      setListing(prev => prev ? { ...prev, ...updates } : prev);
      setEditModal(false);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateListing = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { data: app } = await supabase
        .from('charger_applications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from('charger_listings')
        .insert({
          host_id: profile.id,
          address: app ? `${app.city}, ${app.governorate}` : '',
          latitude: 0,
          longitude: 0,
          charger_type: app?.charger_type ?? 'Type2',
          power_kw: app?.power_kw ?? 7.4,
          price_per_kwh: 0.025,
          is_available: false,
        })
        .select()
        .single();
      if (error) throw error;
      setListing(data as ChargerListing);
      openEdit();
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!listing) return;
    if (!listing.address || listing.address === '' || listing.price_per_kwh === 0) {
      Alert.alert(t.warning, t.inv_charger_no_listing_sub);
      openEdit();
      return;
    }
    setToggling(true);
    try {
      const newVal = !listing.is_available;
      const { error } = await supabase
        .from('charger_listings')
        .update({ is_available: newVal })
        .eq('id', listing.id);
      if (error) throw error;
      setListing(prev => prev ? { ...prev, is_available: newVal } : prev);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setToggling(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── No listing yet ─────────────────────────────────────────────
  if (!listing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.inv_charger_tab}</Text>
          <View style={styles.headerIcon}>
            <ZapIcon size={22} color={COLORS.primary} strokeWidth={2} />
          </View>
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <ZapIcon size={40} color={COLORS.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.inv_congratulations}</Text>
          <Text style={styles.emptySub}>{t.inv_congratulations_sub}</Text>
          <TouchableOpacity
            style={[styles.setupBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreateListing}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.setupBtnText}>{t.inv_charger_setup_btn}</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Full charger management ────────────────────────────────────
  const isOnline = listing.is_available;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.inv_charger_tab}</Text>
          <TouchableOpacity style={styles.editHeaderBtn} onPress={openEdit} activeOpacity={0.8}>
            <Text style={styles.editHeaderBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Status hero card */}
        <View style={[styles.heroCard, isOnline ? styles.heroOnline : styles.heroOffline]}>
          <View style={styles.heroLeft}>
            <View style={[styles.heroStatusDot, { backgroundColor: isOnline ? COLORS.success : COLORS.textTertiary }]} />
            <View>
              <Text style={styles.heroStatusText}>
                {isOnline ? t.inv_charger_status_online : t.inv_charger_status_offline}
              </Text>
              <Text style={styles.heroType}>{listing.charger_type} · {listing.power_kw} kW</Text>
            </View>
          </View>
          <View style={styles.heroToggleWrap}>
            {toggling ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox value={String(listing.total_bookings)} label={t.host_today_bookings} color={COLORS.primary} />
          <StatBox value={`${listing.price_per_kwh} OMR`} label={t.host_charger_price} color={COLORS.gold} />
          <StatBox
            value={listing.rating > 0 ? listing.rating.toFixed(1) : '—'}
            label={t.host_rating_label}
            color="#F59E0B"
          />
        </View>

        {/* Charger info card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.host_charger_info}</Text>
          <InfoRow icon="⚡" label={t.host_charger_type}  value={listing.charger_type} />
          <InfoRow icon="🔋" label={t.host_charger_power} value={`${listing.power_kw} kW`} />
          <InfoRow icon="💰" label={t.host_charger_price} value={`${listing.price_per_kwh} OMR/kWh`} />
          <InfoRow icon="🕐" label={t.host_charger_hours} value={`${listing.availability_start ?? '08:00'} – ${listing.availability_end ?? '22:00'}`} />
          <InfoRow icon="📍" label={t.host_location_label} value={listing.address} last />
        </View>

        {/* Description */}
        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.inv_charger_desc}</Text>
            <Text style={styles.descText}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Recent bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.inv_charger_recent_bookings}</Text>
          {bookings.length === 0 ? (
            <View style={styles.noBookingsWrap}>
              <CalendarIcon size={28} color={COLORS.textTertiary} strokeWidth={1.5} />
              <Text style={styles.noBookingsTitle}>{t.inv_charger_no_bookings}</Text>
              <Text style={styles.noBookingsSub}>{t.inv_charger_no_bookings_sub}</Text>
            </View>
          ) : (
            bookings.map(b => (
              <View key={b.id} style={styles.bookingRow}>
                <View style={styles.bookingIconWrap}>
                  <CalendarIcon size={16} color={COLORS.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingDate}>{new Date(b.booked_at).toLocaleDateString()} · {new Date(b.booked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={styles.bookingMeta}>{b.duration_minutes} min · {b.estimated_cost?.toFixed(3) ?? '—'} OMR</Text>
                </View>
                <View style={[styles.bookingBadge, b.status === 'completed' ? styles.badgeDone : styles.badgePending]}>
                  <Text style={[styles.bookingBadgeText, b.status === 'completed' ? styles.badgeDoneText : styles.badgePendingText]}>
                    {b.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>{t.inv_charger_edit_modal}</Text>
                  <TouchableOpacity onPress={() => setEditModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <XIcon size={20} color={COLORS.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <EditField label={t.inv_charger_address} required>
                  <TextInput style={styles.input} value={editAddress} onChangeText={setEditAddress}
                    placeholder={t.inv_charger_address_ph} placeholderTextColor={COLORS.textTertiary} returnKeyType="next" />
                </EditField>

                <EditField label={t.host_charger_power}>
                  <TextInput style={styles.input} value={editPowerKw} onChangeText={setEditPowerKw}
                    placeholder={t.inv_charger_power_ph} placeholderTextColor={COLORS.textTertiary}
                    keyboardType="decimal-pad" returnKeyType="next" />
                </EditField>

                <EditField label={t.host_charger_price}>
                  <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice}
                    placeholder={t.inv_charger_price_ph} placeholderTextColor={COLORS.textTertiary}
                    keyboardType="decimal-pad" returnKeyType="next" />
                </EditField>

                <View style={styles.timeRow}>
                  <View style={[styles.editField, { flex: 1 }]}>
                    <Text style={styles.editFieldLabel}>{t.inv_charger_avail_start}</Text>
                    <TextInput style={styles.input} value={editStart} onChangeText={setEditStart}
                      placeholder="08:00" placeholderTextColor={COLORS.textTertiary} returnKeyType="next" />
                  </View>
                  <View style={[styles.editField, { flex: 1 }]}>
                    <Text style={styles.editFieldLabel}>{t.inv_charger_avail_end}</Text>
                    <TextInput style={styles.input} value={editEnd} onChangeText={setEditEnd}
                      placeholder="22:00" placeholderTextColor={COLORS.textTertiary} returnKeyType="next" />
                  </View>
                </View>

                <EditField label={t.inv_charger_desc} last>
                  <TextInput style={[styles.input, { minHeight: 64 }]} value={editDesc} onChangeText={setEditDesc}
                    placeholder={t.inv_charger_desc_ph} placeholderTextColor={COLORS.textTertiary}
                    multiline textAlignVertical="top" returnKeyType="done" />
                </EditField>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave} disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>{t.inv_charger_save}</Text>
                  }
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function EditField({ label, required, last, children }: { label: string; required?: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.editField, last && styles.editFieldLast]}>
      <Text style={styles.editFieldLabel}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerIcon:  { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  editHeaderBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: COLORS.primaryBg, borderWidth: 1, borderColor: COLORS.primaryTint },
  editHeaderBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Empty / setup state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 32, backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  setupBtn:   { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },
  setupBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Hero card
  heroCard: { marginHorizontal: 16, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1 },
  heroOnline:  { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primaryTint },
  heroOffline: { backgroundColor: COLORS.backgroundAlt, borderColor: COLORS.border },
  heroLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroStatusDot: { width: 12, height: 12, borderRadius: 6 },
  heroStatusText: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  heroType:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  heroToggleWrap: { width: 60, alignItems: 'center' },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, gap: 10 },
  statBox:  { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statValue:{ fontSize: 15, fontWeight: '800', marginBottom: 2 },
  statLabel:{ fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },

  // Section
  section: { backgroundColor: COLORS.card, borderRadius: 20, marginHorizontal: 16, marginBottom: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },

  // Info rows
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  infoRowLast: { borderBottomWidth: 0 },
  infoIcon:    { fontSize: 16, width: 24 },
  infoLabel:   { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue:   { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right', flex: 1.2 },
  descText:    { fontSize: 14, color: COLORS.text, lineHeight: 21 },

  // Booking rows
  noBookingsWrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noBookingsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  noBookingsSub:   { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  bookingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  bookingIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  bookingDate: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  bookingMeta: { fontSize: 11, color: COLORS.textSecondary },
  bookingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeDone:    { backgroundColor: COLORS.successBg },
  badgePending: { backgroundColor: COLORS.goldBg },
  bookingBadgeText: { fontSize: 10, fontWeight: '700' },
  badgeDoneText:    { color: COLORS.success },
  badgePendingText: { color: COLORS.gold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
  modalHandle:  { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitleRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.text },
  editField:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  editFieldLast:{ borderBottomWidth: 0, marginBottom: 16 },
  editFieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { fontSize: 15, color: COLORS.text, paddingVertical: Platform.OS === 'ios' ? 4 : 2 },
  timeRow: { flexDirection: 'row', gap: 12 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
