"use client";

type Props = {
  visible: boolean;
  saving?: boolean;
  onSave?: () => void;
};

export function UnsavedChangesReminder({ visible, saving = false, onSave }: Props) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="border-b border-[#f59e0b] bg-[#fffbeb] px-5 py-2.5 text-center text-sm text-[#92400e] md:px-8"
    >
      <strong>Tienes cambios sin guardar.</strong>{" "}
      {onSave ? (
        <>
          Pulsa{" "}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="font-semibold text-[color:var(--accent)] underline underline-offset-2 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>{" "}
          para publicarlos en el sitio.
        </>
      ) : (
        <>Pulsa Guardar arriba para publicarlos en el sitio.</>
      )}
    </div>
  );
}
