import React, { useRef, useState } from 'react';
import {
  Dimensions, FlatList, StyleSheet, Text,
  TouchableOpacity, View, ViewToken,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { COLORS } from '../constants/colors';
import { useLang } from '../context/LanguageContext';
import { ZapIcon, MapPinIcon, WalletIcon } from '../components/icons';

const { width, height } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useLang();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const slides = [
    {
      id: '1',
      Icon: ZapIcon,
      iconColor: COLORS.gold,
      bg: 'rgba(245,158,11,0.15)',
      borderColor: 'rgba(245,158,11,0.3)',
      title: t.splash_slide1_title,
      subtitle: t.splash_slide1_sub,
    },
    {
      id: '2',
      Icon: MapPinIcon,
      iconColor: '#60a5fa',
      bg: 'rgba(96,165,250,0.15)',
      borderColor: 'rgba(96,165,250,0.3)',
      title: t.splash_slide2_title,
      subtitle: t.splash_slide2_sub,
    },
    {
      id: '3',
      Icon: WalletIcon,
      iconColor: '#34d399',
      bg: 'rgba(52,211,153,0.15)',
      borderColor: 'rgba(52,211,153,0.3)',
      title: t.splash_slide3_title,
      subtitle: t.splash_slide3_sub,
    },
  ];

  const onViewChange = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      navigation.navigate('RoleSelect');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Decorative background circles */}
      <View style={[styles.decoCircle, styles.decoCircleTopRight]} />
      <View style={[styles.decoCircle, styles.decoCircleBottomLeft]} />
      <View style={[styles.decoCircle, styles.decoCircleCenter]} />

      {/* Brand mark */}
      <View style={styles.brandSection}>
        <View style={styles.logoContainer}>
          <View style={styles.logoRing}>
            <ZapIcon size={44} color={COLORS.gold} strokeWidth={2} />
          </View>
          <View style={styles.logoGlow} />
        </View>
        <Text style={styles.logoText}>WATT</Text>
        <Text style={styles.logoTagline}>{t.app_tagline}</Text>
      </View>

      {/* Feature slides */}
      <FlatList
        ref={flatRef}
        data={slides}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewChange}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={styles.slideList}
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

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>
            {activeIndex < slides.length - 1 ? t.splash_next : t.splash_start}
          </Text>
        </TouchableOpacity>

        {activeIndex < slides.length - 1 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('RoleSelect')}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>{t.splash_skip}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Decorative background
  decoCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decoCircleTopRight: {
    width: 320,
    height: 320,
    top: -90,
    right: -90,
  },
  decoCircleBottomLeft: {
    width: 240,
    height: 240,
    bottom: 140,
    left: -90,
  },
  decoCircleCenter: {
    width: 180,
    height: 180,
    top: height * 0.28,
    right: -50,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },

  // Brand
  brandSection: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 8,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginBottom: 6,
  },
  logoTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },

  // Slides
  slideList: { flexGrow: 0 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 24,
    gap: 16,
  },
  slideIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },
  slideSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 28,
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },

  // Footer
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 52,
    gap: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: COLORS.goldDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
});
