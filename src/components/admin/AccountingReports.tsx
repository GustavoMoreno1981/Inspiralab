"use client";

import { useMemo, useState } from "react";
import {
  activityTotalCop,
  formatCop,
  formatUsdFromCop,
  getBeneficiaryReports,
  getYearSummary,
  type AccountingBoard,
} from "@/lib/accounting/types";

type ReportView = "budget" | "beneficiaries";

const ALLOCATION_COLORS: Record<string, string> = {
  salaries: "#1f2937",
  workshops: "#e00d45",
  expenses: "#b45309",
  available: "#6b7280",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openPrintWindow(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 22px 0 8px; }
    .muted { color: #666; font-size: 12px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    .num { text-align: right; white-space: nowrap; }
    .bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; }
    .bar-label { width: 140px; flex-shrink: 0; }
    .bar-track { flex: 1; height: 14px; background: #eee; }
    .bar-fill { height: 100%; }
    .bar-value { width: 180px; text-align: right; flex-shrink: 0; font-size: 11px; }
    @media print { body { padding: 0; } @page { margin: 12mm; } }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    alert("Permite ventanas emergentes para imprimir el informe");
    return;
  }
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      // manual print
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

function BudgetBars({
  totalCop,
  items,
  rate,
}: {
  totalCop: number;
  items: { key: string; label: string; amountCop: number }[];
  rate: number;
}) {
  const max = Math.max(totalCop, ...items.map((i) => Math.abs(i.amountCop)), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, (Math.abs(item.amountCop) / max) * 100);
        const ofBudget =
          totalCop > 0 ? Math.round((item.amountCop / totalCop) * 1000) / 10 : 0;
        const color = ALLOCATION_COLORS[item.key] || "#e00d45";
        return (
          <div key={item.key} className="grid gap-1 sm:grid-cols-[140px_1fr_auto] sm:items-center sm:gap-3">
            <p className="text-sm font-semibold text-[color:var(--ink)]">{item.label}</p>
            <div className="h-3 bg-[color:var(--line)]">
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-right text-xs text-[color:var(--muted)] sm:min-w-[200px]">
              <p className="font-semibold text-[color:var(--ink)]">
                {formatUsdFromCop(item.amountCop, rate)}
              </p>
              <p>
                {formatCop(item.amountCop)} · {ofBudget}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AccountingReports({
  board,
  year,
}: {
  board: AccountingBoard;
  year: number;
}) {
  const [view, setView] = useState<ReportView>("budget");
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>("");

  const summary = useMemo(() => getYearSummary(board, year), [board, year]);
  const beneficiaryRows = useMemo(
    () => getBeneficiaryReports(board, year),
    [board, year],
  );

  const selectedReport = useMemo(() => {
    if (!selectedBeneficiaryId) return null;
    return (
      beneficiaryRows.find((r) => r.beneficiary.id === selectedBeneficiaryId) ||
      null
    );
  }, [beneficiaryRows, selectedBeneficiaryId]);

  const rate = summary.rate;

  function printBudgetReport() {
    const allocationRows = summary.budgetAllocation
      .map((item) => {
        const pct =
          summary.totalCop > 0
            ? Math.round((item.amountCop / summary.totalCop) * 1000) / 10
            : 0;
        const barPct = Math.min(
          100,
          summary.totalCop > 0
            ? (Math.abs(item.amountCop) / summary.totalCop) * 100
            : 0,
        );
        const color = ALLOCATION_COLORS[item.key] || "#e00d45";
        return `
          <div class="bar-row">
            <div class="bar-label">${escapeHtml(item.label)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${barPct}%;background:${color}"></div></div>
            <div class="bar-value">${escapeHtml(formatUsdFromCop(item.amountCop, rate))} · ${escapeHtml(formatCop(item.amountCop))} (${pct}%)</div>
          </div>`;
      })
      .join("");

    const tableRows = summary.budgetAllocation
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td class="num">${escapeHtml(formatUsdFromCop(item.amountCop, rate))}</td>
          <td class="num">${escapeHtml(formatCop(item.amountCop))}</td>
          <td class="num">${
            summary.totalCop > 0
              ? Math.round((item.amountCop / summary.totalCop) * 1000) / 10
              : 0
          }%</td>
        </tr>`,
      )
      .join("");

    const workshopRows = summary.workshopCostsByCategory
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td class="num">${escapeHtml(formatUsdFromCop(item.amountCop, rate))}</td>
          <td class="num">${escapeHtml(formatCop(item.amountCop))}</td>
        </tr>`,
      )
      .join("");

    const expenseRows = summary.expensesByCategory
      .filter((item) => item.amountCop > 0)
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td class="num">${escapeHtml(formatUsdFromCop(item.amountCop, rate))}</td>
          <td class="num">${escapeHtml(formatCop(item.amountCop))}</td>
        </tr>`,
      )
      .join("");

    openPrintWindow(
      `Informe presupuesto ${year}`,
      `
      <h1>Informe anual de presupuesto — ${year}</h1>
      <p class="muted">Tipo de cambio: ${rate} · Uso: ${summary.usedPercent}% · Generado ${new Date().toLocaleString("es-CO")}</p>
      <p><strong>Presupuesto total:</strong> ${escapeHtml(formatUsdFromCop(summary.totalCop, rate))} · ${escapeHtml(formatCop(summary.totalCop))}</p>
      <p><strong>Ejecutado:</strong> ${escapeHtml(formatUsdFromCop(summary.spentCop, rate))} · ${escapeHtml(formatCop(summary.spentCop))}</p>
      <h2>Distribución del presupuesto</h2>
      ${allocationRows}
      <h2>Relación presupuesto vs ejecución</h2>
      <table>
        <thead>
          <tr><th>Concepto</th><th>USD</th><th>COP</th><th>% del presupuesto</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Presupuesto total</td>
            <td class="num">${escapeHtml(formatUsdFromCop(summary.totalCop, rate))}</td>
            <td class="num">${escapeHtml(formatCop(summary.totalCop))}</td>
            <td class="num">100%</td>
          </tr>
          ${tableRows}
        </tbody>
      </table>
      <h2>Gasto real en talleres (por rubro)</h2>
      <table>
        <thead><tr><th>Rubro</th><th>USD</th><th>COP</th></tr></thead>
        <tbody>${workshopRows || `<tr><td colspan="3">Sin gastos registrados</td></tr>`}</tbody>
      </table>
      <h2>Gastos operativos (por categoría)</h2>
      <table>
        <thead><tr><th>Categoría</th><th>USD</th><th>COP</th></tr></thead>
        <tbody>${expenseRows || `<tr><td colspan="3">Sin gastos operativos</td></tr>`}</tbody>
      </table>
      `,
    );
  }

  function printBeneficiariesReport() {
    const rows = beneficiaryRows
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.beneficiary.name)}</td>
          <td class="num">${row.workshopsCount}</td>
          <td class="num">${escapeHtml(formatUsdFromCop(row.donationCop, rate))}<br/><span style="color:#666">${escapeHtml(formatCop(row.donationCop))}</span></td>
          <td class="num">${escapeHtml(formatUsdFromCop(row.spentCop, rate))}<br/><span style="color:#666">${escapeHtml(formatCop(row.spentCop))}</span></td>
          <td>${row.donationCop > 0 ? "Sí" : "No"}</td>
        </tr>`,
      )
      .join("");

    openPrintWindow(
      `Informe beneficiarios ${year}`,
      `
      <h1>Informe por beneficiarios — ${year}</h1>
      <p class="muted">Tipo de cambio: ${rate} · Generado ${new Date().toLocaleString("es-CO")}</p>
      <p>Donación económica = dinero dispuesto/recibido para talleres. Gastado = suma de rubros de las actividades.</p>
      <table>
        <thead>
          <tr>
            <th>Beneficiario</th>
            <th>Talleres</th>
            <th>Donación económica</th>
            <th>Gastado</th>
            <th>¿Donación?</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5">Sin actividad en ${year}</td></tr>`}</tbody>
      </table>
      `,
    );
  }

  function printBeneficiaryDetail() {
    if (!selectedReport) return;
    const activityRows = selectedReport.activities
      .map((activity) => {
        const spentCop = activityTotalCop(activity);
        return `
        <tr>
          <td>${escapeHtml(activity.title)}</td>
          <td>${escapeHtml(activity.date)}</td>
          <td class="num">${escapeHtml(formatUsdFromCop(activity.receivedCop || 0, rate))}<br/><span style="color:#666">${escapeHtml(formatCop(activity.receivedCop || 0))}</span></td>
          <td class="num">${escapeHtml(formatUsdFromCop(spentCop, rate))}<br/><span style="color:#666">${escapeHtml(formatCop(spentCop))}</span></td>
        </tr>`;
      })
      .join("");

    openPrintWindow(
      `Beneficiario ${selectedReport.beneficiary.name} ${year}`,
      `
      <h1>${escapeHtml(selectedReport.beneficiary.name)} — ${year}</h1>
      <p class="muted">${escapeHtml(selectedReport.beneficiary.contact || "Sin contacto")} · Tipo de cambio: ${rate}</p>
      <p><strong>Talleres:</strong> ${selectedReport.workshopsCount}</p>
      <p><strong>Donación económica:</strong> ${escapeHtml(formatUsdFromCop(selectedReport.donationCop, rate))} · ${escapeHtml(formatCop(selectedReport.donationCop))}</p>
      <p><strong>Gastado:</strong> ${escapeHtml(formatUsdFromCop(selectedReport.spentCop, rate))} · ${escapeHtml(formatCop(selectedReport.spentCop))}</p>
      <h2>Actividades / talleres</h2>
      <table>
        <thead>
          <tr><th>Taller</th><th>Fecha</th><th>Donación</th><th>Gastado</th></tr>
        </thead>
        <tbody>${activityRows || `<tr><td colspan="4">Sin talleres</td></tr>`}</tbody>
      </table>
      `,
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
            Reportes {year}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Informe anual del presupuesto y seguimiento por beneficiario. Montos en USD y
            luego en COP (tipo de cambio {rate}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("budget")}
            className={`px-3 py-2 text-sm font-semibold border border-[color:var(--line)] ${
              view === "budget" ? "bg-[color:var(--accent)] text-white border-transparent" : "bg-white"
            }`}
          >
            Presupuesto anual
          </button>
          <button
            type="button"
            onClick={() => setView("beneficiaries")}
            className={`px-3 py-2 text-sm font-semibold border border-[color:var(--line)] ${
              view === "beneficiaries"
                ? "bg-[color:var(--accent)] text-white border-transparent"
                : "bg-white"
            }`}
          >
            Por beneficiario
          </button>
        </div>
      </div>

      {!summary.budget && (
        <p className="border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--muted)]">
          No hay presupuesto cargado para {year}. Puedes ver reportes parciales con las
          actividades y gastos del año, pero el % del presupuesto quedará en 0.
        </p>
      )}

      {view === "budget" && (
        <div className="space-y-5">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={printBudgetReport}
              className="border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold"
            >
              Imprimir informe
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-[color:var(--line)] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                Presupuesto
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">
                {formatUsdFromCop(summary.totalCop, rate)}
              </p>
              <p className="text-sm text-[color:var(--muted)]">{formatCop(summary.totalCop)}</p>
            </div>
            <div className="border border-[color:var(--line)] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                Ejecutado
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">
                {formatUsdFromCop(summary.spentCop, rate)}
              </p>
              <p className="text-sm text-[color:var(--muted)]">{formatCop(summary.spentCop)}</p>
            </div>
            <div className="border border-[color:var(--line)] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                Uso
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">
                {summary.usedPercent}%
              </p>
              <p className="text-sm text-[color:var(--muted)]">
                Disponible {formatUsdFromCop(summary.availableCop, rate)}
              </p>
            </div>
          </div>

          <div className="border border-[color:var(--line)] bg-white p-5 md:p-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Relación con el presupuesto
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              En qué se ha destinado el presupuesto del año.
            </p>
            <div className="mt-5">
              <BudgetBars
                totalCop={summary.totalCop}
                rate={rate}
                items={summary.budgetAllocation.map((item) => ({
                  key: item.key,
                  label: item.label,
                  amountCop: item.amountCop,
                }))}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--line)] bg-[color:var(--mist)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Concepto</th>
                  <th className="px-4 py-3 font-semibold text-right">USD</th>
                  <th className="px-4 py-3 font-semibold text-right">COP</th>
                  <th className="px-4 py-3 font-semibold text-right">% presupuesto</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[color:var(--line)] font-semibold">
                  <td className="px-4 py-3">Presupuesto total</td>
                  <td className="px-4 py-3 text-right">
                    {formatUsdFromCop(summary.totalCop, rate)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCop(summary.totalCop)}</td>
                  <td className="px-4 py-3 text-right">100%</td>
                </tr>
                {summary.budgetAllocation.map((item) => (
                  <tr key={item.key} className="border-b border-[color:var(--line)]">
                    <td className="px-4 py-3">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 align-middle"
                        style={{ backgroundColor: ALLOCATION_COLORS[item.key] }}
                      />
                      {item.label}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatUsdFromCop(item.amountCop, rate)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCop(item.amountCop)}</td>
                    <td className="px-4 py-3 text-right">
                      {summary.totalCop > 0
                        ? `${Math.round((item.amountCop / summary.totalCop) * 1000) / 10}%`
                        : "0%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
              <div className="border-b border-[color:var(--line)] px-4 py-3">
                <h3 className="font-semibold">Gasto real en talleres</h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Rubros ejecutados (no restan del presupuesto; cruzan con lo recibido)
                </p>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--line)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Rubro</th>
                    <th className="px-4 py-2 font-semibold text-right">USD</th>
                    <th className="px-4 py-2 font-semibold text-right">COP</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.workshopCostsByCategory.map((item) => (
                    <tr key={item.category} className="border-b border-[color:var(--line)]">
                      <td className="px-4 py-2">{item.label}</td>
                      <td className="px-4 py-2 text-right">
                        {formatUsdFromCop(item.amountCop, rate)}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCop(item.amountCop)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-4 py-2">Total gastado en talleres</td>
                    <td className="px-4 py-2 text-right">
                      {formatUsdFromCop(summary.activitiesSpentCop, rate)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatCop(summary.activitiesSpentCop)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
              <div className="border-b border-[color:var(--line)] px-4 py-3">
                <h3 className="font-semibold">Gastos operativos</h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Detalle por categoría (sí sale del presupuesto)
                </p>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--line)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Categoría</th>
                    <th className="px-4 py-2 font-semibold text-right">USD</th>
                    <th className="px-4 py-2 font-semibold text-right">COP</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.expensesByCategory.map((item) => (
                    <tr key={item.category} className="border-b border-[color:var(--line)]">
                      <td className="px-4 py-2">{item.label}</td>
                      <td className="px-4 py-2 text-right">
                        {formatUsdFromCop(item.amountCop, rate)}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCop(item.amountCop)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-4 py-2">Total operativos</td>
                    <td className="px-4 py-2 text-right">
                      {formatUsdFromCop(summary.expensesCop, rate)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCop(summary.expensesCop)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "beneficiaries" && (
        <div className="space-y-5">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={printBeneficiariesReport}
              className="border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold"
            >
              Imprimir listado
            </button>
          </div>

          <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--line)] bg-[color:var(--mist)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Beneficiario</th>
                  <th className="px-4 py-3 font-semibold text-center">Talleres</th>
                  <th className="px-4 py-3 font-semibold text-right">Donación económica</th>
                  <th className="px-4 py-3 font-semibold text-right">Gastado</th>
                  <th className="px-4 py-3 font-semibold">Donación</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {beneficiaryRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--muted)]">
                      No hay talleres ni donaciones registradas en {year}.
                    </td>
                  </tr>
                )}
                {beneficiaryRows.map((row) => (
                  <tr key={row.beneficiary.id} className="border-b border-[color:var(--line)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.beneficiary.name}</p>
                      {row.beneficiary.contact && (
                        <p className="text-xs text-[color:var(--muted)]">
                          {row.beneficiary.contact}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {row.workshopsCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">
                        {formatUsdFromCop(row.donationCop, rate)}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatCop(row.donationCop)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">
                        {formatUsdFromCop(row.spentCop, rate)}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatCop(row.spentCop)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.donationCop > 0 ? (
                        <span className="text-[color:var(--accent)] font-semibold">Sí</span>
                      ) : (
                        <span className="text-[color:var(--muted)]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedBeneficiaryId(row.beneficiary.id)}
                        className="text-xs font-semibold underline"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedReport && (
            <div className="border border-[color:var(--line)] bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                    {selectedReport.beneficiary.name}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {selectedReport.workshopsCount} taller
                    {selectedReport.workshopsCount === 1 ? "" : "es"} · Donación{" "}
                    {formatUsdFromCop(selectedReport.donationCop, rate)} · Gastado{" "}
                    {formatUsdFromCop(selectedReport.spentCop, rate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={printBeneficiaryDetail}
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBeneficiaryId("")}
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[color:var(--line)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Taller</th>
                      <th className="py-2 pr-4 font-semibold">Fecha</th>
                      <th className="py-2 pr-4 font-semibold text-right">Donación</th>
                      <th className="py-2 font-semibold text-right">Gastado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.activities.map((activity) => {
                      const spentCop = activityTotalCop(activity);
                      return (
                        <tr
                          key={activity.id}
                          className="border-b border-[color:var(--line)]"
                        >
                          <td className="py-2 pr-4 font-semibold">{activity.title}</td>
                          <td className="py-2 pr-4 text-[color:var(--muted)]">
                            {activity.date}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <p className="font-semibold">
                              {formatUsdFromCop(activity.receivedCop || 0, rate)}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {formatCop(activity.receivedCop || 0)}
                            </p>
                          </td>
                          <td className="py-2 text-right">
                            <p className="font-semibold">
                              {formatUsdFromCop(spentCop, rate)}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {formatCop(spentCop)}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
