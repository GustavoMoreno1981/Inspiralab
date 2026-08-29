"use client";

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

export function PrivateItemSetupFields({ values, onChange }: Props) {
  function patch(partial: Partial<PrivateSetupValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="space-y-3 border border-dashed border-[color:var(--line)] bg-[color:var(--mist)] p-3">
      <p className="text-xs font-semibold text-[color:var(--ink)]">
        Protección privada
      </p>
      <p className="text-xs text-[color:var(--muted)]">
        Solo tú verás este contenido. Crea una clave de 4 dígitos y tres
        respuestas para recuperarla si la olvidas.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
            Clave (4 dígitos)
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
            Confirmar clave
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
          ¿Cuál es el nombre de tu madre?
        </span>
        <input
          value={values.motherName}
          onChange={(e) => patch({ motherName: e.target.value })}
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
          ¿Cómo se llama tu mascota?
        </span>
        <input
          value={values.petName}
          onChange={(e) => patch({ petName: e.target.value })}
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
          ¿En qué año naciste?
        </span>
        <input
          inputMode="numeric"
          maxLength={4}
          value={values.birthYear}
          onChange={(e) => patch({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="1990"
          className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

export function validatePrivateSetup(values: PrivateSetupValues): string | null {
  if (!/^\d{4}$/.test(values.pin)) return "La clave debe tener 4 dígitos";
  if (values.pin !== values.pinConfirm) return "Las claves no coinciden";
  if (!values.motherName.trim()) return "Indica el nombre de tu madre";
  if (!values.petName.trim()) return "Indica el nombre de tu mascota";
  if (!/^\d{4}$/.test(values.birthYear)) return "Indica el año de nacimiento (4 dígitos)";
  return null;
}
