import React, { createContext, useContext, useState } from 'react';

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

  return (
    <ChargingContext.Provider value={{ activeSessionId, activeStationName, setActiveSession, clearActiveSession }}>
      {children}
    </ChargingContext.Provider>
  );
}

export const useCharging = () => useContext(ChargingContext);
