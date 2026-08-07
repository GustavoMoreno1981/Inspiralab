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
import { useContent } from "@/lib/content/ContentContext";
import type { Dictionary, Locale } from "./dictionaries";

type LanguageContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { content } = useContent();
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("inspiralab-locale") as Locale | null;
    if (saved === "en" || saved === "es") {
      setLocaleState(saved);
      return;
    }
    const prefersSpanish = navigator.language.toLowerCase().startsWith("es");
    setLocaleState(prefersSpanish ? "es" : "en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("inspiralab-locale", locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === "en" ? "es" : "en"));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t: content[locale],
      setLocale,
      toggleLocale,
    }),
    [content, locale, setLocale, toggleLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
