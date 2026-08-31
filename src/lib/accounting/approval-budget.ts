import { getYearSummary } from "./types";
import { readAccountingBoard } from "./store";

export type ApprovalBudgetContext = {
  year: number;
  annualBudgetCop: number;
  workshopAllocatedCop: number;
  availableCop: number;
  usdRate: number;
};

export async function getApprovalBudgetContext(
  year = new Date().getFullYear(),
): Promise<ApprovalBudgetContext | null> {
  const board = await readAccountingBoard();
  const summary = getYearSummary(board, year);
  if (!summary.budget) return null;
  return {
    year,
    annualBudgetCop: summary.totalCop,
    workshopAllocatedCop: summary.activitiesReceivedCop,
    availableCop: summary.availableCop,
    usdRate: summary.rate,
  };
}
