import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  session:    Session | null;
  profile:    Profile | null;
  devProfile: Profile | null;
  loading:    boolean;
  signOut:          () => Promise<void>;
  refreshProfile:   () => Promise<void>;
  updateProfile:    (data: Partial<Profile>) => Promise<void>;
  deactivateAccount:() => Promise<void>;
  signIn:  (email: string, password: string) => Promise<void>;
  signUp:  (email: string, password: string, fullName: string) => Promise<void>;
  devSignIn:  (profile: Profile) => void;
  devSignOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [devProfile, setDevProfile] = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Prevents onAuthStateChange from racing with the signUp upsert.
  // During signup, the profile fetch is handled explicitly after the upsert.
  const isSigningUp = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      if (data.is_active === false) {
        Alert.alert('Account Deactivated', 'This account has been deactivated. Contact support if this was a mistake.');
        await supabase.auth.signOut();
        return;
      }
      setProfile(data as Profile);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Skip during signup — signUp() calls fetchProfile after the upsert completes
        if (!isSigningUp.current) {
          fetchProfile(session.user.id);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    isSigningUp.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw error;
      }
      // Supabase email enumeration protection: existing email returns user with
      // empty identities instead of an error when "Confirm email" is on.
      if (!data.user?.identities || data.user.identities.length === 0) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      if (data.user) {
        // Never include `role` — set by DB default; never overwrite from client.
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          wallet_balance: 0,
          total_sessions: 0,
          total_kwh: 0,
          is_active: true,
        }, { onConflict: 'id' });
        await fetchProfile(data.user.id);
      }
    } finally {
      isSigningUp.current = false;
    }
  };

  const signOut = async () => {
    setDevProfile(null);
    await supabase.auth.signOut();
  };

  const deactivateAccount = async () => {
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', session.user.id);
    if (error) throw error;
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session) await fetchProfile(session.user.id);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (devProfile) {
      setDevProfile(prev => prev ? { ...prev, ...data } : prev);
      return;
    }
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', session.user.id);
    if (error) throw error;
    await fetchProfile(session.user.id);
  };

  const devSignIn  = (p: Profile) => setDevProfile(p);
  const devSignOut = () => setDevProfile(null);

  const activeProfile = profile ?? devProfile;

  return (
    <AuthContext.Provider value={{
      session,
      profile:    activeProfile,
      devProfile,
      loading,
      signIn,
      signUp,
      signOut,
      deactivateAccount,
      refreshProfile,
      updateProfile,
      devSignIn,
      devSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
