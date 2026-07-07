import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Text, TouchableOpacity, View, StyleSheet, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';
import {
  MapPinIcon, CalendarIcon, WalletIcon, UserIcon,
  ZapIcon, UsersIcon, TrendingUpIcon, ShieldIcon, StarIcon, CheckIcon,
} from '../components/icons';
import { supabase } from '../lib/supabase';
import type { ChargerListing } from '../types';
import type {
  GuestStackParamList,
  GuestTabParamList,
  CustomerStackParamList,
  CustomerTabParamList,
  AdminTabParamList,
  AdminStackParamList,
  InvestorTabParamList,
  InvestorStackParamList,
} from '../types';

// Auth screens
import LandingScreen       from '../screens/SplashScreen';
import SignInScreen        from '../screens/SignInScreen';
import SignUpScreen        from '../screens/SignUpScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import GuestProfileScreen  from '../screens/GuestProfileScreen';
import GuestLockedScreen   from '../screens/GuestLockedScreen';

// Customer screens
import MapScreen                  from '../screens/MapScreen';
import StationDetailsScreen       from '../screens/StationDetailsScreen';
import BookingScreen              from '../screens/BookingScreen';
import ActiveBookingScreen        from '../screens/ActiveBookingScreen';
import ChargingScreen             from '../screens/ChargingScreen';
import SessionSummaryScreen       from '../screens/SessionSummaryScreen';
import BookingsScreen             from '../screens/BookingsScreen';
import WalletScreen               from '../screens/WalletScreen';
import ProfileScreen              from '../screens/ProfileScreen';
import InvestorApplicationScreen  from '../screens/InvestorApplicationScreen';

// Admin screens
import AdminMapScreen       from '../screens/admin/AdminMapScreen';
import AdminUsersScreen     from '../screens/admin/AdminUsersScreen';
import AdminInvestorsScreen from '../screens/admin/AdminInvestorsScreen';
import AdminProfileScreen   from '../screens/admin/AdminProfileScreen';

// Investor screens
import InvestorChargerScreen  from '../screens/investor/InvestorChargerScreen';
import InvestorEarningsScreen from '../screens/investor/InvestorEarningsScreen';

// Root navigator — switches between Guest, Customer, and Admin
const RootStack      = createNativeStackNavigator();
const GuestStack     = createNativeStackNavigator<GuestStackParamList>();
const GuestTab       = createBottomTabNavigator<GuestTabParamList>();
const CustomerStack  = createNativeStackNavigator<CustomerStackParamList>();
const CustomerTab    = createBottomTabNavigator<CustomerTabParamList>();
const AdminStack     = createNativeStackNavigator<AdminStackParamList>();
const AdminTab       = createBottomTabNavigator<AdminTabParamList>();
const InvestorStack  = createNativeStackNavigator<InvestorStackParamList>();
const InvestorTab    = createBottomTabNavigator<InvestorTabParamList>();

