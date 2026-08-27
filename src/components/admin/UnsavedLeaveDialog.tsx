"use client";

type Props = {
  open: boolean;
  saving?: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onCancel: () => void;
};

export function UnsavedLeaveDialog({
  open,
  saving = false,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-title"
        className="w-full max-w-md border border-[color:var(--line)] bg-white p-5 shadow-xl"
      >
        <h2
          id="unsaved-leave-title"
          className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]"
        >
          ¿Deseas guardar los cambios?
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Hay modificaciones sin guardar. Si sales ahora, se perderán a menos
          que las guardes.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="border border-[color:var(--line)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onLeaveWithoutSaving}
            disabled={saving}
            className="border border-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--accent)] disabled:opacity-50"
          >
            No, salir sin guardar
          </button>
          <button
            type="button"
            onClick={onSaveAndLeave}
            disabled={saving}
            className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Sí, guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
