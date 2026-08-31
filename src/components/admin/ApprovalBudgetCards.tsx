"use client";

import { formatCop, formatUsdFromCop } from "@/lib/accounting/types";
import type { ApprovalBudgetContext } from "@/lib/accounting/approval-budget";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type Props = {
  budget: ApprovalBudgetContext | null;
};

function BudgetCard({
  label,
  amountCop,
  usdRate,
}: {
  label: string;
  amountCop: number;
  usdRate: number;
}) {
  return (
    <div className="border border-[color:var(--line)] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-bold text-[color:var(--ink)]">
        {formatUsdFromCop(amountCop, usdRate)}
      </p>
      <p className="text-[10px] text-[color:var(--muted)]">{formatCop(amountCop)}</p>
    </div>
  );
}

export function ApprovalBudgetCards({ budget }: Props) {
  const { t } = useAdminLanguage();

  if (!budget) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {t.schedule.approvalBudgetMissing}
      </div>
    );
  }

  const title = t.schedule.approvalBudgetTitle.replace("{year}", String(budget.year));

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <BudgetCard
          label={t.schedule.approvalBudgetAvailable}
          amountCop={budget.availableCop}
          usdRate={budget.usdRate}
        />
        <BudgetCard
          label={t.schedule.approvalBudgetAllocated}
          amountCop={budget.workshopAllocatedCop}
          usdRate={budget.usdRate}
        />
      </div>
    </section>
  );
}
