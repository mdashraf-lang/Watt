import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Investor'>;

const GOVERNORATES = [
  'مسقط', 'الداخلية', 'الباطنة الشمالية', 'الباطنة الجنوبية',
  'الشرقية الشمالية', 'الشرقية الجنوبية', 'الظاهرة', 'الوسطى',
  'مسندم', 'البريمي', 'ظفار',
];
const LOCATION_TYPES = [
  { key: 'mall', label: '🛍️ مول تجاري' },
  { key: 'hotel', label: '🏨 فندق' },
  { key: 'hospital', label: '🏥 مستشفى' },
  { key: 'university', label: '🎓 جامعة' },
  { key: 'residential', label: '🏘️ سكني' },
  { key: 'commercial', label: '🏢 تجاري' },
  { key: 'fuel_station', label: '⛽ محطة وقود' },
  { key: 'other', label: '📍 أخرى' },
];
const PACKAGES = [
  { key: 'basic', label: 'الأساسية', price: 15, features: ['1-2 شاحن', 'دعم أساسي', 'تقارير شهرية'] },
  { key: 'pro', label: 'الاحترافية', price: 50, features: ['غير محدود', 'دعم 24/7', 'تقارير لحظية', 'واجهة متقدمة'] },
];

export default function InvestorScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [wilayat, setWilayat] = useState('');
  const [chargerCount, setChargerCount] = useState(2);
  const [energySource, setEnergySource] = useState('grid');
  const [description, setDescription] = useState('');
  const [packageType, setPackageType] = useState('basic');
  const [showGovPicker, setShowGovPicker] = useState(false);

  // Revenue estimation
  const priceKwh = 0.028;
  const rawMonthly = chargerCount * 6 * 4 * 1.5 * 22 * priceKwh * 30;
  const netMonthly = rawMonthly * 0.9;
  const packageCost = packageType === 'basic' ? 250 : 400;
  const recovery = netMonthly > 0 ? (packageCost / netMonthly).toFixed(1) : '-';

  const handleSubmit = async () => {
    if (!locationName || !locationType || !governorate) {
      Alert.alert('تنبيه', 'يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('investor_applications').insert({
        user_id: profile?.id,
        full_name: fullName,
        phone,
        email: email || null,
        location_name: locationName,
        location_type: locationType,
        governorate,
        wilayat: wilayat || null,
        charger_count: chargerCount,
        energy_source: energySource as any,
        description: description || null,
        package_type: packageType as any,
        watt_box_option: 'buy',
        status: 'pending',
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successScreen}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>تم إرسال طلبك!</Text>
          <Text style={styles.successSub}>سيتواصل معك فريق Watt خلال 48 ساعة لمناقشة التفاصيل</Text>
          <View style={styles.successSteps}>
            {['مراجعة الطلب', 'زيارة الموقع', 'توقيع العقد', 'تركيب الشاحن'].map((s, i) => (
              <View key={i} style={styles.successStep}>
                <View style={styles.successStepNum}><Text style={styles.successStepNumText}>{i + 1}</Text></View>
                <Text style={styles.successStepLabel}>{s}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلب استثمار</Text>
        <Text style={styles.stepLabel}>{step}/3</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>

          {step === 1 && (
            <>
              {/* Revenue estimator */}
              <View style={styles.estimatorCard}>
                <Text style={styles.estimatorTitle}>💰 آلة حاسبة الأرباح</Text>
                <Text style={styles.estimatorLabel}>عدد الشواحن: {chargerCount}</Text>
                <View style={styles.counterRow}>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setChargerCount(c => Math.max(1, c - 1))}>
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterNum}>{chargerCount}</Text>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setChargerCount(c => Math.min(20, c + 1))}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.estimatorResult}>
                  <View style={styles.estimatorItem}>
                    <Text style={styles.estimatorItemVal}>{rawMonthly.toFixed(0)}</Text>
                    <Text style={styles.estimatorItemLabel}>إيراد شهري (OMR)</Text>
                  </View>
                  <View style={styles.estimatorDivider} />
                  <View style={styles.estimatorItem}>
                    <Text style={[styles.estimatorItemVal, { color: COLORS.primary }]}>{netMonthly.toFixed(0)}</Text>
                    <Text style={styles.estimatorItemLabel}>صافي ربح (OMR)</Text>
                  </View>
                  <View style={styles.estimatorDivider} />
                  <View style={styles.estimatorItem}>
                    <Text style={styles.estimatorItemVal}>{recovery}</Text>
                    <Text style={styles.estimatorItemLabel}>أشهر للاسترداد</Text>
                  </View>
                </View>
                <Text style={styles.estimatorNote}>* يأخذ Watt عمولة 10% من الإيرادات</Text>
              </View>

              {/* Personal info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>المعلومات الشخصية</Text>
                <FormInput label="الاسم الكامل *" value={fullName} onChangeText={setFullName} placeholder="محمد أحمد" />
                <FormInput label="رقم الهاتف *" value={phone} onChangeText={setPhone} placeholder="+968 9xxx xxxx" keyboardType="phone-pad" />
                <FormInput label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="example@email.com" keyboardType="email-address" />
              </View>
            </>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>بيانات الموقع</Text>
              <FormInput label="اسم الموقع *" value={locationName} onChangeText={setLocationName} placeholder="مثال: فندق صلالة بيتش" />

              <Text style={styles.inputLabel}>نوع الموقع *</Text>
              <View style={styles.typeGrid}>
                {LOCATION_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, locationType === t.key && styles.typeChipActive]}
                    onPress={() => setLocationType(t.key)}
                  >
                    <Text style={[styles.typeChipText, locationType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>المحافظة *</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowGovPicker(!showGovPicker)}>
                <Text style={styles.pickerBtnText}>{governorate || 'اختر المحافظة'}</Text>
                <Text>▾</Text>
              </TouchableOpacity>
              {showGovPicker && (
                <View style={styles.pickerOptions}>
                  {GOVERNORATES.map(g => (
                    <TouchableOpacity key={g} style={styles.pickerOption} onPress={() => { setGovernorate(g); setShowGovPicker(false); }}>
                      <Text style={[styles.pickerOptionText, governorate === g && { color: COLORS.primary, fontWeight: '700' }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <FormInput label="الولاية" value={wilayat} onChangeText={setWilayat} placeholder="اختياري" />

              <Text style={styles.inputLabel}>مصدر الطاقة</Text>
              <View style={styles.energyRow}>
                {[{ k: 'grid', l: '⚡ شبكة كهربائية' }, { k: 'solar', l: '☀️ طاقة شمسية' }, { k: 'hybrid', l: '🔀 هجين' }].map(e => (
                  <TouchableOpacity key={e.k} style={[styles.energyChip, energySource === e.k && styles.energyChipActive]} onPress={() => setEnergySource(e.k)}>
                    <Text style={[styles.energyChipText, energySource === e.k && styles.energyChipTextActive]}>{e.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>وصف الموقع</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="أضف أي معلومات إضافية عن الموقع..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                textAlign="right"
              />
            </View>
          )}

          {step === 3 && (
            <>
              {/* Package selection */}
              <Text style={styles.packagesTitle}>اختر الباقة المناسبة</Text>
              {PACKAGES.map(pkg => (
                <TouchableOpacity
                  key={pkg.key}
                  style={[styles.packageCard, packageType === pkg.key && styles.packageCardActive]}
                  onPress={() => setPackageType(pkg.key)}
                  activeOpacity={0.85}
                >
                  <View style={styles.packageTop}>
                    <View style={styles.packageInfo}>
                      <Text style={styles.packageName}>الباقة {pkg.label}</Text>
                      <Text style={styles.packagePrice}>{pkg.price} OMR/شهر</Text>
                    </View>
                    <View style={[styles.packageSelector, packageType === pkg.key && styles.packageSelectorActive]}>
                      {packageType === pkg.key && <View style={styles.packageSelectorInner} />}
                    </View>
                  </View>
                  <View style={styles.packageFeatures}>
                    {pkg.features.map(f => (
                      <View key={f} style={styles.featureRow}>
                        <Text style={styles.featureCheck}>✓</Text>
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}

              {/* Watt Box */}
              <View style={styles.wattBoxCard}>
                <Text style={styles.wattBoxEmoji}>📦</Text>
                <View style={styles.wattBoxInfo}>
                  <Text style={styles.wattBoxTitle}>Watt Box</Text>
                  <Text style={styles.wattBoxSub}>الجهاز الذكي لإدارة الشحن</Text>
                </View>
                <Text style={styles.wattBoxPrice}>350 OMR</Text>
              </View>

              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>ملخص الطلب</Text>
                <SummaryRow label="الباقة" value={`الباقة ${PACKAGES.find(p => p.key === packageType)?.label} · ${PACKAGES.find(p => p.key === packageType)?.price} OMR/شهر`} />
                <SummaryRow label="الموقع" value={locationName || 'لم يُحدد'} />
                <SummaryRow label="المحافظة" value={governorate || 'لم يُحدد'} />
                <SummaryRow label="عدد الشواحن" value={String(chargerCount)} />
                <SummaryRow label="صافي الربح المتوقع" value={`${netMonthly.toFixed(0)} OMR/شهر`} bold />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {step < 3 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>التالي</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.submitBtnText}>إرسال الطلب 🚀</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function FormInput({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboardType}
        textAlign="right"
      />
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontWeight: '800', color: COLORS.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: COLORS.text },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  stepLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  progressBar: { height: 4, backgroundColor: COLORS.border },
  progressFill: { height: 4, backgroundColor: COLORS.gold },
  estimatorCard: {
    backgroundColor: '#fefce8', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: '#fde68a',
  },
  estimatorTitle: { fontSize: 16, fontWeight: '800', color: '#92400e', textAlign: 'right', marginBottom: 12 },
  estimatorLabel: { fontSize: 13, color: '#b45309', textAlign: 'right', marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
  counterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  counterNum: { fontSize: 28, fontWeight: '800', color: COLORS.text, minWidth: 40, textAlign: 'center' },
  estimatorResult: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 8 },
  estimatorItem: { flex: 1, alignItems: 'center' },
  estimatorItemVal: { fontSize: 22, fontWeight: '800', color: COLORS.gold },
  estimatorItemLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  estimatorDivider: { width: 1, backgroundColor: COLORS.border },
  estimatorNote: { fontSize: 11, color: '#b45309', textAlign: 'right', marginTop: 8 },
  section: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'right', marginBottom: 6 },
  textInput: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  typeChipTextActive: { color: COLORS.primary },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  pickerBtnText: { fontSize: 15, color: COLORS.text },
  pickerOptions: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, overflow: 'hidden' },
  pickerOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerOptionText: { fontSize: 14, color: COLORS.text, textAlign: 'right' },
  energyRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  energyChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  energyChipActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  energyChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  energyChipTextActive: { color: COLORS.primary },
  packagesTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'right' },
  packageCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, borderWidth: 2, borderColor: COLORS.border },
  packageCardActive: { borderColor: COLORS.primary, backgroundColor: '#f0fdf4' },
  packageTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  packagePrice: { fontSize: 14, fontWeight: '600', color: COLORS.primary, textAlign: 'right' },
  packageSelector: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  packageSelectorActive: { borderColor: COLORS.primary },
  packageSelectorInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  packageFeatures: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { color: COLORS.primary, fontWeight: '700' },
  featureText: { fontSize: 13, color: COLORS.text },
  wattBoxCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  wattBoxEmoji: { fontSize: 32 },
  wattBoxInfo: { flex: 1 },
  wattBoxTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  wattBoxSub: { fontSize: 12, color: COLORS.textSecondary },
  wattBoxPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  footer: { padding: 16, paddingBottom: 32, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  submitBtn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successEmoji: { fontSize: 72 },
  successTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  successSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  successSteps: { width: '100%', gap: 12, marginTop: 8 },
  successStep: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 14, padding: 12 },
  successStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  successStepNumText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  successStepLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  doneBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 48, marginTop: 8 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
