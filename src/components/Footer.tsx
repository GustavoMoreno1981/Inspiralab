"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Footer() {
  const { t, locale } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--line)] bg-white text-[color:var(--ink)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--accent)]">
            Inspiralab
          </p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">{t.footer.tagline}</p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <Link
            href="/login"
            className="font-[family-name:var(--font-display)] text-sm font-semibold text-[color:var(--accent)] transition-opacity hover:opacity-80"
          >
            {locale === "es" ? "Login / Admin" : "Login / Admin"}
          </Link>
          <p className="text-sm text-[color:var(--muted)]">
            © {year} Inspiralab. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
