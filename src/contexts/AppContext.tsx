import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, LocalUser, syncFromCloud } from '../lib/storage';
import { Language, translations, TranslationKey } from '../lib/i18n';

interface AppContextType {
  user: LocalUser | null;
  profile: LocalUser | null;
  loading: boolean;
  darkMode: boolean;
  language: Language;
  toggleDarkMode: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
  signOut: () => void;
  refreshProfile: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem('language') as Language) || 'en'
  );

  const isRTL = language === 'ar';
  const t = (key: TranslationKey): string => translations[language][key] ?? translations.en[key];

  useEffect(() => {
    auth.init();
    setUser(auth.getSession());
    setLoading(false);          // show app instantly
    syncFromCloud();            // sync firebase in background
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language, isRTL]);

  const toggleDarkMode = ()            => setDarkMode(p => !p);
  const setLanguage    = (l: Language) => setLanguageState(l);
  const signOut        = ()            => { auth.logout(); setUser(null); };
  const refreshProfile = ()            => setUser(auth.getSession());

  return (
    <AppContext.Provider value={{ user, profile: user, loading, darkMode, language, toggleDarkMode, setLanguage, t, isRTL, signOut, refreshProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
