"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBillingWhatsAppText, whatsAppShareHref } from "@/lib/billing/whatsapp";
import type { BillingSubmission } from "@/lib/billing/types";
import { PHONE_COUNTRY_CODES, memberWhatsAppDigits, type TeamMember } from "@/lib/tasks/types";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type BillingShareWhatsAppModalProps = {
  open: boolean;
  submission: BillingSubmission | null;
  memberName: string;
  member?: TeamMember | null;
  members: TeamMember[];
  onClose: () => void;
};

export function BillingShareWhatsAppModal({
  open,
  submission,
  memberName,
  member,
  members,
  onClose,
}: BillingShareWhatsAppModalProps) {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const p = t.billing;
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [presetId, setPresetId] = useState("");

  const membersWithPhone = useMemo(
    () =>
      members.filter((item) => memberWhatsAppDigits(item).length >= 10),
    [members],
  );

  useEffect(() => {
    if (!open || !submission) return;
    setCountryCode(member?.phoneCountryCode || "+57");
    setPhone((member?.phone || "").replace(/\D/g, ""));
    setPresetId(member?.id || "");
  }, [open, submission, member]);

  const phoneDigits = useMemo(() => {
    const code = countryCode.replace(/\D/g, "");
    const local = phone.replace(/\D/g, "").replace(/^0+/, "");
    if (!code || !local) return "";
    return `${code}${local}`;
  }, [countryCode, phone]);

  const message = useMemo(() => {
    if (!submission) return "";
    return buildBillingWhatsAppText(submission, memberName);
  }, [submission, memberName]);

  if (!open || !submission) return null;

  function applyPreset(memberId: string) {
    setPresetId(memberId);
    if (!memberId) return;
    const selected = members.find((item) => item.id === memberId);
    if (!selected) return;
    setCountryCode(selected.phoneCountryCode || "+57");
    setPhone((selected.phone || "").replace(/\D/g, ""));
  }

  function sendWhatsApp() {
    if (!phoneDigits) {
      toast.error(p.shareWhatsAppPhoneRequired);
      return;
    }
    const href = whatsAppShareHref(phoneDigits, message);
    window.open(href, "_blank", "noopener,noreferrer");
    toast.success(p.shareWhatsAppReady);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto border border-[color:var(--line)] bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              {p.shareWhatsAppTitle}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {memberName} · {formatPeriod(submission.periodStart, submission.periodEnd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[color:var(--muted)]"
          >
            {t.common.close}
          </button>
        </div>

        <p className="mt-4 text-sm text-[color:var(--muted)]">{p.shareWhatsAppHint}</p>

        <div className="mt-4 space-y-3">
          {membersWithPhone.length > 0 ? (
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                {p.shareWhatsAppPreset}
              </span>
              <select
                value={presetId}
                onChange={(event) => applyPreset(event.target.value)}
                className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm"
              >
                <option value="">{p.shareWhatsAppCustomNumber}</option>
                {membersWithPhone.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.phone ? ` · ${item.phoneCountryCode || "+57"} ${item.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                {p.shareWhatsAppCountryCode}
              </span>
              <select
                value={countryCode}
                onChange={(event) => {
                  setPresetId("");
                  setCountryCode(event.target.value);
                }}
                className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm"
              >
                {PHONE_COUNTRY_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                {p.shareWhatsAppPhone}
              </span>
              <input
                value={phone}
                onChange={(event) => {
                  setPresetId("");
                  setPhone(event.target.value.replace(/[^\d]/g, ""));
                }}
                placeholder="3001234567"
                className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 border border-[color:var(--line)] bg-[color:var(--mist)]/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            {p.shareWhatsAppPreview}
          </p>
          <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-[color:var(--ink)]">
            {message}
          </pre>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendWhatsApp}
            className="inline-flex items-center gap-2 bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {p.shareWhatsAppButton}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-4 py-2.5 text-sm font-semibold"
          >
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPeriod(start: string, end: string) {
  const formatDate = (iso: string) => iso.split("-").reverse().join("/");
  return `${formatDate(start)} – ${formatDate(end)}`;
}
