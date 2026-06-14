import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';
import type {
  RootStackParamList,
  CustomerStackParamList,
  CustomerTabParamList,
  HostStackParamList,
  HostTabParamList,
} from '../types';

// Auth screens
import SplashScreen from '../screens/SplashScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import PhoneScreen from '../screens/PhoneScreen';
import OTPScreen from '../screens/OTPScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HostSetupScreen from '../screens/HostSetupScreen';

// Customer screens
import MapScreen from '../screens/MapScreen';
import StationDetailsScreen from '../screens/StationDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import ActiveBookingScreen from '../screens/ActiveBookingScreen';
import ChargingScreen from '../screens/ChargingScreen';
import WalletScreen from '../screens/WalletScreen';
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InvestorScreen from '../screens/InvestorScreen';

// Host screens
import HostDashboardScreen from '../screens/HostDashboardScreen';
import HostChargerScreen from '../screens/HostChargerScreen';
import HostEarningsScreen from '../screens/HostEarningsScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();
const CustomerTab = createBottomTabNavigator<CustomerTabParamList>();
const HostStack = createNativeStackNavigator<HostStackParamList>();
const HostTab = createBottomTabNavigator<HostTabParamList>();

function TabEmojiIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: focused ? '#dcfce7' : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
    </View>
  );
}

// ── CUSTOMER ──────────────────────────────────────────────

function CustomerTabs() {
  const { t } = useLang();
  return (
    <CustomerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <CustomerTab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: t.tab_map, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="🗺️" focused={focused} /> }}
      />
      <CustomerTab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ tabBarLabel: t.tab_bookings, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="📋" focused={focused} /> }}
      />
      <CustomerTab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: t.tab_wallet, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="💳" focused={focused} /> }}
      />
      <CustomerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t.tab_profile, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="👤" focused={focused} /> }}
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
      <CustomerStack.Screen name="Investor" component={InvestorScreen} />
    </CustomerStack.Navigator>
  );
}

// ── HOST ──────────────────────────────────────────────────

function HostTabs() {
  const { t } = useLang();
  return (
    <HostTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <HostTab.Screen
        name="Dashboard"
        component={HostDashboardScreen}
        options={{ tabBarLabel: t.tab_dashboard, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="📊" focused={focused} /> }}
      />
      <HostTab.Screen
        name="MyCharger"
        component={HostChargerScreen}
        options={{ tabBarLabel: t.tab_my_charger, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="🔌" focused={focused} /> }}
      />
      <HostTab.Screen
        name="Earnings"
        component={HostEarningsScreen}
        options={{ tabBarLabel: t.tab_earnings, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="💰" focused={focused} /> }}
      />
      <HostTab.Screen
        name="HostProfile"
        component={ProfileScreen}
        options={{ tabBarLabel: t.tab_profile, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="👤" focused={focused} /> }}
      />
    </HostTab.Navigator>
  );
}

function HostNavigator() {
  const { session } = useAuth();
  const [initialRoute, setInitialRoute] = React.useState<'HostSetup' | 'HostTabs' | null>(null);

  React.useEffect(() => {
    if (!session) return;
    supabase
      .from('charger_listings')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', session.user.id)
      .then(({ count }: { count: number | null }) => {
        setInitialRoute((count ?? 0) > 0 ? 'HostTabs' : 'HostSetup');
      });
  }, [session]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <HostStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <HostStack.Screen name="HostSetup" component={HostSetupScreen} />
      <HostStack.Screen name="HostTabs" component={HostTabs} />
    </HostStack.Navigator>
  );
}

// ── ROOT ──────────────────────────────────────────────────

export default function AppNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!session ? (
          // Auth flow
          <>
            <RootStack.Screen name="Splash" component={SplashScreen} />
            <RootStack.Screen
              name="RoleSelect"
              component={RoleSelectScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Phone"
              component={PhoneScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="OTP"
              component={OTPScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen name="SignIn" component={SignInScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="SignUp" component={SignUpScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : profile?.role === 'host' ? (
          <RootStack.Screen name="HostMain" component={HostNavigator} />
        ) : (
          <RootStack.Screen name="CustomerMain" component={CustomerNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
