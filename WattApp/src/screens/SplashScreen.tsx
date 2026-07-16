import React, { useRef, useState } from 'react';
import {
  FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View,
  ViewToken, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GuestStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { ZapIcon, MapPinIcon, WalletIcon } from '../components/icons';

type Nav = NativeStackNavigationProp<GuestStackParamList, 'Landing'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLang();
  const { width, height } = useWindowDimensions();   // responsive: adapts to any device
  const insets = useSafeAreaInsets();                // respects notches / nav bars
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  // Continuous soft glow pulse behind the logo
  const glow = useSharedValue(0);
  React.useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.4,
    transform: [{ scale: 1 + glow.value * 0.18 }],
  }));

  // Gentle float for the decorative background orbs
  const float = useSharedValue(0);
  React.useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);
  const orb1 = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * float.value }, { translateX: 10 * float.value }] }));
  const orb2 = useAnimatedStyle(() => ({ transform: [{ translateY: 16 * float.value }, { translateX: -8 * float.value }] }));

  const slides = [
    { id: '1', Icon: ZapIcon,     iconColor: COLORS.gold, bg: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', title: t.splash_slide1_title, subtitle: t.splash_slide1_sub },
    { id: '2', Icon: MapPinIcon,  iconColor: '#60a5fa',   bg: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.3)', title: t.splash_slide2_title, subtitle: t.splash_slide2_sub },
    { id: '3', Icon: WalletIcon,  iconColor: '#34d399',   bg: 'rgba(52,211,153,0.15)', borderColor: 'rgba(52,211,153,0.3)', title: t.splash_slide3_title, subtitle: t.splash_slide3_sub },
  ];

  const onViewChange = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const goToAuth = () => navigation.navigate('SignIn');

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      goToAuth();
    }
  };

  // Responsive sizing: scale the logo/orbs down a touch on small phones
  const logoSize = Math.min(96, width * 0.26);

  return (
    // Tap anywhere on the screen to continue / advance the slides
    <Pressable style={styles.container} onPress={handleNext}>
      <StatusBar style="light" />

      {/* Animated decorative orbs */}
      <Animated.View style={[styles.decoCircle, { width: 320, height: 320, top: -90, right: -90 }, orb1]} />
      <Animated.View style={[styles.decoCircle, { width: 240, height: 240, bottom: height * 0.18, left: -90 }, orb2]} />
      <Animated.View style={[styles.decoCircle, { width: 180, height: 180, top: height * 0.28, right: -50, backgroundColor: 'rgba(16,185,129,0.12)' }, orb1]} />

      {/* Brand */}
      <View style={[styles.brandSection, { paddingTop: insets.top + 44 }]}>
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoGlow,
              { width: logoSize + 40, height: logoSize + 40, borderRadius: (logoSize + 40) / 2 },
              glowStyle,
            ]}
          />
          <Animated.View
            entering={FadeIn.duration(700).springify()}
            style={[styles.logoRing, { width: logoSize, height: logoSize, borderRadius: logoSize / 2 }]}
          >
            <ZapIcon size={logoSize * 0.46} color={COLORS.gold} strokeWidth={2} />
          </Animated.View>
        </View>
        <Animated.Text entering={FadeInDown.delay(250).duration(600)} style={styles.logoText}>GO WATT</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(400).duration(600)} style={styles.logoTagline}>{t.app_tagline}</Animated.Text>
      </View>

      {/* Feature slides */}
      <Animated.View entering={FadeInUp.delay(550).duration(700)} style={{ flexGrow: 0 }}>
        <FlatList
          ref={flatRef}
          data={slides}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewChange}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={[styles.slideIconWrap, { backgroundColor: item.bg, borderColor: item.borderColor }]}>
                <item.Icon size={54} color={item.iconColor} strokeWidth={1.5} />
              </View>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      <Text style={styles.tapHint}>{t.splash_tap_hint}</Text>

      {/* Actions */}
      <Animated.View
        entering={FadeInUp.delay(650).duration(700)}
        style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}
      >
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>
            {activeIndex < slides.length - 1 ? t.splash_next : t.splash_start}
          </Text>
        </TouchableOpacity>

        {activeIndex < slides.length - 1 ? (
          <TouchableOpacity onPress={goToAuth} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t.splash_skip}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate('GuestTabs')} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t.auth_browse_guest} →</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark, alignItems: 'center', overflow: 'hidden' },

  decoCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.06)' },

  brandSection: { alignItems: 'center', paddingBottom: 8 },
  logoContainer: { position: 'relative', marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  logoRing: {
    backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoGlow: { position: 'absolute', backgroundColor: 'rgba(16,185,129,0.18)' },
  logoText: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: 8, marginBottom: 6 },
  logoTagline: { fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },

  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingVertical: 24, gap: 16 },
  slideIconWrap: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  slideTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 30 },
  slideSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },

  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tapHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20, letterSpacing: 0.3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 28, backgroundColor: COLORS.gold, borderRadius: 4 },

  footer: { width: '100%', paddingHorizontal: 24, gap: 12, alignItems: 'center', marginTop: 'auto' },
  primaryBtn: {
    width: '100%', backgroundColor: COLORS.gold, borderRadius: 18, paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.goldDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#0F172A', letterSpacing: 0.3 },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  skipText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },
});
