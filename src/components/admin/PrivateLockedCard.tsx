"use client";

type Props = {
  kind: "actividad" | "idea";
  onUnlock: () => void;
};

export function PrivateLockedCard({ kind, onUnlock }: Props) {
  return (
    <article className="border border-[color:var(--line)] bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Privada
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--ink)]">
            {kind === "actividad" ? "Actividad privada" : "Idea privada en el banco"}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Ingresa tu clave de 4 dígitos para ver y editar este contenido.
          </p>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          className="bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
        >
          Desbloquear
        </button>
      </div>
    </article>
  );
}