// ── Tab Bar ────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation, accentColor }: BottomTabBarProps & { accentColor: string }) {
  return (
    <View style={tabStyles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel :
          typeof options.title       === 'string' ? options.title       :
          route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const color = isFocused ? accentColor : COLORS.textTertiary;

        return (
          <TouchableOpacity key={route.key} style={tabStyles.tab} onPress={onPress} activeOpacity={0.7}>
            <View style={[tabStyles.iconWrap, isFocused && { backgroundColor: accentColor + '1A' }]}>
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
            </View>
            <Text style={[tabStyles.label, isFocused && { color: accentColor, fontWeight: '700' }]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 16,
  },
  tab:      { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: { width: 52, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 11, fontWeight: '500', color: COLORS.textTertiary },
});

// ── GUEST ─────────────────────────────────────────────────────

function GuestTabs() {
  const { t } = useLang();
  return (
    <GuestTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} accentColor={COLORS.primary} />}
      screenOptions={{ headerShown: false }}
    >
      <GuestTab.Screen
        name="GuestMap"
        component={MapScreen}
        options={{
          tabBarLabel: t.tab_map,
          tabBarIcon: ({ focused, color }) => (
            <MapPinIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <GuestTab.Screen
        name="GuestBookings"
        component={GuestLockedScreen}
        initialParams={{ feature: 'bookings' }}
        options={{
          tabBarLabel: t.tab_bookings,
          tabBarIcon: ({ focused, color }) => (
            <CalendarIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <GuestTab.Screen
        name="GuestWallet"
        component={GuestLockedScreen}
        initialParams={{ feature: 'wallet' }}
        options={{
          tabBarLabel: t.tab_wallet,
          tabBarIcon: ({ focused, color }) => (
            <WalletIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <GuestTab.Screen
        name="GuestProfile"
        component={GuestProfileScreen}
        options={{
          tabBarLabel: t.tab_profile,
          tabBarIcon: ({ focused, color }) => (
            <UserIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </GuestTab.Navigator>
  );
}

function GuestNavigator() {
  return (
    <GuestStack.Navigator screenOptions={{ headerShown: false }}>
      <GuestStack.Screen name="Landing"   component={LandingScreen} />
      <GuestStack.Screen name="SignIn"    component={SignInScreen} />
      <GuestStack.Screen name="SignUp"    component={SignUpScreen} />
      <GuestStack.Screen name="GuestTabs" component={GuestTabs} options={{ animation: 'fade' }} />
    </GuestStack.Navigator>
  );
}

// ── CUSTOMER ──────────────────────────────────────────────────

function CustomerTabs() {
  const { t } = useLang();
  return (
    <CustomerTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} accentColor={COLORS.primary} />}
      screenOptions={{ headerShown: false }}
    >
      <CustomerTab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: t.tab_map,
          tabBarIcon: ({ focused, color }) => (
            <MapPinIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <CustomerTab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          tabBarLabel: t.tab_bookings,
          tabBarIcon: ({ focused, color }) => (
            <CalendarIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <CustomerTab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: t.tab_wallet,
          tabBarIcon: ({ focused, color }) => (
            <WalletIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <CustomerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t.tab_profile,
          tabBarIcon: ({ focused, color }) => (
            <UserIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </CustomerTab.Navigator>
  );
}

function CustomerNavigator() {
  return (
    <CustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerStack.Screen name="Tabs" component={CustomerTabs} />
      <CustomerStack.Screen name="StationDetails" component={StationDetailsScreen} />
      <CustomerStack.Screen name="Booking" component={BookingScreen} />
      <CustomerStack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <CustomerStack.Screen name="Charging" component={ChargingScreen} />
      <CustomerStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ gestureEnabled: false }} />
      <CustomerStack.Screen name="InvestorApplication" component={InvestorApplicationScreen} />
    </CustomerStack.Navigator>
  );
}

// ── Investor Welcome Modal ─────────────────────────────────────

function InvestorWelcomeModal() {
  const { profile, updateProfile } = useAuth();
  const { t, isRTL } = useLang();
  const [visible, setVisible] = useState(false);
  const [listing, setListing] = useState<ChargerListing | null>(null);

  useEffect(() => {
    if (profile?.role === 'investor' && profile?.investor_welcomed === false) {
      fetchListingAndShow();
    }
  }, [profile?.id, profile?.investor_welcomed]);

  const fetchListingAndShow = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('charger_listings')
      .select('*')
      .eq('host_id', profile.id)
      .maybeSingle();
    if (data) setListing(data as ChargerListing);
    // Show after brief delay for UI to settle
    setTimeout(() => setVisible(true), 600);
  };

  const handleContinue = async () => {
    setVisible(false);
    try { await updateProfile({ investor_welcomed: true }); } catch {}
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={wStyles.overlay}>
        <View style={wStyles.card}>
          {/* Celebration icon */}
          <View style={wStyles.iconCircle}>
            <CheckIcon size={36} color={COLORS.primary} strokeWidth={2.5} />
          </View>

          <Text style={[wStyles.title, { textAlign: isRTL ? 'right' : 'center' }]}>
            {t.inv_welcome_title}
          </Text>
          <Text style={[wStyles.subtitle, { textAlign: isRTL ? 'right' : 'center' }]}>
            {t.inv_welcome_subtitle}
          </Text>

          {/* Charger location box */}
          {listing && listing.address ? (
            <View style={wStyles.locationBox}>
              <StarIcon size={16} color={COLORS.gold} strokeWidth={2} filled />
              <View style={{ flex: 1 }}>
                <Text style={wStyles.locationLabel}>{t.inv_welcome_charger_label}</Text>
                <Text style={wStyles.locationAddress} numberOfLines={2}>{listing.address}</Text>
              </View>
            </View>
          ) : null}

          <Text style={[wStyles.body, { textAlign: isRTL ? 'right' : 'center' }]}>
            {t.inv_welcome_body}
          </Text>

          <TouchableOpacity style={wStyles.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={wStyles.btnText}>{t.inv_welcome_btn}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const wStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 28, padding: 28, width: '100%',
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  body:     { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, textAlign: 'center' },
  locationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.goldBg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.goldTint,
    padding: 12, width: '100%',
  },
  locationLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationAddress: { fontSize: 13, fontWeight: '600', color: COLORS.text, lineHeight: 19 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15,
    width: '100%', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, elevation: 5,
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ── INVESTOR ──────────────────────────────────────────────────

function InvestorTabs() {
  const { t } = useLang();
  return (
    <>
      <InvestorWelcomeModal />
      <InvestorTab.Navigator
        tabBar={(props) => <CustomTabBar {...props} accentColor={COLORS.primary} />}
        screenOptions={{ headerShown: false }}
      >
        <InvestorTab.Screen
          name="Map"
          component={MapScreen}
          options={{
            tabBarLabel: t.tab_map,
            tabBarIcon: ({ focused, color }) => (
              <MapPinIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />
        <InvestorTab.Screen
          name="Bookings"
          component={BookingsScreen}
          options={{
            tabBarLabel: t.tab_bookings,
            tabBarIcon: ({ focused, color }) => (
              <CalendarIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />
        <InvestorTab.Screen
          name="InvestorCharger"
          component={InvestorChargerScreen}
          options={{
            tabBarLabel: t.inv_tab_my_charger,
            tabBarIcon: ({ focused, color }) => (
              <ZapIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />
        <InvestorTab.Screen
          name="Wallet"
          component={InvestorEarningsScreen}
          options={{
            tabBarLabel: t.inv_earnings_tab,
            tabBarIcon: ({ focused, color }) => (
              <WalletIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />
        <InvestorTab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: t.tab_profile,
            tabBarIcon: ({ focused, color }) => (
              <UserIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />
      </InvestorTab.Navigator>
    </>
  );
}

function InvestorNavigator() {
  return (
    <InvestorStack.Navigator screenOptions={{ headerShown: false }}>
      <InvestorStack.Screen name="InvestorTabs" component={InvestorTabs} />
      <InvestorStack.Screen name="StationDetails" component={StationDetailsScreen} />
      <InvestorStack.Screen name="Booking" component={BookingScreen} />
      <InvestorStack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <InvestorStack.Screen name="Charging" component={ChargingScreen} />
      <InvestorStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ gestureEnabled: false }} />
      <InvestorStack.Screen name="InvestorApplication" component={InvestorApplicationScreen} />
    </InvestorStack.Navigator>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────

function AdminTabs() {
  const { t } = useLang();
  return (
    <AdminTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} accentColor="#7C3AED" />}
      screenOptions={{ headerShown: false }}
    >
      <AdminTab.Screen
        name="AdminMap"
        component={AdminMapScreen}
        options={{
          tabBarLabel: t.tab_admin_stations,
          tabBarIcon: ({ focused, color }) => (
            <ZapIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <AdminTab.Screen
        name="AdminCustomers"
        component={AdminUsersScreen}
        options={{
          tabBarLabel: t.tab_admin_customers,
          tabBarIcon: ({ focused, color }) => (
            <UsersIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <AdminTab.Screen
        name="AdminInvestors"
        component={AdminInvestorsScreen}
        options={{
          tabBarLabel: t.tab_admin_investors,
          tabBarIcon: ({ focused, color }) => (
            <TrendingUpIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <AdminTab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{
          tabBarLabel: t.tab_profile,
          tabBarIcon: ({ focused, color }) => (
            <ShieldIcon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </AdminTab.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminTabs" component={AdminTabs} />
    </AdminStack.Navigator>
  );
}

// ── ROOT ──────────────────────────────────────────────────────

export default function AppNavigator() {
  const { session, profile, devProfile, loading, recoveryMode } = useAuth();

  // Password-reset deep link takes precedence over all normal routing:
  // the recovery session must not drop the user into the app.
  if (recoveryMode) return <ResetPasswordScreen />;

  // isLoggedIn: real Supabase session OR dev bypass profile
  const isLoggedIn    = !!session || !!devProfile;
  const activeProfile = profile ?? devProfile;

  if (loading || (session && !profile && !devProfile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryDark }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isLoggedIn ? (
          <RootStack.Screen name="GuestMain" component={GuestNavigator} />
        ) : activeProfile?.role === 'admin' ? (
          <RootStack.Screen name="AdminMain" component={AdminNavigator} />
        ) : activeProfile?.role === 'investor' || activeProfile?.role === 'host' ? (
          <RootStack.Screen name="InvestorMain" component={InvestorNavigator} />
        ) : (
          <RootStack.Screen name="CustomerMain" component={CustomerNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
