"use client";

import {
  REVIEW_POLL_OPTIONS,
  reviewResponseLabel,
} from "@/lib/tasks/review-message";
import type { ReviewResponseValue } from "@/lib/tasks/types";

type Props = {
  currentResponse?: ReviewResponseValue | null;
  respondedBy?: string;
  respondedAt?: string;
  disabled?: boolean;
  onRecord: (value: ReviewResponseValue) => void;
};

function formatWhen(iso: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ReviewResponsePanel({
  currentResponse,
  respondedBy,
  respondedAt,
  disabled = false,
  onRecord,
}: Props) {
  return (
    <div className="space-y-2 border border-amber-200 bg-amber-50/80 px-3 py-2.5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Respuesta de revisión
        </p>
        <p className="mt-0.5 text-xs text-amber-900/90">
          Cuando te respondan, registra aquí la respuesta: Sí, No, Pendiente o
          Llamada.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {REVIEW_POLL_OPTIONS.map((item) => {
          const active = currentResponse === item.value;
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => onRecord(item.value)}
              className={`border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                  : "border-amber-300 bg-white text-amber-950 hover:border-[color:var(--accent)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {currentResponse ? (
        <p className="text-xs text-amber-900">
          Registrado: <strong>{reviewResponseLabel(currentResponse)}</strong>
          {respondedBy ? ` · ${respondedBy}` : ""}
          {respondedAt ? ` · ${formatWhen(respondedAt)}` : ""}
        </p>
      ) : (
        <p className="text-xs text-amber-900/80">Aún sin respuesta registrada.</p>
      )}
    </div>
  );
}
