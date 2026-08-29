"use client";

import type { AdminDictionary } from "@/lib/i18n/admin/types";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

export type PrivateSetupValues = {
  pin: string;
  pinConfirm: string;
  motherName: string;
  petName: string;
  birthYear: string;
};

export const EMPTY_PRIVATE_SETUP: PrivateSetupValues = {
  pin: "",
  pinConfirm: "",
  motherName: "",
  petName: "",
  birthYear: "",
};

type Props = {
  values: PrivateSetupValues;
  onChange: (values: PrivateSetupValues) => void;
};

export function validatePrivateSetup(
  values: PrivateSetupValues,
  p: AdminDictionary["private"],
): string | null {
  if (!/^\d{4}$/.test(values.pin)) return p.pin4digits;
  if (values.pin !== values.pinConfirm) return p.pinsMismatch;
  if (!values.motherName.trim()) return p.motherRequired;
  if (!values.petName.trim()) return p.petRequired;
  if (!/^\d{4}$/.test(values.birthYear)) return p.birthYearRequired;
  return null;
}

export function PrivateItemSetupFields({ values, onChange }: Props) {
  const { t } = useAdminLanguage();
  const p = t.private;

  function patch(partial: Partial<PrivateSetupValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="space-y-3 border border-dashed border-[color:var(--line)] bg-[color:var(--mist)] p-3">
      <p className="text-xs font-semibold text-[color:var(--ink)]">{p.protection}</p>
      <p className="text-xs text-[color:var(--muted)]">{p.protectionDesc}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
            {p.pin}
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={values.pin}
            onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="••••"
            className="w-full border border-[color:var(--line)] px-3 py-2 text-sm tracking-[0.3em]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
            {p.confirmPin}
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={values.pinConfirm}
            onChange={(e) =>
              patch({ pinConfirm: e.target.value.replace(/\D/g, "").slice(0, 4) })
            }
            placeholder="••••"
            className="w-full border border-[color:var(--line)] px-3 py-2 text-sm tracking-[0.3em]"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
          {p.motherName}
        </span>
        <input
          value={values.motherName}
          onChange={(e) => patch({ motherName: e.target.value })}
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
          {p.petName}
        </span>
        <input
          value={values.petName}
          onChange={(e) => patch({ petName: e.target.value })}
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
          {p.birthYear}
        </span>
        <input
          inputMode="numeric"
          maxLength={4}
          value={values.birthYear}
          onChange={(e) => patch({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder={p.birthYearPlaceholder}
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}
