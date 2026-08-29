"use client";

import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

export function AdminFooter() {
  const { t } = useAdminLanguage();
  return (
    <footer className="mt-auto border-t border-[color:var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 md:px-8">
        <p className="text-xs text-[color:var(--muted)]">{t.footer.label}</p>
        <p className="text-xs text-[color:var(--muted)]">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
