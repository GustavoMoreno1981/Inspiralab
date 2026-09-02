"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type BillingPaymentReceiptUploadProps = {
  submissionId: string;
  hasReceipt: boolean;
  disabled?: boolean;
  onUploaded: () => void | Promise<void>;
};

export function BillingPaymentReceiptUpload({
  submissionId,
  hasReceipt,
  disabled = false,
  onUploaded,
}: BillingPaymentReceiptUploadProps) {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const p = t.billing;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const data = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.uploadError);
      }
      const uploaded = (await uploadRes.json()) as { url: string; name?: string };

      const res = await fetch(`/api/billing?id=${encodeURIComponent(submissionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uploadPaymentReceipt",
          paymentReceiptUrl: uploaded.url,
          paymentReceiptName: uploaded.name || file.name || "recibo-de-pago",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.paymentReceiptSaveError);
      }

      toast.success(hasReceipt ? p.paymentReceiptUpdated : p.paymentReceiptSaved);
      await onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : p.paymentReceiptSaveError);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3 border-t border-[color:var(--line)]/60 pt-3">
      <p className="text-xs font-semibold text-[color:var(--ink)]">{p.paymentReceiptTitle}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--muted)]">
        {p.paymentReceiptHint}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {hasReceipt ? (
          <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
            {p.paymentReceiptSent}
          </span>
        ) : null}
        <label
          className={`inline-flex cursor-pointer border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold text-[color:var(--ink)] ${
            disabled || uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <span>
            {uploading
              ? p.paymentReceiptUploading
              : hasReceipt
                ? p.paymentReceiptReplace
                : p.paymentReceiptUpload}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-[10px] text-[color:var(--muted)]">{p.uploadFormats}</p>
    </div>
  );
}
