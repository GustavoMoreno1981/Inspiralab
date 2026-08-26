"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  help?: string;
};

export function ScoreFieldInput({ value, onChange, help }: Props) {
  return (
    <div className="space-y-2">
      {help ? (
        <p className="text-xs text-[color:var(--muted)]">{help}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(String(score))}
            className={`min-w-[2.75rem] border px-3 py-2 text-sm font-semibold ${
              value === String(score)
                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                : "border-[color:var(--line)] hover:border-[color:var(--accent)]"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
