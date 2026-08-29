"use client";

import { useState } from "react";
import type { Activity, TaskBankItem } from "@/lib/tasks/types";
import type { PrivateItemType } from "@/lib/tasks/private-auth";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import {
  EMPTY_PRIVATE_SETUP,
  PrivateItemSetupFields,
  validatePrivateSetup,
} from "@/components/admin/PrivateItemSetupFields";

export type PrivateUnlockPayload = {
  itemType: PrivateItemType;
  itemId: string;
  activity?: Activity;
  bankItem?: TaskBankItem;
};

type Props = {
  open: boolean;
  itemType: PrivateItemType;
  itemId: string;
  onClose: () => void;
  onUnlocked: (payload: PrivateUnlockPayload) => void;
};

export function PrivateItemUnlockModal({
  open,
  itemType,
  itemId,
  onClose,
  onUnlocked,
}: Props) {
  const { t } = useAdminLanguage();
  const p = t.private;
  const [mode, setMode] = useState<"unlock" | "recover">("unlock");
  const [pin, setPin] = useState("");
  const [recover, setRecover] = useState(EMPTY_PRIVATE_SETUP);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/private/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, pin }),
      });
      const data = (await res.json().catch(() => null)) as
        | (PrivateUnlockPayload & { error?: string; ok?: boolean })
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || p.wrongPin);
        return;
      }
      onUnlocked({
        itemType,
        itemId,
        activity: data.activity,
        bankItem: data.bankItem,
      });
      setPin("");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover(event: React.FormEvent) {
    event.preventDefault();
    const validation = validatePrivateSetup(recover, p);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/private/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          itemId,
          motherName: recover.motherName,
          petName: recover.petName,
          birthYear: recover.birthYear,
          newPin: recover.pin,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (PrivateUnlockPayload & { error?: string; ok?: boolean })
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || p.recoverFailed);
        return;
      }
      onUnlocked({
        itemType,
        itemId,
        activity: data.activity,
        bankItem: data.bankItem,
      });
      setRecover(EMPTY_PRIVATE_SETUP);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md border border-[color:var(--line)] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
              {p.contentPrivate}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{p.unlockDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[color:var(--muted)]"
          >
            {t.common.close}
          </button>
        </div>

        {mode === "unlock" ? (
          <form onSubmit={(e) => void handleUnlock(e)} className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                {p.pinLabel}
              </span>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm tracking-[0.3em]"
              />
            </label>
            {error ? (
              <p className="text-xs font-semibold text-[color:var(--accent)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="w-full bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? p.verifying : p.unlock}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("recover");
                setError("");
              }}
              className="w-full text-xs font-semibold text-[color:var(--accent)]"
            >
              {p.recover}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleRecover(e)} className="mt-4 space-y-3">
            <PrivateItemSetupFields values={recover} onChange={setRecover} />
            {error ? (
              <p className="text-xs font-semibold text-[color:var(--accent)]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? t.common.saving : p.recoverSave}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("unlock");
                setError("");
              }}
              className="w-full text-xs font-semibold text-[color:var(--muted)]"
            >
              {p.recoverBack}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
