export type BudgetLine = {
  label: string;
  cop: number;
  usd: number;
};

export type BudgetFieldData = {
  v: 1;
  rateDate: string;
  copPerUsd: number;
  lines: BudgetLine[];
};

const EMPTY_BUDGET: BudgetFieldData = {
  v: 1,
  rateDate: "",
  copPerUsd: 0,
  lines: [],
};

export function copToUsd(cop: number, copPerUsd: number): number {
  if (!copPerUsd || copPerUsd <= 0) return 0;
  return Math.round((cop / copPerUsd) * 100) / 100;
}

export function parseBudgetField(value: string): BudgetFieldData {
  if (!value?.trim()) return { ...EMPTY_BUDGET, lines: [] };
  try {
    const parsed = JSON.parse(value) as Partial<BudgetFieldData>;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.lines)) {
      return {
        v: 1,
        rateDate: typeof parsed.rateDate === "string" ? parsed.rateDate : "",
        copPerUsd:
          typeof parsed.copPerUsd === "number" && Number.isFinite(parsed.copPerUsd)
            ? parsed.copPerUsd
            : 0,
        lines: parsed.lines
          .filter(
            (line) =>
              line &&
              typeof line.label === "string" &&
              typeof line.cop === "number" &&
              Number.isFinite(line.cop),
          )
          .map((line) => ({
            label: line.label.trim(),
            cop: line.cop,
            usd:
              typeof line.usd === "number" && Number.isFinite(line.usd)
                ? line.usd
                : copToUsd(line.cop, parsed.copPerUsd || 0),
          }))
          .filter((line) => line.label && line.cop > 0),
      };
    }
  } catch {
    // texto legacy
  }
  const legacy = value.trim();
  if (legacy) {
    return {
      v: 1,
      rateDate: "",
      copPerUsd: 0,
      lines: [{ label: legacy, cop: 0, usd: 0 }],
    };
  }
  return { ...EMPTY_BUDGET, lines: [] };
}

export function serializeBudgetField(data: BudgetFieldData): string {
  if (!data.lines.length) return "";
  return JSON.stringify({
    v: 1,
    rateDate: data.rateDate,
    copPerUsd: data.copPerUsd,
    lines: data.lines,
  });
}

export function budgetTotals(data: BudgetFieldData) {
  const totalCop = data.lines.reduce((sum, line) => sum + line.cop, 0);
  const totalUsd = data.lines.reduce((sum, line) => sum + line.usd, 0);
  return { totalCop, totalUsd };
}

export function proposalBudgetTotalCop(
  budgetMinimum: string,
  budgetOptional = "",
) {
  const minimum = budgetTotals(parseBudgetField(budgetMinimum || ""));
  const optional = budgetTotals(parseBudgetField(budgetOptional || ""));
  return minimum.totalCop + optional.totalCop;
}

export type ProposalBudgetCategory = "materials" | "logistics" | "additional";

export type ProposalBudgetSummary = {
  usdRate: number;
  materialsCop: number;
  logisticsCop: number;
  additionalCop: number;
  totalCop: number;
};

function categorizeProposalBudgetLine(label: string): ProposalBudgetCategory {
  const lower = label.toLowerCase();
  if (/log[ií]st|transport|viaje|traslad|aliment|viatic|desplaz/.test(lower)) {
    return "logistics";
  }
  if (/imprev|adicional|extra|contingen|colabor|honorar|facilit|coach|instructor|persona|apoyo/.test(lower)) {
    return "additional";
  }
  return "materials";
}

export function summarizeProposalBudget(
  budgetMinimum: string,
  budgetOptional = "",
): ProposalBudgetSummary {
  const minimum = parseBudgetField(budgetMinimum || "");
  const optional = parseBudgetField(budgetOptional || "");
  const usdRate = minimum.copPerUsd || optional.copPerUsd || 0;

  let materialsCop = 0;
  let logisticsCop = 0;
  let additionalCop = budgetTotals(optional).totalCop;

  for (const line of minimum.lines) {
    const category = categorizeProposalBudgetLine(line.label);
    if (category === "logistics") logisticsCop += line.cop;
    else if (category === "additional") additionalCop += line.cop;
    else materialsCop += line.cop;
  }

  return {
    usdRate,
    materialsCop,
    logisticsCop,
    additionalCop,
    totalCop: materialsCop + logisticsCop + additionalCop,
  };
}

export function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBudgetFieldDisplay(value: string): string {
  const data = parseBudgetField(value);
  if (!data.lines.length) return "—";
  const { totalCop, totalUsd } = budgetTotals(data);
  const rows = data.lines.map(
    (line) =>
      `• ${line.label} — ${formatCop(line.cop)} (${formatUsd(line.usd)})`,
  );
  rows.push(`Total: ${formatCop(totalCop)} (${formatUsd(totalUsd)})`);
  if (data.copPerUsd > 0 && data.rateDate) {
    rows.push(
      `TRM ${data.rateDate.split("-").reverse().join("/")}: ${formatCop(data.copPerUsd)} por US$1`,
    );
  }
  return rows.join("\n");
}

export function formatBudgetFieldHtml(
  value: string,
  escapeHtml: (s: string) => string,
) {
  const data = parseBudgetField(value);
  if (!data.lines.length) return "—";
  const { totalCop, totalUsd } = budgetTotals(data);
  const meta =
    data.copPerUsd > 0 && data.rateDate
      ? `<p class="budget-meta">TRM ${escapeHtml(
          data.rateDate.split("-").reverse().join("/"),
        )}: ${escapeHtml(formatCop(data.copPerUsd))} por US$1</p>`
      : "";
  const rows = data.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.label)}</td>
        <td class="num">${escapeHtml(formatCop(line.cop))}</td>
        <td class="num">${escapeHtml(formatUsd(line.usd))}</td>
      </tr>`,
    )
    .join("");
  return `${meta}<table class="budget"><thead><tr><th>Concepto</th><th>COP</th><th>USD</th></tr></thead><tbody>${rows}<tr class="total"><td><strong>Total</strong></td><td class="num"><strong>${escapeHtml(
    formatCop(totalCop),
  )}</strong></td><td class="num"><strong>${escapeHtml(
    formatUsd(totalUsd),
  )}</strong></td></tr></tbody></table>`;
}
