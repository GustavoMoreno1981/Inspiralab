"use client";

import { PrivateLockButton } from "@/components/admin/PrivateLockButton";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type Props = {
  kind: "actividad" | "idea";
  onUnlock: () => void;
};

export function PrivateLockedCard({ kind, onUnlock }: Props) {
  const { t } = useAdminLanguage();
  const p = t.private;

  return (
    <article className="border border-[color:var(--line)] bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            {p.badge}
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--ink)]">
            {kind === "actividad" ? p.lockedPrivate : p.lockedBank}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted)]">{p.unlockHint}</p>
        </div>
        <PrivateLockButton locked onClick={onUnlock} label={p.unlock} />
      </div>
    </article>
  );
}
