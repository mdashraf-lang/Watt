import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

// Remote push was removed from Expo Go in SDK 53 — even *importing*
// expo-notifications runs native init that throws there. So we never load
// the module statically; it's imported lazily only in dev/production builds.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Configure the foreground notification handler once (real builds only).
if (!isExpoGo) {
  import('expo-notifications')
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList:   true,
          shouldPlaySound:  true,
          shouldSetBadge:   false,
        }),
      });
    })
    .catch(() => { /* module unavailable — ignore */ });
}

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
 * no-ops in Expo Go, on simulators, when permission is denied, or before
 * EAS is set up.
 */
export async function registerForPushNotifications(_userId?: string): Promise<void> {
  if (isExpoGo) return;                          // remote push unavailable in Expo Go (SDK 53+)
  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) return;                // push only works on physical devices

    const Notifications = await import('expo-notifications');

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
    if (status !== 'granted') return;            // user declined — respect it

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[notifications] No EAS projectId yet — skipping push token registration.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await api.profile.update({ expo_push_token: token });
  } catch (e) {
    console.warn('[notifications] registration failed:', e);
  }
}

/** Clears the stored push token on sign-out so the device stops receiving pushes. */
export async function unregisterPushNotifications(_userId?: string): Promise<void> {
  try {
    await api.profile.update({ expo_push_token: null });
  } catch (e) {
    console.warn('[notifications] unregister failed:', e);
  }
}
