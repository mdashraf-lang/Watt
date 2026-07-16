import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface ChargingContextType {
  activeSessionId: string | null;
  activeStationName: string | null;
  setActiveSession: (id: string, name: string) => void;
  clearActiveSession: () => void;
}

const ChargingContext = createContext<ChargingContextType>({
  activeSessionId: null,
  activeStationName: null,
  setActiveSession: () => {},
  clearActiveSession: () => {},
});

export function ChargingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStationName, setActiveStationName] = useState<string | null>(null);

  const setActiveSession = (id: string, name: string) => {
    setActiveSessionId(id);
    setActiveStationName(name);
  };

  const clearActiveSession = () => {
    setActiveSessionId(null);
    setActiveStationName(null);
  };

  // Recover an in-progress charging session after an app restart. The context
  // is in-memory, so a force-close would otherwise orphan the session — the
  // user couldn't see or stop it (it would just run until auto-shutoff bills
  // it). On login we look up any still-active session and restore the banner.
  useEffect(() => {
    if (!session?.user?.id) {
      setActiveSessionId(null);
      setActiveStationName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('charging_sessions')
        .select('id, station:stations(name), listing:charger_listings(station_name, address)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const name =
        (data as any).station?.name ||
        (data as any).listing?.station_name ||
        (data as any).listing?.address ||
        '';
      // Don't clobber a session already being tracked from the live flow.
      setActiveSessionId(prev => prev ?? (data as any).id);
      setActiveStationName(prev => prev ?? name);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return (
    <ChargingContext.Provider value={{ activeSessionId, activeStationName, setActiveSession, clearActiveSession }}>
      {children}
    </ChargingContext.Provider>
  );
}

export const useCharging = () => useContext(ChargingContext);
