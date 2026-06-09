import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ar, { type Translations } from '../i18n/ar';
import en from '../i18n/en';

type Lang = 'ar' | 'en';

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  isRTL: boolean;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_KEY = 'watt_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(stored => {
      if (stored === 'en' || stored === 'ar') setLang(stored);
    });
  }, []);

  const toggleLanguage = async () => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  };

  return (
    <LanguageContext.Provider value={{
      lang,
      t: lang === 'ar' ? ar : en,
      isRTL: lang === 'ar',
      toggleLanguage,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
};
