import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// Resolve the EAS project id (required for Expo push tokens). Present
// once the project is linked with EAS; before that we skip registration.
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

/**
 * Requests notification permission, obtains the Expo push token, and
 * saves it to the signed-in user's profile. Safe to call on every login;
 * no-ops on simulators, when permission is denied, or before EAS is set up.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;              // push only works on physical devices

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#10B981',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;          // user declined — respect it

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[notifications] No EAS projectId yet — skipping push token registration.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);
  } catch (e) {
    console.warn('[notifications] registration failed:', e);
  }
}

/** Clears the stored push token on sign-out so the device stops receiving pushes. */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
  } catch (e) {
    console.warn('[notifications] unregister failed:', e);
  }
}
