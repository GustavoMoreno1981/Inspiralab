"use client";

import {
  summarizeProposalBudget,
  type ProposalBudgetSummary,
} from "@/lib/followup/budget-fields";
import { formatCop, formatUsdFromCop } from "@/lib/accounting/types";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type Props = {
  budgetMinimum: string;
  budgetOptional?: string;
  compact?: boolean;
};

function MoneyLine({
  label,
  amountCop,
  usdRate,
}: {
  label: string;
  amountCop: number;
  usdRate: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[color:var(--muted)]">{label}</span>
      <div className="text-right">
        <p className="font-semibold tabular-nums text-[color:var(--ink)]">
          {formatUsdFromCop(amountCop, usdRate)}
        </p>
        <p className="text-[10px] tabular-nums text-[color:var(--muted)]">
          {formatCop(amountCop)}
        </p>
      </div>
    </div>
  );
}

export function ProposalBudgetBreakdown({
  budgetMinimum,
  budgetOptional = "",
  compact = false,
}: Props) {
  const { t } = useAdminLanguage();
  const p = t.schedule;
  const summary = summarizeProposalBudget(budgetMinimum, budgetOptional);

  if (summary.totalCop <= 0) {
    return (
      <p className="text-xs text-[color:var(--muted)]">{p.approvalProposalBudgetEmpty}</p>
    );
  }

  return (
    <div
      className={`space-y-2 border border-[color:var(--line)] bg-[color:var(--mist)]/40 ${
        compact ? "px-2.5 py-2" : "p-3"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {p.approvalProposalBudgetTitle}
      </p>
      <MoneyLine
        label={p.approvalProposalMaterials}
        amountCop={summary.materialsCop}
        usdRate={summary.usdRate}
      />
      <MoneyLine
        label={p.approvalProposalLogistics}
        amountCop={summary.logisticsCop}
        usdRate={summary.usdRate}
      />
      <MoneyLine
        label={p.approvalProposalAdditional}
        amountCop={summary.additionalCop}
        usdRate={summary.usdRate}
      />
      <div className="border-t border-[color:var(--line)] pt-2">
        <MoneyLine
          label={p.approvalProposalTotal}
          amountCop={summary.totalCop}
          usdRate={summary.usdRate}
        />
      </div>
    </div>
  );
}

export function proposalBudgetSummaryFromFields(
  budgetMinimum: string,
  budgetOptional = "",
): ProposalBudgetSummary {
  return summarizeProposalBudget(budgetMinimum, budgetOptional);
}
