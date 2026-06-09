import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';
import type { RootStackParamList, MainStackParamList, TabParamList } from '../types';

import SplashScreen from '../screens/SplashScreen';
import PhoneScreen from '../screens/PhoneScreen';
import OTPScreen from '../screens/OTPScreen';
import MapScreen from '../screens/MapScreen';
import StationDetailsScreen from '../screens/StationDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import ActiveBookingScreen from '../screens/ActiveBookingScreen';
import ChargingScreen from '../screens/ChargingScreen';
import WalletScreen from '../screens/WalletScreen';
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InvestorScreen from '../screens/InvestorScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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

function MainTabs() {
  const { t } = useLang();
  return (
    <Tab.Navigator
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
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: t.tab_map, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="🗺️" focused={focused} /> }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ tabBarLabel: t.tab_bookings, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="📋" focused={focused} /> }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: t.tab_wallet, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="💳" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t.tab_profile, tabBarIcon: ({ focused }) => <TabEmojiIcon emoji="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen name="StationDetails" component={StationDetailsScreen} />
      <MainStack.Screen name="Booking" component={BookingScreen} />
      <MainStack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <MainStack.Screen name="Charging" component={ChargingScreen} />
      <MainStack.Screen name="Investor" component={InvestorScreen} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

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
        {/* LOGIN COMMENTED OUT FOR DEVELOPMENT
        {!session ? (
          <>
            <RootStack.Screen name="Splash" component={SplashScreen} />
            <RootStack.Screen name="Phone" component={PhoneScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="OTP" component={OTPScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
        */}
        <RootStack.Screen name="Main" component={MainNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
