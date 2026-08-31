"use client";

import type { EvaluationFields } from "@/lib/followup/types";
import { ProposalBudgetBreakdown } from "@/components/admin/ProposalBudgetBreakdown";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import type { ScheduleBeneficiary, WorkshopSession } from "@/lib/schedule/types";

type Props = {
  open: boolean;
  sessions: WorkshopSession[];
  beneficiaries: ScheduleBeneficiary[];
  proposalFieldsFor: (sessionId: string) => EvaluationFields;
  formatTimeRange: (start: string, end: string) => string;
  sessionDisplayTitle: (session: WorkshopSession) => string;
  beneficiaryNames: (
    session: WorkshopSession,
    beneficiaries: ScheduleBeneficiary[],
    noBeneficiary: string,
  ) => string;
  onClose: () => void;
  onPrint: (session: WorkshopSession) => void;
  onView: (session: WorkshopSession) => void;
  onEdit: (session: WorkshopSession) => void;
};

export function RejectedProposalsModal({
  open,
  sessions,
  beneficiaries,
  proposalFieldsFor,
  formatTimeRange,
  sessionDisplayTitle,
  beneficiaryNames,
  onClose,
  onPrint,
  onView,
  onEdit,
}: Props) {
  const { t } = useAdminLanguage();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
              {t.schedule.rejectedApproval}
              {sessions.length > 0 ? ` (${sessions.length})` : ""}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{t.schedule.rejectedHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
          >
            {t.common.close}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">{t.schedule.noRejectedProposals}</p>
          ) : (
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="border border-red-200 bg-red-50/40 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {sessionDisplayTitle(session)}
                  </p>
                  <p className="mt-1.5">
                    <span className="text-sm font-bold tabular-nums text-[color:var(--ink)]">
                      {session.date.split("-").reverse().join("/")}
                    </span>
                    <span className="mx-1 text-sm text-[color:var(--muted)]">·</span>
                    <span className="text-sm font-medium text-[color:var(--ink)]">
                      {formatTimeRange(session.startTime, session.endTime)}
                    </span>
                  </p>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-[color:var(--ink)]">
                        {t.schedule.where}
                      </dt>
                      <dd className="text-[color:var(--ink)]">
                        {session.location?.trim() || t.schedule.noPlace}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-[color:var(--ink)]">
                        {t.schedule.beneficiary}
                      </dt>
                      <dd className="text-[color:var(--ink)]">
                        {beneficiaryNames(session, beneficiaries, t.schedule.noBeneficiary)}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-[color:var(--ink)]">
                        {t.schedule.coach}
                      </dt>
                      <dd className="text-[color:var(--ink)]">
                        {session.coach?.trim() || t.schedule.noCoach}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2">
                    <ProposalBudgetBreakdown
                      compact
                      budgetMinimum={proposalFieldsFor(session.id).budgetMinimum}
                      budgetOptional={proposalFieldsFor(session.id).budgetOptional}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onPrint(session)}
                      className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                    >
                      {t.schedule.printProposal}
                    </button>
                    <button
                      type="button"
                      onClick={() => onView(session)}
                      className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                    >
                      {t.common.view}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(session)}
                      className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                    >
                      {t.common.edit}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
