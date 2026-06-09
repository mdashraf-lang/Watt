import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Tabs'>;

const MEMBERSHIP_LABEL = (t: any): Record<string, string> => ({
  standard: t.profile_member_standard,
  silver: t.profile_member_silver,
  gold: t.profile_member_gold,
});
const MEMBERSHIP_COLOR: Record<string, string> = {
  standard: COLORS.textSecondary,
  silver: '#94a3b8',
  gold: COLORS.gold,
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut, updateProfile } = useAuth();
  const { t, toggleLanguage } = useLang();
  const [editModal, setEditModal]         = useState(false);
  const [notifModal, setNotifModal]       = useState(false);
  const [securityModal, setSecurityModal] = useState(false);
  const [helpModal, setHelpModal]         = useState(false);
  const [aboutModal, setAboutModal]       = useState(false);
  const [editName, setEditName] = useState(profile?.full_name ?? '');
  const [editCar, setEditCar]   = useState(profile?.car_model ?? '');
  const [saving, setSaving]     = useState(false);

  // Notification toggles (UI only)
  const [notifPush, setNotifPush]       = useState(true);
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifCharging, setNotifCharging] = useState(true);
  const [notifPromo, setNotifPromo]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: editName, car_model: editCar });
      setEditModal(false);
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t.profile_logout_title, t.profile_logout_msg, [
      { text: t.cancel, style: 'cancel' },
      { text: t.profile_logout_confirm, style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) return null;

  const memberColor = MEMBERSHIP_COLOR[profile.membership_level];
  const memberLabel = MEMBERSHIP_LABEL(t);
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
          <Text style={[styles.name, isGold && styles.nameGold]}>{profile.full_name || t.profile_dev_name}</Text>
          <Text style={[styles.phone, isGold && styles.phoneGold]}>{profile.phone}</Text>
          <View style={[styles.memberBadge, { backgroundColor: memberColor + '30', borderColor: memberColor }]}>
            <Text style={styles.memberEmoji}>{isGold ? '👑' : '⭐'}</Text>
            <Text style={[styles.memberText, { color: memberColor }]}>{memberLabel[profile.membership_level]}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={t.profile_sessions} value={String(profile.total_sessions)} emoji="⚡" />
          <StatBox label={t.profile_kwh} value={profile.total_kwh.toFixed(0)} emoji="🔋" />
          <StatBox label={t.profile_rating} value={String(profile.rating)} emoji="⭐" />
        </View>

        {/* Car */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile_my_info}</Text>
          <InfoRow icon="🚗" label={t.profile_car} value={profile.car_model || t.profile_car_none} />
          <InfoRow icon="📱" label={t.profile_phone} value={profile.phone || '-'} />
          <InfoRow icon="🏅" label={t.profile_joined} value={new Date(profile.created_at).toLocaleDateString()} />
          <TouchableOpacity style={styles.editRow} onPress={() => { setEditName(profile.full_name); setEditCar(profile.car_model ?? ''); setEditModal(true); }}>
            <Text style={styles.editText}>{t.profile_edit}</Text>
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
                <Text style={styles.investorTitle}>{t.profile_investor_title}</Text>
                <Text style={styles.investorSub}>{t.profile_investor_sub}</Text>
              </View>
            </View>
            <Text style={styles.investorArrow}>←</Text>
          </TouchableOpacity>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile_settings}</Text>
          <SettingRow icon="🔔" label={t.profile_notifications} onPress={() => setNotifModal(true)} />
          <SettingRow icon="🔒" label={t.profile_security}      onPress={() => setSecurityModal(true)} />
          <SettingRow icon="❓" label={t.profile_help}          onPress={() => setHelpModal(true)} />
          <SettingRow icon="ℹ️" label={t.profile_about}         onPress={() => setAboutModal(true)} />
          <TouchableOpacity style={styles.settingRow} onPress={toggleLanguage} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🌐</Text>
              <Text style={styles.settingLabel}>{t.profile_language}</Text>
            </View>
            <Text style={[styles.settingArrow, { color: COLORS.primary, fontWeight: '700', fontSize: 14 }]}>{t.profile_language_label}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.logoutText}>{t.profile_logout}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.profile_edit_title}</Text>

            <Text style={styles.inputLabel}>{t.profile_edit_name}</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder={t.profile_edit_name_ph}
              placeholderTextColor={COLORS.textTertiary}
            />

            <Text style={styles.inputLabel}>{t.profile_edit_car}</Text>
            <TextInput
              style={styles.textInput}
              value={editCar}
              onChangeText={setEditCar}
              placeholder={t.profile_edit_car_ph}
              placeholderTextColor={COLORS.textTertiary}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? t.saving : t.save}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Notifications Modal ─────────────────────────── */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotifModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.notif_title}</Text>
            <ToggleRow label={t.notif_push} sub={t.notif_push_sub} value={notifPush} onToggle={setNotifPush} />
            <ToggleRow label={t.notif_booking} sub={t.notif_booking_sub} value={notifBooking} onToggle={setNotifBooking} />
            <ToggleRow label={t.notif_charging} sub={t.notif_charging_sub} value={notifCharging} onToggle={setNotifCharging} />
            <ToggleRow label={t.notif_promo} sub={t.notif_promo_sub} value={notifPromo} onToggle={setNotifPromo} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Security & Privacy Modal ─────────────────────── */}
      <Modal visible={securityModal} transparent animationType="slide" onRequestClose={() => setSecurityModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSecurityModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.security_title}</Text>

            <Text style={styles.settingSectionLabel}>{t.security_account}</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>{t.security_email_label}</Text>
              <Text style={styles.infoCardValue}>{profile?.phone || '—'}</Text>
            </View>

            <Text style={styles.settingSectionLabel}>{t.security_protection}</Text>
            <ProtectionRow icon="🔐" label={t.security_ssl} sub={t.security_ssl_sub} />
            <ProtectionRow icon="🚫" label={t.security_no_share} sub={t.security_no_share_sub} />
            <ProtectionRow icon="📱" label={t.security_local} sub={t.security_local_sub} />

            <Text style={styles.settingSectionLabel}>{t.security_danger}</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => Alert.alert(t.security_delete, t.security_delete_msg, [
                { text: t.cancel, style: 'cancel' },
                { text: t.security_delete_confirm, style: 'destructive', onPress: signOut },
              ])}
            >
              <Text style={styles.deleteBtnText}>🗑 {t.security_delete}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Help & Support Modal ─────────────────────────── */}
      <Modal visible={helpModal} transparent animationType="slide" onRequestClose={() => setHelpModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setHelpModal(false)}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.help_title}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.settingSectionLabel}>{t.help_faq}</Text>
              <FaqItem q={t.help_q1} a={t.help_a1} />
              <FaqItem q={t.help_q2} a={t.help_a2} />
              <FaqItem q={t.help_q3} a={t.help_a3} />
              <FaqItem q={t.help_q4} a={t.help_a4} />

              <Text style={styles.settingSectionLabel}>{t.help_contact}</Text>
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('https://wa.me/96892421050')} activeOpacity={0.8}>
                <Text style={styles.contactIcon}>💬</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{t.help_whatsapp}</Text>
                  <Text style={styles.contactSub}>{t.help_whatsapp_sub}</Text>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@watt.om')} activeOpacity={0.8}>
                <Text style={styles.contactIcon}>✉️</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{t.help_email_support}</Text>
                  <Text style={styles.contactSub}>{t.help_email_sub}</Text>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── About Modal ──────────────────────────────────── */}
      <Modal visible={aboutModal} transparent animationType="slide" onRequestClose={() => setAboutModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAboutModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.about_title}</Text>
            <View style={styles.aboutHero}>
              <View style={styles.aboutLogoCircle}>
                <Text style={{ fontSize: 32 }}>⚡</Text>
              </View>
              <Text style={styles.aboutAppName}>WATT</Text>
              <Text style={styles.aboutTagline}>{t.about_tagline}</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>{t.about_version} 1.0.0</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>{t.about_desc}</Text>

            <Text style={styles.settingSectionLabel}>{t.about_legal}</Text>
            <TouchableOpacity style={styles.contactRow} activeOpacity={0.8}>
              <Text style={styles.contactIcon}>📄</Text>
              <Text style={styles.contactLabel}>{t.about_terms}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactRow} activeOpacity={0.8}>
              <Text style={styles.contactIcon}>🔒</Text>
              <Text style={styles.contactLabel}>{t.about_privacy}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <Text style={styles.aboutCopyright}>{t.about_copyright}</Text>
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

function SettingRow({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Text style={styles.settingArrow}>›</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, sub, value, onToggle }: { label: string; sub: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
    </View>
  );
}

function ProtectionRow({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <View style={styles.protectionRow}>
      <Text style={styles.protectionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Text style={{ color: COLORS.primary, fontSize: 16 }}>✓</Text>
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setOpen(!open)} activeOpacity={0.8}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ} numberOfLines={open ? undefined : 1}>{q}</Text>
        <Text style={styles.faqArrow}>{open ? '▾' : '›'}</Text>
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
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

  // Settings modals
  settingSectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  protectionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  protectionIcon: { fontSize: 20, width: 28 },
  infoCard: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  infoCardLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  infoCardValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  deleteBtn: { marginTop: 8, padding: 14, backgroundColor: '#fef2f2', borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  deleteBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  contactIcon: { fontSize: 22, width: 32 },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  contactSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  faqItem: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  faqArrow: { fontSize: 16, color: COLORS.primary, marginLeft: 8 },
  faqA: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, lineHeight: 20 },
  aboutHero: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  aboutLogoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  aboutAppName: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: 4 },
  aboutTagline: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  versionBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  versionText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  aboutDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 4 },
  aboutCopyright: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', marginTop: 20, paddingBottom: 8 },
});
