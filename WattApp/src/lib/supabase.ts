import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lmmncgljzccgbvschgge.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbW5jZ2xqemNjZ2J2c2NoZ2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI1NTcsImV4cCI6MjA5NjQ4ODU1N30.MG_wpgvKmlz4xsZnmLMJvsF3gdeLRZolc-cWZd9ztQA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
