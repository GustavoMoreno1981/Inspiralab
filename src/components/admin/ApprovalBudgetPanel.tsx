"use client";

import { formatCop, formatUsdFromCop } from "@/lib/accounting/types";
import type { ApprovalBudgetContext } from "@/lib/accounting/approval-budget";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

type Props = {
  budget: ApprovalBudgetContext | null;
  proposedCop?: number;
  compact?: boolean;
};

function MoneyValue({
  amountCop,
  usdRate,
  emphasis = "bold",
}: {
  amountCop: number;
  usdRate: number;
  emphasis?: "bold" | "semibold";
}) {
  return (
    <>
      <p
        className={`${emphasis === "bold" ? "font-bold" : "font-semibold"} text-[color:var(--ink)]`}
      >
        {formatUsdFromCop(amountCop, usdRate)}
      </p>
      <p className="text-[10px] text-[color:var(--muted)]">{formatCop(amountCop)}</p>
    </>
  );
}

export function ApprovalBudgetPanel({ budget, proposedCop = 0, compact = false }: Props) {
  const { t } = useAdminLanguage();
  const p = t.schedule;

  if (!budget) {
    return (
      <div className="border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
        {p.approvalBudgetMissing}
      </div>
    );
  }

  const remainingAfter =
    proposedCop > 0 ? budget.availableCop - proposedCop : budget.availableCop;

  return (
    <div
      className={`border border-[color:var(--line)] bg-white ${
        compact ? "px-3 py-2" : "p-3"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {p.approvalBudgetTitle.replace("{year}", String(budget.year))}
      </p>
      <div className={`mt-2 grid gap-2 ${compact ? "text-xs" : "text-sm sm:grid-cols-2"}`}>
        <div>
          <p className="text-[color:var(--muted)]">{p.approvalBudgetAvailable}</p>
          <MoneyValue amountCop={budget.availableCop} usdRate={budget.usdRate} />
        </div>
        <div>
          <p className="text-[color:var(--muted)]">{p.approvalBudgetAllocated}</p>
          <MoneyValue
            amountCop={budget.workshopAllocatedCop}
            usdRate={budget.usdRate}
            emphasis="semibold"
          />
        </div>
      </div>
      {proposedCop > 0 ? (
        <div className="mt-3 border-t border-[color:var(--line)] pt-3 text-xs">
          <p>
            <span className="text-[color:var(--muted)]">{p.approvalBudgetProposed}: </span>
            <span className="font-semibold text-[color:var(--ink)]">
              {formatUsdFromCop(proposedCop, budget.usdRate)}
            </span>
            <span className="text-[color:var(--muted)]"> · {formatCop(proposedCop)}</span>
          </p>
          <p className="mt-1">
            <span className="text-[color:var(--muted)]">{p.approvalBudgetAfter}: </span>
            <span
              className={`font-semibold ${
                remainingAfter < 0 ? "text-[color:var(--accent)]" : "text-[#177245]"
              }`}
            >
              {formatUsdFromCop(remainingAfter, budget.usdRate)}
            </span>
            <span className="text-[color:var(--muted)]"> · {formatCop(remainingAfter)}</span>
          </p>
          {remainingAfter < 0 ? (
            <p className="mt-1 font-semibold text-[color:var(--accent)]">
              {p.approvalBudgetExceeded}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
