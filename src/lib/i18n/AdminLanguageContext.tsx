"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminDictionaries,
  type AdminDictionary,
  type AdminLocale,
} from "@/lib/i18n/admin";

const LOCALE_KEY = "inspiralab-locale";

type AdminLanguageContextValue = {
  locale: AdminLocale;
  t: AdminDictionary;
  setLocale: (locale: AdminLocale) => void;
  toggleLocale: () => void;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_KEY) as AdminLocale | null;
    if (saved === "en" || saved === "es") {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === "en" ? "es" : "en"));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t: adminDictionaries[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  );

  return (
    <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) {
    throw new Error("useAdminLanguage must be used within AdminLanguageProvider");
  }
  return ctx;
}
