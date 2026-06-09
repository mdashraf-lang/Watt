import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Tabs'>;

const MEMBERSHIP_LABEL: Record<string, string> = {
  standard: 'عضو عادي',
  silver: 'عضو فضي',
  gold: 'عضو ذهبي',
};
const MEMBERSHIP_COLOR: Record<string, string> = {
  standard: COLORS.textSecondary,
  silver: '#94a3b8',
  gold: COLORS.gold,
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut, updateProfile } = useAuth();
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name ?? '');
  const [editCar, setEditCar] = useState(profile?.car_model ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: editName, car_model: editCar });
      setEditModal(false);
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'تراجع', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) return null;

  const memberColor = MEMBERSHIP_COLOR[profile.membership_level];
  const isGold = profile.membership_level === 'gold';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Hero */}
        <View style={[styles.hero, isGold && styles.heroGold]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>
              {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
            </Text>
          </View>
          <Text style={[styles.name, isGold && styles.nameGold]}>{profile.full_name || 'مستخدم Watt'}</Text>
          <Text style={[styles.phone, isGold && styles.phoneGold]}>{profile.phone}</Text>
          <View style={[styles.memberBadge, { backgroundColor: memberColor + '30', borderColor: memberColor }]}>
            <Text style={styles.memberEmoji}>{isGold ? '👑' : '⭐'}</Text>
            <Text style={[styles.memberText, { color: memberColor }]}>{MEMBERSHIP_LABEL[profile.membership_level]}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="الجلسات" value={String(profile.total_sessions)} emoji="⚡" />
          <StatBox label="kWh إجمالي" value={profile.total_kwh.toFixed(0)} emoji="🔋" />
          <StatBox label="التقييم" value={String(profile.rating)} emoji="⭐" />
        </View>

        {/* Car */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلوماتي</Text>
          <InfoRow icon="🚗" label="سيارتي" value={profile.car_model || 'لم تُضف بعد'} />
          <InfoRow icon="📱" label="رقم الهاتف" value={profile.phone || '-'} />
          <InfoRow icon="🏅" label="تاريخ الانضمام" value={new Date(profile.created_at).toLocaleDateString('ar-OM')} />
          <TouchableOpacity style={styles.editRow} onPress={() => { setEditName(profile.full_name); setEditCar(profile.car_model ?? ''); setEditModal(true); }}>
            <Text style={styles.editText}>✏️ تعديل المعلومات</Text>
          </TouchableOpacity>
        </View>

        {/* Investor CTA */}
        {!isGold && (
          <TouchableOpacity
            style={styles.investorCard}
            onPress={() => navigation.navigate('Investor')}
            activeOpacity={0.85}
          >
            <View style={styles.investorLeft}>
              <Text style={styles.investorEmoji}>💡</Text>
              <View>
                <Text style={styles.investorTitle}>كن مستثمراً في Watt</Text>
                <Text style={styles.investorSub}>أضف محطة في موقعك وأكسب دخلاً شهرياً</Text>
              </View>
            </View>
            <Text style={styles.investorArrow}>←</Text>
          </TouchableOpacity>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الإعدادات</Text>
          <SettingRow icon="🔔" label="الإشعارات" />
          <SettingRow icon="🔒" label="الأمان والخصوصية" />
          <SettingRow icon="❓" label="المساعدة والدعم" />
          <SettingRow icon="ℹ️" label="عن التطبيق" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.logoutText}>🚪 تسجيل الخروج</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>تعديل المعلومات</Text>

            <Text style={styles.inputLabel}>الاسم الكامل</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="أدخل اسمك"
              placeholderTextColor={COLORS.textTertiary}
            />

            <Text style={styles.inputLabel}>موديل السيارة</Text>
            <TextInput
              style={styles.textInput}
              value={editCar}
              onChangeText={setEditCar}
              placeholder="مثال: Tesla Model 3"
              placeholderTextColor={COLORS.textTertiary}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SettingRow({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Text style={styles.settingArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    backgroundColor: COLORS.primary, paddingTop: 24, paddingBottom: 32,
    paddingHorizontal: 24, alignItems: 'center', gap: 6,
  },
  heroGold: { backgroundColor: '#1a1400' },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarEmoji: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff' },
  nameGold: { color: COLORS.gold },
  phone: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  phoneGold: { color: 'rgba(212,175,55,0.7)' },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginTop: 6,
  },
  memberEmoji: { fontSize: 14 },
  memberText: { fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.card, margin: 16, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  statBox: { flex: 1, alignItems: 'center', padding: 16 },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  section: { backgroundColor: COLORS.card, borderRadius: 20, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'right', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoIcon: { fontSize: 18, width: 26 },
  infoLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  editRow: { paddingTop: 14, alignItems: 'flex-end' },
  editText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  investorCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fefce8', borderRadius: 20, marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderWidth: 1.5, borderColor: COLORS.gold,
  },
  investorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  investorEmoji: { fontSize: 28 },
  investorTitle: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  investorSub: { fontSize: 12, color: '#b45309', marginTop: 2 },
  investorArrow: { fontSize: 20, color: COLORS.gold, transform: [{ scaleX: -1 }] },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: { fontSize: 18 },
  settingLabel: { fontSize: 14, color: COLORS.text },
  settingArrow: { fontSize: 18, color: COLORS.textTertiary },
  logoutBtn: {
    margin: 16, padding: 16, backgroundColor: '#fef2f2',
    borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'right', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'right', marginBottom: 6 },
  textInput: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, textAlign: 'right',
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
