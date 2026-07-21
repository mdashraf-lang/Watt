// ─── Central app configuration / environment ────────────────────────────────
// The backend the app talks to is chosen AT BUILD TIME via EXPO_PUBLIC_* vars:
//   • locally     → from the .env file (see .env / npx expo start -c)
//   • EAS builds  → from each build profile's `env` in eas.json
// Only EXPO_PUBLIC_* names are inlined into the app; they must be referenced
// with static dot notation (Expo requirement).

export type AppEnv = 'development' | 'preview' | 'production';

// Fallbacks keep the app working if a value is missing. The anon key is a PUBLIC
// key (protected by Row Level Security) so it is safe to ship.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://cnwlmbpmgwmhzzjnmltz.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNud2xtYnBtZ3dtaHp6am5tbHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzczNDIsImV4cCI6MjA5NjU1MzM0Mn0.GLPmdNNnMOZw_-14Ex8Bx3-AbWrRUP0FaBpHL4SqwSg';

const APP_ENV: AppEnv =
  (process.env.EXPO_PUBLIC_APP_ENV as AppEnv) ?? 'development';

// The GO WATT backend (Supabase-free). Point this at your server, e.g.
//   EXPO_PUBLIC_API_URL=https://api.gowatt.om   (or http://<server-ip>:8080 for testing)
const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const ENV = {
  supabaseUrl:     SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  apiUrl:          API_URL,
  appEnv:          APP_ENV,
  isProduction:    APP_ENV === 'production',
  // Host only, for display (e.g. "api.gowatt.om" or "…supabase.co").
  backendHost:     (API_URL || SUPABASE_URL).replace(/^https?:\/\//, '').replace(/\/$/, ''),
};
