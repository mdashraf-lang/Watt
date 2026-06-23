import React, { useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { COLORS } from '../../constants/colors';
import { ShieldIcon, PhoneIcon, GlobeIcon, LogOutIcon, ZapIcon, XIcon, CheckIcon } from '../../components/icons';

export default function AdminProfileScreen() {
  const { profile, signOut, updateProfile } = useAuth();
  const { t, toggleLanguage } = useLang();

  const [editModal, setEditModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [saving,    setSaving]    = useState(false);

  const openEdit = () => {
    setEditPhone(profile?.phone ?? '');
    setEditModal(true);
  };

  const handleSave = async () => {
    const trimmed = editPhone.trim();
    if (!trimmed) {
      Alert.alert(t.error, t.auth_error_phone);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ phone: trimmed });
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

  const initials = profile?.full_name ? profile.full_name[0].toUpperCase() : 'A';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroDeco1} />
          <View style={styles.heroDeco2} />

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
            <View style={styles.shieldBadge}>
              <ShieldIcon size={11} color="#fff" strokeWidth={2.5} />
            </View>
          </View>

          <Text style={styles.heroName}>{profile?.full_name || 'Admin'}</Text>

          <View style={styles.adminBadge}>
            <ZapIcon size={12} color={COLORS.gold} strokeWidth={2.5} />
            <Text style={styles.adminBadgeText}>{t.admin_profile_badge}</Text>
          </View>
        </View>

        {/* ── Info section ── */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <PhoneIcon size={15} color={COLORS.textSecondary} strokeWidth={2} />
            </View>
            <Text style={styles.infoLabel}>{t.admin_profile_phone}</Text>
            <Text style={styles.infoValue}>{profile?.phone || '—'}</Text>
            <TouchableOpacity style={styles.editChip} onPress={openEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.editChipText}>{t.profile_edit_clean}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.admin_profile_settings}</Text>
          <TouchableOpacity style={[styles.settingRow, styles.settingRowLast]} onPress={toggleLanguage} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconWrap, { backgroundColor: '#eff6ff' }]}>
                <GlobeIcon size={16} color="#3b82f6" strokeWidth={2} />
              </View>
              <Text style={styles.settingLabel}>{t.admin_profile_language}</Text>
            </View>
            <Text style={styles.langToggle}>{t.profile_language_label}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <LogOutIcon size={18} color={COLORS.error} strokeWidth={2} />
          <Text style={styles.logoutText}>{t.profile_logout_clean}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Edit Phone Modal ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !saving && setEditModal(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>{t.profile_edit_phone}</Text>
                <TouchableOpacity onPress={() => !saving && setEditModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={20} color={COLORS.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Input field */}
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <PhoneIcon size={16} color={COLORS.primary} strokeWidth={2} />
                </View>
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={t.profile_edit_phone_ph}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="phone-pad"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                {editPhone.length > 0 && (
                  <TouchableOpacity onPress={() => setEditPhone('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <XIcon size={16} color={COLORS.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <Text style={styles.saveBtnText}>{t.saving}</Text>
                  : <>
                      <CheckIcon size={16} color="#fff" strokeWidth={2.5} />
                      <Text style={styles.saveBtnText}>{t.save}</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    backgroundColor: '#1E1B4B',
    paddingTop: 32, paddingBottom: 40, paddingHorizontal: 24,
    alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  heroDeco1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(139,92,246,0.12)', top: -60, right: -50 },
  heroDeco2: { position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },

  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderWidth: 2.5, borderColor: 'rgba(139,92,246,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#fff' },
  shieldBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#7C3AED',
    borderWidth: 2, borderColor: '#1E1B4B',
    alignItems: 'center', justifyContent: 'center',
  },
  heroName:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  adminBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.gold },

  section: {
    backgroundColor: COLORS.card, borderRadius: 22,
    marginHorizontal: 16, marginTop: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon:  { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  editChip:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: COLORS.primaryBg, borderWidth: 1, borderColor: COLORS.primaryTint },
  editChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  settingRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingRowLast:  { borderBottomWidth: 0 },
  settingLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel:    { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  langToggle:      { fontSize: 12, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: COLORS.errorBg, borderRadius: 18, borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.error },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalHandle:   { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: COLORS.text },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.background, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1.5, borderColor: COLORS.primary,
    marginBottom: 20,
  },
  inputIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  input:     { flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 12 },

  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});
