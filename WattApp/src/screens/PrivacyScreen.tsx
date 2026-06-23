import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PRIVACY_AR = [
  {
    title: '1. المعلومات التي نجمعها',
    body: 'نجمع المعلومات التالية عند استخدامك للتطبيق:\n• بيانات الحساب: البريد الإلكتروني، رقم الهاتف، واسم المستخدم.\n• بيانات الاستخدام: سجل الحجوزات، جلسات الشحن، والمعاملات المالية.\n• بيانات الموقع: موقعك الجغرافي لعرض المحطات القريبة (بإذنك فقط).\n• بيانات الجهاز: نوع الجهاز، نظام التشغيل، ومعرّف التطبيق.',
  },
  {
    title: '2. كيف نستخدم بياناتك',
    body: 'نستخدم بياناتك للأغراض التالية:\n• تقديم خدمات الشحن والحجز.\n• معالجة المدفوعات وإدارة المحفظة الرقمية.\n• إرسال إشعارات متعلقة بالحجوزات والعروض (بموافقتك).\n• تحسين تجربة المستخدم وتطوير الخدمات.\n• الامتثال للمتطلبات القانونية والتنظيمية.',
  },
  {
    title: '3. مشاركة البيانات',
    body: 'لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك بياناتك فقط مع:\n• مزودي الخدمة الضروريين (مثل بوابات الدفع).\n• السلطات القانونية عند الاقتضاء القانوني.\n• شركاء تشغيل المحطات لإتمام الحجوزات.',
  },
  {
    title: '4. أمان البيانات',
    body: 'نطبق إجراءات أمنية صارمة لحماية بياناتك:\n• تشفير SSL/TLS لجميع الاتصالات.\n• تشفير قواعد البيانات وحماية البيانات الحساسة.\n• مراقبة مستمرة ومراجعات أمنية دورية.\n• تخزين بيانات الجلسة محلياً على جهازك فقط.',
  },
  {
    title: '5. الاحتفاظ بالبيانات',
    body: 'نحتفظ ببياناتك طوال فترة نشاط حسابك. عند حذف الحساب، نحذف بياناتك الشخصية خلال 30 يوماً، مع الاحتفاظ ببعض السجلات المالية لمتطلبات قانونية لمدة 7 سنوات.',
  },
  {
    title: '6. حقوقك',
    body: 'تتمتع بالحقوق التالية فيما يتعلق ببياناتك:\n• الحق في الاطلاع على بياناتك.\n• الحق في تصحيح البيانات غير الدقيقة.\n• الحق في طلب حذف بياناتك.\n• الحق في الاعتراض على معالجة بياناتك.\n• الحق في نقل بياناتك.',
  },
  {
    title: '7. ملفات تعريف الارتباط والتتبع',
    body: 'يستخدم التطبيق التخزين المحلي (AsyncStorage) لحفظ تفضيلاتك وبيانات الجلسة. لا نستخدم ملفات تعريف الارتباط الخارجية أو أدوات التتبع التجارية.',
  },
  {
    title: '8. خصوصية الأطفال',
    body: 'خدماتنا غير موجهة للأشخاص دون سن 18 عاماً. لا نجمع بيانات الأطفال عن قصد. إذا اكتشفنا جمع بيانات طفل، نحذفها فوراً.',
  },
  {
    title: '9. التغييرات على سياسة الخصوصية',
    body: 'قد نحدّث هذه السياسة دورياً. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو الإشعارات. تاريخ آخر تحديث موضح في أعلى هذه الصفحة.',
  },
  {
    title: '10. التواصل معنا',
    body: 'لممارسة حقوقك أو لأي استفسارات حول هذه السياسة، تواصل معنا:\n\nالبريد الإلكتروني: privacy@watt.om\nالعنوان: مسقط، سلطنة عُمان',
  },
];

