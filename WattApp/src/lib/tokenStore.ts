import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists the API access + refresh tokens. Kept in memory for fast sync reads,
// and mirrored to AsyncStorage so the session survives app restarts.
const ACCESS_KEY  = 'gw_access_token';
const REFRESH_KEY = 'gw_refresh_token';

let accessToken:  string | null = null;
let refreshToken: string | null = null;

export const tokenStore = {
  async load() {
    const [a, r] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
    accessToken = a;
    refreshToken = r;
  },

  getAccess() { return accessToken; },
  getRefresh() { return refreshToken; },

  async set(access: string | null, refresh: string | null) {
    accessToken = access;
    refreshToken = refresh;
    await Promise.all([
      access  ? AsyncStorage.setItem(ACCESS_KEY, access)   : AsyncStorage.removeItem(ACCESS_KEY),
      refresh ? AsyncStorage.setItem(REFRESH_KEY, refresh) : AsyncStorage.removeItem(REFRESH_KEY),
    ]);
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  },
};
