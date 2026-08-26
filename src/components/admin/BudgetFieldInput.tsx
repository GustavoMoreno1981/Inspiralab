"use client";

import { useEffect, useMemo, useState } from "react";
import {
  budgetTotals,
  copToUsd,
  formatCop,
  formatUsd,
  parseBudgetField,
  serializeBudgetField,
  type BudgetFieldData,
} from "@/lib/followup/budget-fields";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rateDate: string;
  placeholder?: string;
  compact?: boolean;
};

function formatRateDate(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  return iso.split("-").reverse().join("/");
}

export function BudgetFieldInput({
  value,
  onChange,
  rateDate,
  placeholder = "Ej: Alquiler de sillas",
  compact = false,
}: Props) {
  const parsed = useMemo(() => parseBudgetField(value), [value]);
  const [label, setLabel] = useState("");
  const [copInput, setCopInput] = useState("");
  const [rateInput, setRateInput] = useState(
    parsed.copPerUsd > 0 ? String(Math.round(parsed.copPerUsd)) : "",
  );

  useEffect(() => {
    if (parsed.copPerUsd > 0) {
      setRateInput(String(Math.round(parsed.copPerUsd)));
    }
  }, [parsed.copPerUsd]);

  const copPerUsd = Number(rateInput.replace(/[^\d]/g, ""));
  const copDraft = Number(copInput.replace(/[^\d]/g, ""));
  const usdPreview = copPerUsd > 0 ? copToUsd(copDraft || 0, copPerUsd) : 0;
  const totals = budgetTotals(parsed);

  function syncData(next: BudgetFieldData) {
    onChange(serializeBudgetField(next));
  }

  function applyRate(nextRate: number) {
    if (!nextRate || nextRate <= 0) return;
    if (!parsed.lines.length) return;
    syncData({
      ...parsed,
      rateDate,
      copPerUsd: nextRate,
      lines: parsed.lines.map((line) => ({
        ...line,
        usd: copToUsd(line.cop, nextRate),
      })),
    });
  }

  function addLine() {
    const nextLabel = label.trim();
    const cop = Number(copInput.replace(/[^\d]/g, ""));
    if (!nextLabel || !cop || cop <= 0 || !copPerUsd) return;
    const next: BudgetFieldData = {
      v: 1,
      rateDate,
      copPerUsd,
      lines: [
        ...parsed.lines,
        { label: nextLabel, cop, usd: copToUsd(cop, copPerUsd) },
      ],
    };
    syncData(next);
    setLabel("");
    setCopInput("");
  }

  function removeLine(index: number) {
    syncData({
      ...parsed,
      rateDate,
      copPerUsd,
      lines: parsed.lines.filter((_, i) => i !== index),
    });
  }

  const inputClass = `w-full min-w-0 border border-[color:var(--line)] bg-white px-3 py-2 outline-none focus:border-[color:var(--accent)] ${
    compact ? "text-xs" : "text-sm"
  }`;

  return (
    <div className="w-full min-w-0 space-y-2">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">
          TRM del día ({formatRateDate(rateDate)}) · COP por US$1
        </span>
        <input
          value={rateInput}
          onChange={(event) => setRateInput(event.target.value)}
          onBlur={() => applyRate(copPerUsd)}
          inputMode="numeric"
          placeholder="Ej: 4200"
          className={inputClass}
        />
        <span className="text-[11px] text-[color:var(--muted)]">
          Ingresa manualmente la tasa del día de programación.
        </span>
      </label>

      {parsed.lines.length > 0 ? (
        <div className="overflow-x-auto border border-[color:var(--line)]">
          <table className={`w-full min-w-[280px] ${compact ? "text-xs" : "text-sm"}`}>
            <thead className="bg-[color:var(--mist)]">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold">Concepto</th>
                <th className="px-2 py-1.5 text-right font-semibold">COP</th>
                <th className="px-2 py-1.5 text-right font-semibold">USD</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {parsed.lines.map((line, index) => (
                <tr
                  key={`${index}-${line.label}`}
                  className="border-t border-[color:var(--line)]"
                >
                  <td className="px-2 py-1.5">{line.label}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {formatCop(line.cop)}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {formatUsd(line.usd)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-[11px] font-semibold text-[color:var(--muted)] hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[color:var(--line)] bg-[color:var(--mist)]/60 font-semibold">
                <td className="px-2 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {formatCop(totals.totalCop)}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {formatUsd(totals.totalUsd)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[color:var(--muted)]">Sin partidas aún.</p>
      )}

      <div className="w-full min-w-0 space-y-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
        <div
          className={
            compact
              ? "grid w-full min-w-0 grid-cols-2 gap-2"
              : "grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
          }
        >
          <input
            value={copInput}
            onChange={(event) => setCopInput(event.target.value)}
            inputMode="numeric"
            placeholder="Valor COP"
            className={inputClass}
          />
          <div
            className={`flex min-w-0 items-center border border-[color:var(--line)] bg-[color:var(--mist)]/40 px-3 py-2 ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            {copDraft > 0 && copPerUsd > 0 ? formatUsd(usdPreview) : "USD"}
          </div>
        </div>
        <button
          type="button"
          onClick={addLine}
          disabled={!label.trim() || !copDraft || !copPerUsd}
          className={`w-full border border-[color:var(--line)] bg-white font-semibold disabled:opacity-50 ${
            compact ? "px-2 py-2 text-xs" : "px-3 py-2 text-sm"
          }`}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
