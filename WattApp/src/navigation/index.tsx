import React from 'react';
import {
  ActivityIndicator, Text, TouchableOpacity, View, StyleSheet, Platform,
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
  ZapIcon, UsersIcon, TrendingUpIcon, ShieldIcon,
} from '../components/icons';
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
import SignInScreen       from '../screens/SignInScreen';
import SignUpScreen       from '../screens/SignUpScreen';
import GuestProfileScreen from '../screens/GuestProfileScreen';
import GuestLockedScreen  from '../screens/GuestLockedScreen';

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

// ── INVESTOR ──────────────────────────────────────────────────

function InvestorTabs() {
  const { t } = useLang();
  return (
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
  const { session, profile, devProfile, loading } = useAuth();

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
