import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import type { ChargerListing } from '../types';

export default function HostChargerScreen() {
  const { profile } = useAuth();
  const { t } = useLang();

  const [listing, setListing] = useState<ChargerListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editPrice, setEditPrice] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('charger_listings')
        .select('*')
        .eq('host_id', profile.id)
        .single();
      if (data) {
        setListing(data as ChargerListing);
        setEditPrice(String(data.price_per_kwh));
        setEditStart(data.availability_start ?? '08:00');
        setEditEnd(data.availability_end ?? '22:00');
        setEditDesc(data.description ?? '');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [profile]);

  const toggleAvailability = async () => {
    if (!listing) return;
    setToggling(true);
    const { error } = await supabase
      .from('charger_listings')
      .update({ is_available: !listing.is_available })
      .eq('id', listing.id);
    if (!error) setListing(l => l ? { ...l, is_available: !l.is_available } : l);
    setToggling(false);
  };

  const saveEdits = async () => {
    if (!listing) return;
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t.error, t.host_price_kwh_label + ' invalid');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('charger_listings')
      .update({
        price_per_kwh: price,
        availability_start: editStart,
        availability_end: editEnd,
        description: editDesc.trim() || null,
      })
      .eq('id', listing.id);
    setSaving(false);
    if (error) {
      Alert.alert(t.error, error.message);
    } else {
      setListing(l => l ? { ...l, price_per_kwh: price, availability_start: editStart, availability_end: editEnd, description: editDesc } : l);
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔌</Text>
          <Text style={styles.emptyTitle}>No charger found</Text>
          <Text style={styles.emptySub}>Complete setup to see your charger here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = listing.is_available ? COLORS.success : COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>{t.host_charger_title}</Text>
          <TouchableOpacity onPress={() => setEditing(e => !e)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>{editing ? t.cancel : t.host_edit_charger}</Text>
          </TouchableOpacity>
        </View>

        {/* Status + toggle */}
        <View style={styles.card}>
          <View style={styles.statusBanner}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {listing.is_available ? t.host_charger_status_online : t.host_charger_status_offline}
            </Text>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t.host_availability_toggle}</Text>
            {toggling
              ? <ActivityIndicator color={COLORS.primary} />
              : (
                <Switch
                  value={listing.is_available}
                  onValueChange={toggleAvailability}
                  trackColor={{ true: COLORS.success, false: COLORS.border }}
                  thumbColor="#fff"
                />
              )
            }
          </View>
        </View>

        {/* Map location */}
        <View style={styles.mapCard}>
          <Text style={styles.sectionLabel}>{t.host_location_label}</Text>
          <MapView
            style={styles.miniMap}
            region={{
              latitude: listing.latitude,
              longitude: listing.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker
              coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
              title={profile?.full_name}
            />
          </MapView>
          <Text style={styles.addressText}>{listing.address}</Text>
        </View>

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t.host_charger_info}</Text>
          <InfoRow label={t.host_charger_type} value={listing.charger_type} />
          <InfoRow label={t.host_charger_power} value={`${listing.power_kw} kW`} />

          {editing ? (
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>{t.host_charger_price}</Text>
              <TextInput
                style={styles.editInput}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
              />
            </View>
          ) : (
            <InfoRow label={t.host_charger_price} value={`${listing.price_per_kwh} OMR`} />
          )}

          {editing ? (
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>{t.host_charger_hours}</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={editStart}
                  onChangeText={setEditStart}
                  placeholder="08:00"
                />
                <Text style={{ color: COLORS.textSecondary, paddingHorizontal: 8 }}>–</Text>
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={editEnd}
                  onChangeText={setEditEnd}
                  placeholder="22:00"
                />
              </View>
            </View>
          ) : (
            <InfoRow label={t.host_charger_hours} value={`${listing.availability_start ?? '08:00'} – ${listing.availability_end ?? '22:00'}`} />
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{listing.total_bookings}</Text>
            <Text style={styles.statLbl}>{t.host_sessions_label}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>
              {listing.total_ratings > 0 ? `${listing.rating.toFixed(1)} ⭐` : '—'}
            </Text>
            <Text style={styles.statLbl}>
              {listing.total_ratings > 0 ? `${listing.total_ratings} ratings` : t.host_no_rating}
            </Text>
          </View>
        </View>

        {/* Description */}
        {editing ? (
          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>{t.host_description_label}</Text>
            <TextInput
              style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              placeholder={t.host_description_ph}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>
        ) : listing.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.descText}>{listing.description}</Text>
          </View>
        ) : null}

        {editing && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveEdits}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{t.save}</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 14, color: COLORS.textSecondary },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  editBtn: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  mapCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  miniMap: { width: '100%', height: 140 },
  addressText: { padding: 12, fontSize: 13, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statVal: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  descText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  editField: { gap: 6 },
  editFieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  editInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
