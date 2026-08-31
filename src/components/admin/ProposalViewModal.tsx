"use client";

import {
  SECTION_TITLES,
  fieldsForPhase,
  type EvaluationFields,
} from "@/lib/followup/types";
import { formatFieldDisplay, isBudgetField } from "@/lib/followup/list-fields";
import type { ApprovalBudgetContext } from "@/lib/accounting/approval-budget";
import { ApprovalBudgetPanel } from "@/components/admin/ApprovalBudgetPanel";
import { ProposalBudgetBreakdown } from "@/components/admin/ProposalBudgetBreakdown";
import type { ScheduleBeneficiary, WorkshopSession } from "@/lib/schedule/types";

type Props = {
  open: boolean;
  session: WorkshopSession | null;
  fields: EvaluationFields;
  evaluatedBy: string;
  beneficiaries: ScheduleBeneficiary[];
  saving?: boolean;
  canApprove?: boolean;
  approvalBudget?: ApprovalBudgetContext | null;
  proposedCop?: number;
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onApprove: () => void;
};

function sessionTitle(session: WorkshopSession) {
  if (session.kind === "event") {
    return session.eventName || session.title || "Evento";
  }
  return session.title || "Taller";
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

function beneficiaryNames(
  ids: string[],
  beneficiaries: ScheduleBeneficiary[],
) {
  const names = ids
    .map((id) => beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

function FieldValue({
  value,
  field,
}: {
  value: string;
  field: ReturnType<typeof fieldsForPhase>[number];
}) {
  const display = formatFieldDisplay(value, field);
  if (isBudgetField(field)) {
    return (
      <p className="whitespace-pre-line text-sm text-[color:var(--ink)]">
        {display}
      </p>
    );
  }
  if (field.inputType === "list") {
    const items = display.split("\n").filter((line) => line.startsWith("• "));
    if (items.length === 0) {
      return <p className="text-sm text-[color:var(--muted)]">—</p>;
    }
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ink)]">
        {items.map((item) => (
          <li key={item}>{item.replace(/^•\s*/, "")}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">
      {display}
    </p>
  );
}

export function ProposalViewModal({
  open,
  session,
  fields,
  evaluatedBy,
  beneficiaries,
  saving = false,
  canApprove = false,
  approvalBudget = null,
  proposedCop = 0,
  onClose,
  onEdit,
  onPrint,
  onApprove,
}: Props) {
  if (!open || !session) return null;

  const beforeFields = fieldsForPhase("before");
  const sections = new Map<number, typeof beforeFields>();
  for (const field of beforeFields) {
    if (isBudgetField(field)) continue;
    const list = sections.get(field.section) || [];
    list.push(field);
    sections.set(field.section, list);
  }

  const budgetFields = beforeFields.filter(isBudgetField);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-2xl flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Pendiente de aprobación
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
              {sessionTitle(session)}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {canApprove ? (
            <div className="mb-4">
              <ApprovalBudgetPanel budget={approvalBudget} proposedCop={proposedCop} />
            </div>
          ) : null}

          <div className="mb-4">
            <ProposalBudgetBreakdown
              budgetMinimum={fields.budgetMinimum}
              budgetOptional={fields.budgetOptional}
            />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Tipo
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink)]">
                {session.kind === "event" ? "Evento" : "Taller"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Coach / facilita
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink)]">
                {session.coach || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Lugar
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink)]">
                {session.location || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Beneficiarios
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink)]">
                {beneficiaryNames(session.beneficiaryIds || [], beneficiaries)}
              </dd>
            </div>
          </dl>

          {session.notes ? (
            <div className="mt-4 border border-[color:var(--line)] bg-[color:var(--mist)]/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Notas
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--ink)]">
                {session.notes}
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[color:var(--ink)]">
                Planificación previa
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                Elaboró: {evaluatedBy || "—"}
              </p>
            </div>

            {[...sections.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([sectionNumber, sectionFields]) => (
                <section
                  key={sectionNumber}
                  className="space-y-3 border border-[color:var(--line)] bg-white p-3"
                >
                  <h4 className="text-xs font-bold text-[color:var(--ink)]">
                    {sectionNumber}. {SECTION_TITLES[sectionNumber]}
                  </h4>
                  {sectionFields.map((field) => (
                    <div key={field.key}>
                      <p className="text-xs font-semibold text-[color:var(--muted)]">
                        {field.letter ? `${field.letter} — ` : ""}
                        {field.label}
                      </p>
                      <div className="mt-1">
                        <FieldValue value={fields[field.key]} field={field} />
                      </div>
                    </div>
                  ))}
                </section>
              ))}

            {budgetFields.length > 0 ? (
              <section className="space-y-3 border border-[color:var(--line)] bg-white p-3">
                <h4 className="text-xs font-bold text-[color:var(--ink)]">
                  4. Presupuesto
                </h4>
                {budgetFields.map((field) => (
                  <div key={field.key}>
                    <p className="text-xs font-semibold text-[color:var(--muted)]">
                      {field.letter ? `${field.letter} — ` : ""}
                      {field.label}
                    </p>
                    <div className="mt-1">
                      <FieldValue value={fields[field.key]} field={field} />
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] bg-white px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {canApprove ? (
              <button
                type="button"
                disabled={saving}
                onClick={onApprove}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Aprobar y programar
              </button>
            ) : null}
            <button
              type="button"
              onClick={onPrint}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Imprimir propuesta
            </button>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
          >
            Editar propuesta
          </button>
        </div>
      </div>
    </div>
  );
}
