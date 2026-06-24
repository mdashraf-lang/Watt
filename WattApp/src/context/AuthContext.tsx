import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  session:    Session | null;
  profile:    Profile | null;
  devProfile: Profile | null;
  loading:    boolean;
  signOut:           () => Promise<void>;
  refreshProfile:    () => Promise<void>;
  updateProfile:     (data: Partial<Profile>) => Promise<void>;
  deactivateAccount: () => Promise<void>;
  signIn:            (email: string, password: string) => Promise<void>;
  signUp:            (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle:   () => Promise<void>;
  signInWithApple:    () => Promise<void>;
  sendPasswordReset:  (email: string) => Promise<void>;
  devSignIn:  (profile: Profile) => void;
  devSignOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [devProfile, setDevProfile] = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);

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

  // Creates the profile row for OAuth users who don't have one yet
  const ensureProfile = useCallback(async (userId: string, fullName: string) => {
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      wallet_balance: 0,
      total_sessions: 0,
      total_kwh: 0,
      is_active: true,
    }, { onConflict: 'id' });
    await fetchProfile(userId);
  }, [fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
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
      if (!data.user?.identities || data.user.identities.length === 0) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      if (data.user) {
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

  const signInWithGoogle = async () => {
    const redirectTo = 'watt://auth/callback';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;

    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) throw sessionError;

    if (sessionData?.user) {
      const fullName =
        sessionData.user.user_metadata?.full_name ??
        sessionData.user.user_metadata?.name ??
        sessionData.user.email ?? '';
      await ensureProfile(sessionData.user.id, fullName);
    }
  };

  const sendPasswordReset = async (email: string) => {
    const clean = email.trim().toLowerCase();
    // Check if an account with this email exists first
    const { data: exists, error: checkError } = await supabase.rpc('check_email_exists', { p_email: clean });
    if (checkError) throw checkError;
    if (!exists) {
      const err = new Error('NO_ACCOUNT');
      (err as any).code = 'NO_ACCOUNT';
      throw err;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: 'watt://reset-password',
    });
    if (error) throw error;
  };

  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not available', 'Apple sign-in is only available on iOS.');
      return;
    }
    // Dynamically imported to avoid Android build failure
    const AppleAuthentication = await import('expo-apple-authentication');
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Not available', 'Apple sign-in is not available on this device.');
      return;
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });
      if (error) throw error;

      if (data?.user) {
        const nameParts = credential.fullName;
        const fullName = nameParts
          ? [nameParts.givenName, nameParts.familyName].filter(Boolean).join(' ')
          : (data.user.email ?? '');
        await ensureProfile(data.user.id, fullName);
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // user dismissed
      throw e;
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
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
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
