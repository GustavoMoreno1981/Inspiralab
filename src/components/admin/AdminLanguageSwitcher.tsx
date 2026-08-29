"use client";

import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type Props = {
  className?: string;
};

export function AdminLanguageSwitcher({ className = "" }: Props) {
  const { locale, setLocale } = useAdminLanguage();

  return (
    <div
      className={`flex items-center gap-1 rounded-sm border border-[color:var(--line)] p-1 font-[family-name:var(--font-display)] text-xs font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "en"
            ? "bg-[color:var(--accent)] text-white"
            : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "es"
            ? "bg-[color:var(--accent)] text-white"
            : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        }`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
    </div>
  );
}
