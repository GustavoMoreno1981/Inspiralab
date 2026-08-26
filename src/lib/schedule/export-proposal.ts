import {
  budgetTotals,
  formatCop,
  formatUsd,
  parseBudgetField,
} from "@/lib/followup/budget-fields";
import {
  SECTION_TITLES,
  fieldsForPhase,
  type EvaluationFields,
} from "@/lib/followup/types";
import { formatFieldHtml } from "@/lib/followup/list-fields";
import type { ScheduleBeneficiary, WorkshopSession } from "@/lib/schedule/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function formatTimeRange(start: string, end: string) {
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "—";
}

function sessionTitle(session: WorkshopSession) {
  if (session.kind === "event") {
    return session.eventName || session.title || "Evento";
  }
  return session.title || "Taller";
}

function beneficiaryLabel(
  session: WorkshopSession,
  beneficiaries: ScheduleBeneficiary[],
) {
  const names = (session.beneficiaryIds || [])
    .map((id) => beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Sin beneficiario";
}

function budgetSectionHtml(
  title: string,
  value: string,
  escape: (s: string) => string,
) {
  const data = parseBudgetField(value);
  if (!data.lines.length) {
    return `<section class="block"><h3>${escape(title)}</h3><p class="muted">Sin partidas registradas.</p></section>`;
  }
  const { totalCop, totalUsd } = budgetTotals(data);
  const trm =
    data.copPerUsd > 0 && data.rateDate
      ? `<p class="trm">TRM ${escape(
          formatDate(data.rateDate),
        )}: ${escape(formatCop(data.copPerUsd))} por US$1</p>`
      : "";
  const rows = data.lines
    .map(
      (line) =>
        `<tr><td>${escape(line.label)}</td><td class="num">${escape(
          formatCop(line.cop),
        )}</td><td class="num">${escape(formatUsd(line.usd))}</td></tr>`,
    )
    .join("");
  return `<section class="block budget-block">
    <h3>${escape(title)}</h3>
    ${trm}
    <table class="budget">
      <thead><tr><th>Concepto</th><th>COP</th><th>USD</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total"><td><strong>Subtotal</strong></td><td class="num"><strong>${escape(
          formatCop(totalCop),
        )}</strong></td><td class="num"><strong>${escape(
          formatUsd(totalUsd),
        )}</strong></td></tr>
      </tbody>
    </table>
  </section>`;
}

function combinedBudgetSummary(fields: EvaluationFields) {
  const min = parseBudgetField(fields.budgetMinimum);
  const extra = parseBudgetField(fields.budgetOptional);
  const totalCop =
    budgetTotals(min).totalCop + budgetTotals(extra).totalCop;
  const totalUsd =
    budgetTotals(min).totalUsd + budgetTotals(extra).totalUsd;
  if (!totalCop && !totalUsd) return "";
  return `<section class="block highlight">
    <h3>Presupuesto total estimado</h3>
    <p class="total-line"><strong>${escapeHtml(
      formatCop(totalCop),
    )}</strong> · ${escapeHtml(formatUsd(totalUsd))}</p>
  </section>`;
}

export function buildProposalHtml({
  session,
  fields,
  evaluatedBy,
  beneficiaries,
  statusLabel = "Pendiente de aprobación",
}: {
  session: WorkshopSession;
  fields: EvaluationFields;
  evaluatedBy: string;
  beneficiaries: ScheduleBeneficiary[];
  statusLabel?: string;
}) {
  const beforeFields = fieldsForPhase("before");
  const sections = new Map<number, typeof beforeFields>();
  for (const field of beforeFields) {
    if (field.inputType === "budget") continue;
    const list = sections.get(field.section) || [];
    list.push(field);
    sections.set(field.section, list);
  }

  const sectionBlocks = [...sections.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sectionNumber, sectionFields]) => {
      const rows = sectionFields
        .map((field) => {
          const value = fields[field.key] || "";
          return `<div class="field">
            <p class="q">${field.letter ? `${field.letter}. ` : ""}${escapeHtml(
              field.label,
            )}</p>
            <div class="a">${formatFieldHtml(value, field, escapeHtml)}</div>
          </div>`;
        })
        .join("");
      return `<section class="block">
        <h3>${sectionNumber}. ${escapeHtml(SECTION_TITLES[sectionNumber] || "")}</h3>
        ${rows}
      </section>`;
    })
    .join("");

  const budgetBlocks = `
    ${budgetSectionHtml("4A. Presupuesto mínimo", fields.budgetMinimum, escapeHtml)}
    ${budgetSectionHtml("4B. Gastos adicionales o imprevistos", fields.budgetOptional, escapeHtml)}
    ${combinedBudgetSummary(fields)}
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Propuesta · ${escapeHtml(sessionTitle(session))}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 820px; margin: 0 auto; padding: 32px 28px; line-height: 1.5; }
    .brand { color: #e00d45; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; margin: 0; }
    h1 { font-size: 28px; margin: 8px 0 6px; line-height: 1.2; }
    .meta { color: #555; margin: 0 0 8px; font-size: 14px; }
    .status { display: inline-block; margin: 0 0 24px; padding: 4px 10px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    h2 { font-size: 18px; margin: 28px 0 12px; border-bottom: 2px solid #e00d45; padding-bottom: 6px; color: #1a1a1a; }
    h3 { font-size: 15px; margin: 0 0 10px; color: #333; }
    .block { margin: 0 0 22px; page-break-inside: avoid; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin: 0 0 8px; font-size: 14px; }
    .summary-grid dt { font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px; }
    .summary-grid dd { margin: 0 0 10px; }
    .field { margin: 0 0 14px; }
    .q { font-weight: 700; margin: 0 0 4px; font-size: 13px; }
    .a { margin: 0; color: #333; }
    .a ul.items { margin: 0; padding-left: 1.25rem; }
    .a ul.items li { margin: 0 0 4px; }
    .muted { color: #777; font-style: italic; }
    .trm { margin: 0 0 8px; font-size: 12px; color: #666; }
    table.budget { width: 100%; border-collapse: collapse; margin: 8px 0 0; font-size: 13px; }
    table.budget th, table.budget td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
    table.budget td.num, table.budget th:nth-child(2), table.budget th:nth-child(3) { text-align: right; white-space: nowrap; }
    table.budget thead { background: #f5f5f5; }
    table.budget tr.total { background: #fafafa; }
    .budget-block { background: #fcfcfc; border: 1px solid #e8e8e8; padding: 14px 16px; }
    .highlight { background: #fff8fa; border: 1px solid #f5c2d0; padding: 14px 16px; }
    .total-line { font-size: 18px; margin: 0; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    @media print { body { padding: 0; } @page { margin: 14mm; } }
  </style>
</head>
<body>
  <p class="brand">Inspiralab</p>
  <h1>Propuesta de ${session.kind === "event" ? "evento" : "taller"}</h1>
  <p class="meta">${escapeHtml(sessionTitle(session))}</p>
  <p class="status">${escapeHtml(statusLabel)}</p>

  <h2>Datos de la sesión</h2>
  <dl class="summary-grid">
    <div><dt>Tipo</dt><dd>${session.kind === "event" ? "Evento" : "Taller"}</dd></div>
    <div><dt>Fecha propuesta</dt><dd>${escapeHtml(formatDate(session.date))}</dd></div>
    <div><dt>Horario</dt><dd>${escapeHtml(formatTimeRange(session.startTime, session.endTime))}</dd></div>
    <div><dt>Lugar</dt><dd>${escapeHtml(session.location || "—")}</dd></div>
    <div><dt>Coach / responsable</dt><dd>${escapeHtml(session.coach || "—")}</dd></div>
    <div><dt>Beneficiario(s)</dt><dd>${escapeHtml(beneficiaryLabel(session, beneficiaries))}</dd></div>
    <div><dt>Elaboró la propuesta</dt><dd>${escapeHtml(evaluatedBy || "—")}</dd></div>
    <div><dt>Aprobación</dt><dd>Don Saul / equipo autorizado</dd></div>
  </dl>
  ${
    session.notes.trim()
      ? `<p class="meta"><strong>Notas:</strong> ${escapeHtml(session.notes).replaceAll("\n", "<br/>")}</p>`
      : ""
  }

  <h2>Planificación previa</h2>
  ${sectionBlocks}

  <h2>Presupuesto</h2>
  ${budgetBlocks}

  <div class="footer">
    Documento generado el ${escapeHtml(
      new Date().toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    )} · Inspiralab
  </div>
</body>
</html>`;
}

export function printProposalDocument(input: Parameters<typeof buildProposalHtml>[0]) {
  const html = buildProposalHtml(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      // impresión manual
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  return true;
}
