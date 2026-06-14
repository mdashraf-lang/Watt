import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string, fullName: string, role: 'customer' | 'host') => Promise<void>;
  // kept so OTPScreen/legacy screens compile
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, role: 'customer' | 'host') => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  verifyEmailOTP: (email: string, token: string, fullName: string, role: 'customer' | 'host') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_PROFILE: Profile = {
  id: 'dev-user',
  phone: '+96892421050',
  full_name: 'Test User',
  role: 'customer',
  membership_level: 'gold',
  wallet_balance: 25.000,
  total_sessions: 12,
  total_kwh: 148.5,
  rating: 4.9,
  car_model: 'Tesla Model 3',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (phone: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error) throw error;
  };

  const signUp = async (phone: string, password: string, fullName: string, role: 'customer' | 'host') => {
    const { data, error } = await supabase.auth.signUp({ phone, password });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        phone,
        full_name: fullName,
        role,
        wallet_balance: 0,
        total_sessions: 0,
        total_kwh: 0,
        rating: 0,
        membership_level: 'standard',
      });
      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session) await fetchProfile(session.user.id);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', session.user.id);
    if (error) throw error;
    await fetchProfile(session.user.id);
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmailPassword = async (
    email: string,
    password: string,
    fullName: string,
    role: 'customer' | 'host',
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role,
        wallet_balance: 0,
        total_sessions: 0,
        total_kwh: 0,
        rating: 0,
        membership_level: 'standard',
      });
      if (profileError) throw profileError;
      await fetchProfile(data.user.id);
    }
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  };

  const verifyOTP = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  };

  const verifyEmailOTP = async (
    email: string,
    token: string,
    fullName: string,
    role: 'customer' | 'host',
  ) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;

    const { data: { session: newSession } } = await supabase.auth.getSession();
    if (!newSession) throw new Error('No session after verification');

    // Create profile only for new users
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', newSession.user.id)
      .single();

    if (!existing) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: newSession.user.id,
        full_name: fullName,
        role,
        wallet_balance: 0,
        total_sessions: 0,
        total_kwh: 0,
        rating: 0,
        membership_level: 'standard',
      });
      if (profileError) throw profileError;
    }

    await fetchProfile(newSession.user.id);
  };

  return (
    <AuthContext.Provider value={{
      session,
      profile: profile ?? DEV_PROFILE,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signInWithEmail,
      verifyOTP,
      verifyEmailOTP,
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
