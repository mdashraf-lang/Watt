import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { useLang } from '../../context/LanguageContext';
import { ArrowLeftIcon, CheckIcon, ZapIcon } from '../../components/icons';
import ErrorView from '../../components/ErrorView';

type Flagged = {
  id: string;
  customer_name: string | null;
  charger_name: string | null;
  started_at: string;
  ended_at: string | null;
  kwh_delivered: number;
  meter_kwh: number | null;
  cost: number;
};

export default function AdminFlaggedScreen() {
  const { t, isRTL } = useLang();
  const navigation = useNavigation<any>();

  const [rows, setRows]       = useState<Flagged[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc('get_flagged_sessions_detail');
      if (err) throw err;
      setRows((data ?? []) as Flagged[]);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = (id: string) =>
    Alert.alert(t.flag_resolve_title, t.flag_resolve_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.flag_resolve_confirm,
        onPress: async () => {
          setBusyId(id);
          try {
            const { error: err } = await supabase.rpc('resolve_flagged_session', { p_session: id });
            if (err) throw err;
            setRows(prev => prev.filter(r => r.id !== id));
          } catch (e: any) {
            Alert.alert(t.error, e.message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);

  const align = { textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right' };

  const renderItem = ({ item }: { item: Flagged }) => {
    const meter = item.meter_kwh ?? 0;
    const billed = item.kwh_delivered ?? 0;
    const diff = meter - billed;
    const pct = billed > 0 ? Math.round((diff / billed) * 100) : 0;
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, align]} numberOfLines={1}>{item.customer_name || '—'}</Text>
            <Text style={[s.charger, align]} numberOfLines={1}>{item.charger_name || '—'}</Text>
          </View>
          <View style={s.warnBadge}>
            <Text style={s.warnBadgeText}>{pct > 0 ? `+${pct}%` : `${pct}%`}</Text>
          </View>
        </View>

        {/* Meter vs billed */}
        <View style={s.compareRow}>
          <View style={s.compareCell}>
            <Text style={s.compareLabel}>{t.flag_meter}</Text>
            <Text style={s.compareValue}>{meter.toFixed(2)} kWh</Text>
          </View>
          <View style={s.compareCell}>
            <Text style={s.compareLabel}>{t.flag_billed}</Text>
            <Text style={s.compareValue}>{billed.toFixed(2)} kWh</Text>
          </View>
          <View style={s.compareCell}>
            <Text style={s.compareLabel}>{t.flag_cost}</Text>
            <Text style={s.compareValue}>{item.cost.toFixed(3)}</Text>
          </View>
        </View>

        <Text style={s.date}>
          {new Date(item.started_at).toLocaleString()}
        </Text>

        <TouchableOpacity style={s.resolveBtn} onPress={() => resolve(item.id)} disabled={busyId === item.id} activeOpacity={0.85}>
          {busyId === item.id
            ? <ActivityIndicator color="#fff" size="small" />
            : <><CheckIcon size={16} color="#fff" strokeWidth={2.5} /><Text style={s.resolveText}>{t.flag_mark_reviewed}</Text></>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeftIcon size={20} color={COLORS.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.flag_title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.infoBanner}>
        <Text style={s.infoText}>{t.flag_intro}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : error ? (
        <ErrorView onRetry={load} />
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><CheckIcon size={30} color={COLORS.success} strokeWidth={2.5} /></View>
          <Text style={s.emptyText}>{t.flag_none}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  infoBanner: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  infoText: { fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 },

  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  charger: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  warnBadge: { backgroundColor: COLORS.errorBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#fecaca' },
  warnBadgeText: { fontSize: 13, fontWeight: '800', color: COLORS.error },

  compareRow: { flexDirection: 'row', gap: 8 },
  compareCell: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  compareLabel: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  compareValue: { fontSize: 13, fontWeight: '800', color: COLORS.text },

  date: { fontSize: 11, color: COLORS.textTertiary },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12 },
  resolveText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
});
