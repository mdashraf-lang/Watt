import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import OSMMap, { OSMMapHandle, OSMMarkerSpec, OSMRegion as Region } from '../../components/OSMMap';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Station } from '../../types';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import { translateGov, stationDisplayName, stationDisplayAddress } from '../../i18n/govMap';
import { ZapIcon, LocateIcon, XIcon } from '../../components/icons';

const STATUS_COLOR: Record<string, string> = {
  available: COLORS.available,
  busy:      COLORS.busy,
  fault:     COLORS.fault,
  offline:   COLORS.offline,
};

const OMAN_REGION: Region = {
  latitude: 23.588, longitude: 58.383,
  latitudeDelta: 3.5, longitudeDelta: 3.5,
};

export default function AdminMapScreen() {
  const { t, isRTL } = useLang();
  const STATUS_LABEL: Record<string, string> = {
    available: t.admin_map_available,
    busy:      t.admin_map_busy,
    fault:     t.admin_map_fault,
    offline:   t.admin_map_offline,
  };

  const mapRef = useRef<OSMMapHandle>(null);
  const [stations, setStations]   = useState<Station[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [selected, setSelected]   = useState<Station | null>(null);

  useEffect(() => {
    fetchStations();
    requestLocation();

    const channel = supabase
      .channel('admin-stations-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stations' }, payload => {
        setStations(prev =>
          prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStations = async () => {
    const { data } = await supabase.from('stations').select('*').order('name');
    if (data) setStations(data as Station[]);
    setLoading(false);
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        latitudeDelta: 0.08, longitudeDelta: 0.08,
      }, 800);
    }
  };

  // Status summary counts
  const counts = stations.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const SUMMARY = [
    { key: 'available', color: COLORS.available, label: t.admin_map_available },
    { key: 'busy',      color: COLORS.busy,      label: t.admin_map_busy },
    { key: 'fault',     color: COLORS.fault,     label: t.admin_map_fault },
    { key: 'offline',   color: COLORS.offline,   label: t.admin_map_offline },
  ];

  return (
    <View style={styles.root}>
      {/* Map — free OpenStreetMap (no API key); see OSMMap.tsx */}
      <OSMMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={OMAN_REGION}
        markers={stations.map((s): OSMMarkerSpec => ({
          id: s.id,
          latitude: s.latitude, longitude: s.longitude,
          color: STATUS_COLOR[s.status] ?? COLORS.offline,
          icon: 'zap',
        }))}
        onMarkerPress={(id) => {
          const s = stations.find(x => x.id === id);
          if (s) setSelected(s);
        }}
        showsUserLocation
      />

      {/* Top overlay */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        {/* Title bar */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>{t.admin_map_title}</Text>
          {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
          <TouchableOpacity style={styles.locateBtn} onPress={requestLocation}>
            <LocateIcon size={18} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Status summary pills */}
        {!loading && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={[styles.summaryCount, { color: COLORS.text }]}>{stations.length}</Text>
              <Text style={styles.summaryLabel}>{t.admin_map_total}</Text>
            </View>
            {SUMMARY.map(s => (
              <View key={s.key} style={styles.summaryPill}>
                <View style={[styles.summaryDot, { backgroundColor: s.color }]} />
                <Text style={[styles.summaryCount, { color: s.color }]}>{counts[s.key] ?? 0}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Selected station admin card */}
      {selected && (
        <View style={styles.stationCard}>
          <TouchableOpacity style={styles.cardDismiss} onPress={() => setSelected(null)}>
            <XIcon size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Name + status */}
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: STATUS_COLOR[selected.status] + '22' }]}>
              <ZapIcon size={20} color={STATUS_COLOR[selected.status]} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                {stationDisplayName(selected, isRTL)}
              </Text>
              <Text style={[styles.cardGov, { textAlign: isRTL ? 'right' : 'left' }]}>
                {translateGov(selected.governorate, isRTL)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[selected.status] + '22' }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[selected.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLOR[selected.status] }]}>
                {STATUS_LABEL[selected.status]}
              </Text>
            </View>
          </View>

          {/* Info grid */}
          <View style={styles.infoGrid}>
            <InfoCell label={t.admin_station_connectors} value={`${selected.available_connectors} / ${selected.total_connectors}`} />
            <InfoCell label={t.admin_station_power}      value={`${selected.power_kw} kW`} />
            <InfoCell label={t.admin_station_price}      value={`${selected.price_per_kwh.toFixed(3)} OMR`} />
            <InfoCell
              label={t.admin_station_maintenance}
              value={selected.last_maintenance
                ? new Date(selected.last_maintenance).toLocaleDateString()
                : t.admin_station_maintenance_none}
            />
            <InfoCell label={t.admin_station_hours} value={selected.operating_hours} wide />
          </View>
        </View>
      )}
    </View>
  );
}

function InfoCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.infoCell, wide && { width: '100%' }]}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={styles.infoCellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 8, gap: 8,
  },
  titleBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  titleText: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  locateBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryRow: { gap: 8, paddingRight: 4 },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  summaryDot:   { width: 8, height: 8, borderRadius: 4 },
  summaryCount: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  pin: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  stationCard: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: COLORS.card, borderRadius: 22, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  cardDismiss: {
    position: 'absolute', top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14, paddingRight: 28 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardName:  { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardGov:   { fontSize: 12, color: COLORS.textSecondary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 11, fontWeight: '700' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: {
    width: '47%', backgroundColor: COLORS.background,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoCellLabel: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  infoCellValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});
