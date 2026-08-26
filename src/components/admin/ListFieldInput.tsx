"use client";

import { useState } from "react";
import {
  parseListField,
  serializeListField,
} from "@/lib/followup/list-fields";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  addLabel?: string;
  compact?: boolean;
};

export function ListFieldInput({
  value,
  onChange,
  placeholder = "Escribe un ítem y pulsa Agregar",
  addLabel = "Agregar",
  compact = false,
}: Props) {
  const items = parseListField(value);
  const [draft, setDraft] = useState("");

  function addItem() {
    const next = draft.trim();
    if (!next) return;
    onChange(serializeListField([...items, next]));
    setDraft("");
  }

  function removeItem(index: number) {
    onChange(serializeListField(items.filter((_, i) => i !== index)));
  }

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <ul
          className={`space-y-1 ${compact ? "text-xs" : "text-sm"} list-none`}
        >
          {items.map((item, index) => (
            <li
              key={`${index}-${item.slice(0, 24)}`}
              className="flex items-start gap-2 border border-[color:var(--line)] bg-[color:var(--mist)]/50 px-2 py-1.5"
            >
              <span className="mt-0.5 shrink-0 font-semibold text-[color:var(--accent)]">
                •
              </span>
              <span className="min-w-0 flex-1 text-[color:var(--ink)]">
                {item}
              </span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="shrink-0 text-[11px] font-semibold text-[color:var(--muted)] hover:text-red-600"
                aria-label="Quitar ítem"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--muted)]">Sin ítems aún.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className={`min-w-[12rem] flex-1 border border-[color:var(--line)] bg-white px-3 py-2 outline-none focus:border-[color:var(--accent)] ${
            compact ? "text-xs" : "text-sm"
          }`}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className={`border border-[color:var(--line)] bg-white font-semibold disabled:opacity-50 ${
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-xs"
          }`}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
