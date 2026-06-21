import React, { useState } from 'react';
import {
  Alert, Linking, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';
import TermsScreen from './TermsScreen';
import PrivacyScreen from './PrivacyScreen';
import {
  BellIcon, ShieldIcon, HelpCircleIcon, InfoIcon, GlobeIcon,
  LogOutIcon, ChevronRightIcon, UserIcon, CarIcon, PhoneIcon,
  AwardIcon, XIcon, CheckIcon, ZapIcon, BatteryChargingIcon, StarIcon,
} from '../components/icons';

const MEMBERSHIP_COLOR: Record<string, string> = {
  standard: COLORS.textSecondary,
  silver:   '#94a3b8',
  gold:     COLORS.gold,
};

export default function ProfileScreen() {
  const { profile, signOut, updateProfile } = useAuth();
  const { t, toggleLanguage } = useLang();

  const [editModal,     setEditModal]     = useState(false);
  const [notifModal,    setNotifModal]    = useState(false);
  const [securityModal, setSecurityModal] = useState(false);
  const [helpModal,     setHelpModal]     = useState(false);
  const [aboutModal,    setAboutModal]    = useState(false);
  const [termsModal,    setTermsModal]    = useState(false);
  const [privacyModal,  setPrivacyModal]  = useState(false);

  const [editName,  setEditName]  = useState(profile?.full_name ?? '');
  const [editPhone, setEditPhone] = useState(profile?.phone ?? '');
  const [editCar,   setEditCar]   = useState(profile?.car_model ?? '');
  const [saving,    setSaving]    = useState(false);

  const [notifPush,    setNotifPush]    = useState(true);
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifCharging,setNotifCharging]= useState(true);
  const [notifPromo,   setNotifPromo]   = useState(false);

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert(t.error, t.auth_error_name);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        full_name: editName.trim(),
        phone: editPhone.trim() || undefined,
        car_model: editCar.trim() || undefined,
      });
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
  const isGold      = profile.membership_level === 'gold';
  const initials    = profile.full_name ? profile.full_name[0].toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.hero, isGold && styles.heroGold]}>
          <View style={styles.heroDeco1} />
          <View style={styles.heroDeco2} />
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, isGold && styles.avatarGold]}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
            <View style={[styles.memberDot, { backgroundColor: memberColor }]} />
          </View>
          <Text style={[styles.heroName, isGold && { color: COLORS.gold }]}>
            {profile.full_name || t.profile_dev_name}
          </Text>
          <Text style={styles.heroPhone}>{profile.phone}</Text>
          <View style={[styles.memberBadge, { borderColor: memberColor, backgroundColor: memberColor + '22' }]}>
            <Text style={styles.memberEmoji}>{isGold ? '👑' : '⭐'}</Text>
            <Text style={[styles.memberText, { color: memberColor }]}>
              {t[`profile_member_${profile.membership_level}` as keyof typeof t] as string}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <StatBox label={t.profile_sessions} value={String(profile.total_sessions)} Icon={ZapIcon}             color={COLORS.primary} />
          <View style={styles.statsDivider} />
          <StatBox label={t.profile_kwh}      value={profile.total_kwh.toFixed(0)}   Icon={BatteryChargingIcon} color="#3b82f6" />
          <View style={styles.statsDivider} />
          <StatBox label={t.profile_rating}   value={String(profile.rating)}          Icon={StarIcon}            color={COLORS.gold} />
        </View>

        {/* My Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile_my_info}</Text>
          <InfoRow Icon={CarIcon}   label={t.profile_car}    value={profile.car_model || t.profile_car_none} />
          <InfoRow Icon={PhoneIcon} label={t.profile_phone}  value={profile.phone || '-'} />
          <InfoRow Icon={AwardIcon} label={t.profile_joined} value={new Date(profile.created_at).toLocaleDateString()} />
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              setEditName(profile.full_name);
              setEditPhone(profile.phone ?? '');
              setEditCar(profile.car_model ?? '');
              setEditModal(true);
            }}
          >
            <Text style={styles.editBtnText}>{t.profile_edit_clean}</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile_settings}</Text>
          <SettingRow Icon={BellIcon}       label={t.profile_notifications} onPress={() => setNotifModal(true)} />
          <SettingRow Icon={ShieldIcon}     label={t.profile_security}      onPress={() => setSecurityModal(true)} />
          <SettingRow Icon={HelpCircleIcon} label={t.profile_help}          onPress={() => setHelpModal(true)} />
          <SettingRow Icon={InfoIcon}       label={t.profile_about}         onPress={() => setAboutModal(true)} />
          <TouchableOpacity style={styles.settingRow} onPress={toggleLanguage} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconWrap, { backgroundColor: '#eff6ff' }]}>
                <GlobeIcon size={16} color="#3b82f6" strokeWidth={2} />
              </View>
              <Text style={styles.settingLabel}>{t.profile_language}</Text>
            </View>
            <Text style={styles.langToggle}>{t.profile_language_label}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <LogOutIcon size={18} color={COLORS.error} strokeWidth={2} />
          <Text style={styles.logoutText}>{t.profile_logout_clean}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Info Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>{t.profile_edit_title}</Text>
              <TouchableOpacity onPress={() => setEditModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <XIcon size={20} color={COLORS.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Full Name */}
            <View style={styles.editField}>
              <View style={styles.editFieldIcon}>
                <UserIcon size={15} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View style={styles.editFieldBody}>
                <Text style={styles.editFieldLabel}>{t.profile_edit_name}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t.profile_edit_name_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.editField}>
              <View style={styles.editFieldIcon}>
                <PhoneIcon size={15} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View style={styles.editFieldBody}>
                <Text style={styles.editFieldLabel}>{t.profile_edit_phone}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={t.profile_edit_phone_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Car Model */}
            <View style={[styles.editField, styles.editFieldLast]}>
              <View style={styles.editFieldIcon}>
                <CarIcon size={15} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View style={styles.editFieldBody}>
                <Text style={styles.editFieldLabel}>{t.profile_edit_car}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editCar}
                  onChangeText={setEditCar}
                  placeholder={t.profile_edit_car_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Save */}
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

      {/* Notifications Modal */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotifModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.notif_title}</Text>
            <ToggleRow label={t.notif_push}     sub={t.notif_push_sub}     value={notifPush}     onToggle={setNotifPush} />
            <ToggleRow label={t.notif_booking}  sub={t.notif_booking_sub}  value={notifBooking}  onToggle={setNotifBooking} />
            <ToggleRow label={t.notif_charging} sub={t.notif_charging_sub} value={notifCharging} onToggle={setNotifCharging} />
            <ToggleRow label={t.notif_promo}    sub={t.notif_promo_sub}    value={notifPromo}    onToggle={setNotifPromo} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Security Modal */}
      <Modal visible={securityModal} transparent animationType="slide" onRequestClose={() => setSecurityModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSecurityModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.security_title}</Text>
            <Text style={styles.sectionMini}>{t.security_account}</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>{t.security_email_label}</Text>
              <Text style={styles.infoCardValue}>{profile?.phone || '—'}</Text>
            </View>
            <Text style={styles.sectionMini}>{t.security_protection}</Text>
            <ProtRow emoji="🔐" label={t.security_ssl}      sub={t.security_ssl_sub} />
            <ProtRow emoji="🚫" label={t.security_no_share} sub={t.security_no_share_sub} />
            <ProtRow emoji="📱" label={t.security_local}    sub={t.security_local_sub} />
            <Text style={styles.sectionMini}>{t.security_danger}</Text>
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

      {/* Help Modal */}
      <Modal visible={helpModal} transparent animationType="slide" onRequestClose={() => setHelpModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setHelpModal(false)}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.help_title}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionMini}>{t.help_faq}</Text>
              <FaqItem q={t.help_q1} a={t.help_a1} />
              <FaqItem q={t.help_q2} a={t.help_a2} />
              <FaqItem q={t.help_q3} a={t.help_a3} />
              <FaqItem q={t.help_q4} a={t.help_a4} />
              <Text style={styles.sectionMini}>{t.help_contact}</Text>
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('https://wa.me/96892421050')} activeOpacity={0.8}>
                <Text style={styles.contactEmoji}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{t.help_whatsapp}</Text>
                  <Text style={styles.contactSub}>{t.help_whatsapp_sub}</Text>
                </View>
                <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@watt.om')} activeOpacity={0.8}>
                <Text style={styles.contactEmoji}>✉️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>{t.help_email_support}</Text>
                  <Text style={styles.contactSub}>{t.help_email_sub}</Text>
                </View>
                <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* About Modal */}
      <Modal visible={aboutModal} transparent animationType="slide" onRequestClose={() => setAboutModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAboutModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.about_title}</Text>
            <View style={styles.aboutHero}>
              <View style={styles.aboutLogoWrap}>
                <ZapIcon size={32} color={COLORS.primary} strokeWidth={2} />
              </View>
              <Text style={styles.aboutAppName}>WATT</Text>
              <Text style={styles.aboutTagline}>{t.about_tagline}</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>{t.about_version} 1.0.0</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>{t.about_desc}</Text>
            <Text style={styles.sectionMini}>{t.about_legal}</Text>
            <TouchableOpacity style={styles.contactRow} activeOpacity={0.8} onPress={() => setTermsModal(true)}>
              <Text style={styles.contactEmoji}>📄</Text>
              <Text style={styles.contactLabel}>{t.about_terms}</Text>
              <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactRow} activeOpacity={0.8} onPress={() => setPrivacyModal(true)}>
              <Text style={styles.contactEmoji}>🔒</Text>
              <Text style={styles.contactLabel}>{t.about_privacy}</Text>
              <ChevronRightIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.copyright}>{t.about_copyright}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      <TermsScreen visible={termsModal} onClose={() => setTermsModal(false)} />
      <PrivacyScreen visible={privacyModal} onClose={() => setPrivacyModal(false)} />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatBox({ label, value, Icon, color }: { label: string; value: string; Icon: React.ComponentType<any>; color: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Icon size={18} color={color} strokeWidth={2} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon size={15} color={COLORS.textSecondary} strokeWidth={2} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SettingRow({ Icon, label, onPress }: { Icon: any; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIconWrap}>
          <Icon size={16} color={COLORS.primary} strokeWidth={2} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <ChevronRightIcon size={18} color={COLORS.borderStrong} strokeWidth={2} />
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

function ProtRow({ emoji, label, sub }: { emoji: string; label: string; sub: string }) {
  return (
    <View style={styles.protRow}>
      <Text style={styles.protEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <CheckIcon size={18} color={COLORS.success} strokeWidth={2.5} />
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqItem} onPress={() => setOpen(!open)} activeOpacity={0.8}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ} numberOfLines={open ? undefined : 1}>{q}</Text>
        <ChevronRightIcon size={16} color={COLORS.primary} strokeWidth={2.5} />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Hero
  hero: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: 24, paddingBottom: 36, paddingHorizontal: 24,
    alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  heroGold: { backgroundColor: '#1a1400' },
  heroDeco1: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -60 },
  heroDeco2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 2.5, borderColor: 'rgba(16,185,129,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGold: { borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(212,175,55,0.15)' },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#fff' },
  memberDot: { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: COLORS.primaryDark },
  heroName:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroPhone: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  memberEmoji: { fontSize: 13 },
  memberText:  { fontSize: 12, fontWeight: '700' },

  // Stats
  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    marginHorizontal: 16, marginTop: -20, borderRadius: 22, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  statsDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Section
  section: { backgroundColor: COLORS.card, borderRadius: 22, marginHorizontal: 16, marginTop: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  editBtn: { paddingTop: 12, alignItems: 'flex-end' },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  langToggle: { fontSize: 12, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: COLORS.errorBg, borderRadius: 18, borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.error },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 44 },
  modalHandle:  { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.text },

  // Edit fields
  editField: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: 14,
  },
  editFieldLast: { borderBottomWidth: 0, marginBottom: 20 },
  editFieldIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  editFieldBody: { flex: 1, gap: 3 },
  editFieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  editInput: { fontSize: 15, color: COLORS.text, paddingVertical: 2 },

  saveBtn:      { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionMini:  { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },

  // Toggle / prot rows
  toggleRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  toggleLabel:{ fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleSub:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  protRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  protEmoji:  { fontSize: 18, width: 28 },

  // Security
  infoCard:      { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  infoCardLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  infoCardValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  deleteBtn:     { marginTop: 8, padding: 14, backgroundColor: COLORS.errorBg, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  deleteBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },

  // Contact / FAQ
  contactRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  contactEmoji:  { fontSize: 20, width: 30 },
  contactLabel:  { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  contactSub:    { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  faqItem:       { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  faqHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ:          { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text, marginRight: 8 },
  faqA:          { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, lineHeight: 20 },

  // About
  aboutHero:    { alignItems: 'center', paddingVertical: 16, gap: 8 },
  aboutLogoWrap:{ width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 1.5, borderColor: COLORS.primaryTint },
  aboutAppName: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: 5 },
  aboutTagline: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  versionBadge: { backgroundColor: COLORS.primaryBg, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primaryTint },
  versionText:  { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  aboutDesc:    { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 4 },
  copyright:    { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', marginTop: 20, paddingBottom: 8 },
});
