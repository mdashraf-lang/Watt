import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cnwlmbpmgwmhzzjnmltz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNud2xtYnBtZ3dtaHp6am5tbHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzczNDIsImV4cCI6MjA5NjU1MzM0Mn0.GLPmdNNnMOZw_-14Ex8Bx3-AbWrRUP0FaBpHL4SqwSg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