const PRIVACY_EN = [
  {
    title: '1. Information We Collect',
    body: 'We collect the following information when you use the app:\n• Account data: email address, phone number, and username.\n• Usage data: booking history, charging sessions, and financial transactions.\n• Location data: your geographic location to show nearby stations (with your permission only).\n• Device data: device type, operating system, and app identifier.',
  },
  {
    title: '2. How We Use Your Data',
    body: 'We use your data for the following purposes:\n• Providing charging and booking services.\n• Processing payments and managing the digital wallet.\n• Sending notifications about bookings and offers (with your consent).\n• Improving user experience and developing services.\n• Complying with legal and regulatory requirements.',
  },
  {
    title: '3. Data Sharing',
    body: 'We do not sell your personal data to any third party. We share your data only with:\n• Necessary service providers (such as payment gateways).\n• Legal authorities when legally required.\n• Station operation partners to complete bookings.',
  },
  {
    title: '4. Data Security',
    body: 'We apply strict security measures to protect your data:\n• SSL/TLS encryption for all communications.\n• Database encryption and protection of sensitive data.\n• Continuous monitoring and periodic security audits.\n• Session data stored locally on your device only.',
  },
  {
    title: '5. Data Retention',
    body: 'We retain your data for the duration of your account activity. Upon account deletion, we delete your personal data within 30 days, while retaining certain financial records for legal requirements for up to 7 years.',
  },
  {
    title: '6. Your Rights',
    body: 'You have the following rights regarding your data:\n• Right to access your data.\n• Right to correct inaccurate data.\n• Right to request deletion of your data.\n• Right to object to processing of your data.\n• Right to data portability.',
  },
  {
    title: '7. Cookies & Tracking',
    body: 'The app uses local storage (AsyncStorage) to save your preferences and session data. We do not use external cookies or commercial tracking tools.',
  },
  {
    title: '8. Children\'s Privacy',
    body: 'Our services are not directed at persons under 18 years of age. We do not intentionally collect data from children. If we discover that a child\'s data has been collected, we will delete it immediately.',
  },
  {
    title: '9. Changes to This Policy',
    body: 'We may update this policy periodically. We will notify you of any material changes via email or in-app notifications. The date of the last update is shown at the top of this page.',
  },
  {
    title: '10. Contact Us',
    body: 'To exercise your rights or for any inquiries about this policy, contact us:\n\nEmail: privacy@watt.om\nAddress: Muscat, Sultanate of Oman',
  },
];

export default function PrivacyScreen({ visible, onClose }: Props) {
  const { isRTL } = useLang();
  const sections = isRTL ? PRIVACY_AR : PRIVACY_EN;
  const title = isRTL ? 'سياسة الخصوصية' : 'Privacy Policy';
  const updated = isRTL ? 'آخر تحديث: يناير 2025' : 'Last updated: January 2025';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introBadge}>
            <Text style={styles.introEmoji}>🔒</Text>
            <Text style={styles.introTitle}>{title}</Text>
            <Text style={styles.introDate}>{updated}</Text>
          </View>

          <View style={styles.commitmentCard}>
            <Text style={styles.commitmentText}>
              {isRTL
                ? 'خصوصيتك تهمنا. نلتزم بحماية بياناتك الشخصية والتعامل معها بشفافية تامة.'
                : 'Your privacy matters to us. We are committed to protecting your personal data and handling it with full transparency.'}
            </Text>
          </View>

          {sections.map((s, i) => (
            <View key={i} style={styles.section}>
              <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{s.title}</Text>
              <Text style={[styles.sectionBody, { textAlign: isRTL ? 'right' : 'left' }]}>{s.body}</Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 Watt. All rights reserved.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, color: COLORS.text },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  content: { padding: 20, gap: 4 },
  introBadge: {
    backgroundColor: '#1e3a5f', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 12, gap: 6,
  },
  introEmoji: { fontSize: 40 },
  introTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  introDate: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  commitmentCard: {
    backgroundColor: '#eff6ff', borderRadius: 14, padding: 14,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary, marginBottom: 12,
  },
  commitmentText: { fontSize: 13, color: '#1e40af', lineHeight: 20, fontWeight: '500' },
  section: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  sectionBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 21 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 11, color: COLORS.textTertiary },
});
