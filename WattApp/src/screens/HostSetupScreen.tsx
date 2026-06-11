import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList, 'HostSetup'>;
type Route = RouteProp<RootStackParamList, 'HostSetup'>;

const OMAN_REGION: Region = {
  latitude: 23.5880,
  longitude: 58.3829,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const CHARGER_TYPES = ['Type2', 'CCS', 'CHAdeMO', 'GBT'] as const;
const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '18:00', '20:00', '21:00', '22:00', '23:00', '00:00'];

export default function HostSetupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLang();
  const { signUp } = useAuth();
  const { phone, password, fullName } = route.params;

  const [step, setStep] = useState<1 | 2>(1);
  const [mapRegion, setMapRegion] = useState<Region>(OMAN_REGION);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  // Charger details
  const [address, setAddress] = useState('');
  const [chargerType, setChargerType] = useState<'Type2' | 'CCS' | 'CHAdeMO' | 'GBT'>('Type2');
  const [powerKw, setPowerKw] = useState('7.4');
  const [priceKwh, setPriceKwh] = useState('0.025');
  const [availStart, setAvailStart] = useState('08:00');
  const [availEnd, setAvailEnd] = useState('22:00');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const region: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 600);
      }
    })();
  }, []);

  const confirmLocation = () => {
    setSelectedLocation({ lat: mapRegion.latitude, lng: mapRegion.longitude });
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedLocation) return;
    if (!address.trim()) {
      Alert.alert(t.error, t.host_address_label + ' required');
      return;
    }
    const power = parseFloat(powerKw);
    const price = parseFloat(priceKwh);
    if (isNaN(power) || power <= 0) {
      Alert.alert(t.error, t.host_power_kw_label + ' invalid');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert(t.error, t.host_price_kwh_label + ' invalid');
      return;
    }

    try {
      setSubmitting(true);
      // 1. Create the auth user + profile
      await signUp(phone, password, fullName, 'host');

      // 2. Get the new user's session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session not found after sign up');

      // 3. Create the charger listing
      const { error } = await supabase.from('charger_listings').insert({
        host_id: session.user.id,
        address: address.trim(),
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        charger_type: chargerType,
        power_kw: power,
        price_per_kwh: price,
        is_available: true,
        availability_start: availStart,
        availability_end: availEnd,
        description: description.trim() || null,
        total_bookings: 0,
        rating: 0,
        total_ratings: 0,
      });
      if (error) throw error;
      // Navigation handled by AppNavigator on session/profile change
    } catch (e: any) {
      Alert.alert(t.error, e?.message ?? 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.progressTitle}>{t.host_setup_title}</Text>
        <View style={styles.steps}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>
        <Text style={styles.stepLabel}>
          {step === 1 ? t.host_setup_step1 : t.host_setup_step2}
        </Text>
      </View>

      {step === 1 ? (
        /* ── STEP 1: MAP PICKER ── */
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={OMAN_REGION}
            showsUserLocation
            onRegionChangeComplete={r => setMapRegion(r)}
          />
          {/* Fixed crosshair pin */}
          <View style={styles.pinContainer} pointerEvents="none">
            <Text style={styles.pinEmoji}>📍</Text>
          </View>
          <View style={styles.mapBottomCard}>
            <Text style={styles.mapSubtitle}>{t.host_map_subtitle}</Text>
            <View style={styles.coordRow}>
              <Text style={styles.coordText}>
                {mapRegion.latitude.toFixed(5)}, {mapRegion.longitude.toFixed(5)}
              </Text>
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmLocation} activeOpacity={0.85}>
              <Text style={styles.confirmBtnText}>{t.host_map_confirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── STEP 2: CHARGER DETAILS ── */
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label={t.host_address_label}>
            <TextInput
              style={styles.input}
              placeholder={t.host_address_ph}
              placeholderTextColor={COLORS.textTertiary}
              value={address}
              onChangeText={setAddress}
            />
          </Field>

          <Field label={t.host_charger_type_label}>
            <View style={styles.typeRow}>
              {CHARGER_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, chargerType === type && styles.typeChipActive]}
                  onPress={() => setChargerType(type)}
                >
                  <Text style={[styles.typeChipText, chargerType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label={t.host_power_kw_label}>
                <TextInput
                  style={styles.input}
                  placeholder={t.host_power_kw_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                  value={powerKw}
                  onChangeText={setPowerKw}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.host_price_kwh_label}>
                <TextInput
                  style={styles.input}
                  placeholder={t.host_price_kwh_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                  value={priceKwh}
                  onChangeText={setPriceKwh}
                />
              </Field>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label={t.host_avail_start_label}>
                <TimeDropdown value={availStart} onChange={setAvailStart} hours={HOURS} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.host_avail_end_label}>
                <TimeDropdown value={availEnd} onChange={setAvailEnd} hours={HOURS} />
              </Field>
            </View>
          </View>

          <Field label={t.host_description_label}>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={t.host_description_ph}
              placeholderTextColor={COLORS.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </Field>

          {/* Location preview */}
          {selectedLocation && (
            <View style={styles.locationPreview}>
              <Text style={styles.locationPreviewEmoji}>📍</Text>
              <Text style={styles.locationPreviewText}>
                {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </Text>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={styles.changeLocation}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>⚡ {t.host_submit}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8, marginBottom: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>{label}</Text>
      {children}
    </View>
  );
}

function TimeDropdown({ value, onChange, hours }: { value: string; onChange: (v: string) => void; hours: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={[fieldStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={{ color: COLORS.text, fontSize: 15 }}>{value}</Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={fieldStyles.dropdown}>
          {hours.map(h => (
            <TouchableOpacity
              key={h}
              style={[fieldStyles.dropdownItem, value === h && fieldStyles.dropdownItemActive]}
              onPress={() => { onChange(h); setOpen(false); }}
            >
              <Text style={[fieldStyles.dropdownText, value === h && fieldStyles.dropdownTextActive]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    zIndex: 100,
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: COLORS.primary + '15' },
  dropdownText: { fontSize: 14, color: COLORS.text },
  dropdownTextActive: { color: COLORS.primary, fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  progressBar: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  back: { marginBottom: 12 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  progressTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 16 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 6 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepDotActive: { backgroundColor: COLORS.gold },
  stepLine: { flex: 0, width: 32, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  stepLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },

  map: { flex: 1 },
  pinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -44,
  },
  pinEmoji: { fontSize: 36 },
  mapBottomCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  mapSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  coordRow: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  coordText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  confirmBtn: {
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
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  form: { padding: 24, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  typeChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: COLORS.primary },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  locationPreviewEmoji: { fontSize: 18 },
  locationPreviewText: { flex: 1, fontSize: 13, color: COLORS.text },
  changeLocation: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
