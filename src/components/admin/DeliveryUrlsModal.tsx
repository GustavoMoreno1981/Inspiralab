"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  initialProcessUrl?: string;
  initialDeliverableUrl?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (urls: { processUrl: string; deliverableUrl: string }) => void;
};

export function DeliveryUrlsModal({
  open,
  title,
  initialProcessUrl = "",
  initialDeliverableUrl = "",
  saving = false,
  onClose,
  onSave,
}: Props) {
  const [processUrl, setProcessUrl] = useState(initialProcessUrl);
  const [deliverableUrl, setDeliverableUrl] = useState(initialDeliverableUrl);
  const processRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setProcessUrl(initialProcessUrl);
    setDeliverableUrl(initialDeliverableUrl);
    const timer = window.setTimeout(() => processRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
    // Solo al abrir el modal (open pasa a true), no en cada cambio del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-urls-title"
        className="w-full max-w-md space-y-4 border border-[color:var(--line)] bg-white p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="delivery-urls-title"
              className="font-[family-name:var(--font-display)] text-xl font-bold"
            >
              URLs de entrega
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm font-semibold text-[color:var(--muted)] disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
            URL del proceso
          </span>
          <input
            ref={processRef}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://..."
            value={processUrl}
            onChange={(event) => setProcessUrl(event.target.value)}
            className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
            URL del entregable
          </span>
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://..."
            value={deliverableUrl}
            onChange={(event) => setDeliverableUrl(event.target.value)}
            className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </label>

        <p className="text-xs text-[color:var(--muted)]">
          Escribe las URLs y pulsa <strong>Guardar y cerrar</strong>. El estado
          queda en Terminada.
        </p>

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              processUrl: processUrl.trim(),
              deliverableUrl: deliverableUrl.trim(),
            })
          }
          className="w-full bg-[color:var(--accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar y cerrar"}
        </button>
      </div>
    </div>
  );
}
