import {
  budgetTotals,
  parseBudgetField,
  type BudgetFieldData,
  type BudgetLine,
} from "@/lib/followup/budget-fields";
import type { WorkshopEvaluation } from "@/lib/followup/types";
import type { WorkshopSession } from "@/lib/schedule/types";
import {
  createId,
  emptyActivityCosts,
  type AccountingBoard,
  type Activity,
  type CostBucket,
  type CostCategory,
} from "./types";

function categorizeBudgetLine(label: string): CostCategory {
  const lower = label.toLowerCase();
  if (/log[ií]st|transport|viaje|traslad|aliment|viatic|desplaz/.test(lower)) {
    return "logistics";
  }
  if (/colabor|honorar|facilit|coach|instructor|persona|apoyo/.test(lower)) {
    return "collaborations";
  }
  if (/imprev|adicional|extra|contingen/.test(lower)) return "contingencies";
  return "materials";
}

function addLinesToCosts(
  costs: Record<CostCategory, CostBucket>,
  lines: BudgetLine[],
  forceCategory?: CostCategory,
) {
  for (const line of lines) {
    const category = forceCategory || categorizeBudgetLine(line.label);
    costs[category].amountCop += Math.round(line.cop || 0);
  }
}

function resolveUsdRate(
  minimum: BudgetFieldData,
  optional: BudgetFieldData,
  board: AccountingBoard,
  sessionDate: string,
) {
  const fromBudget = minimum.copPerUsd || optional.copPerUsd;
  if (fromBudget > 0) return fromBudget;
  const year = sessionDate?.slice(0, 4);
  const annual = board.budgets.find((item) => String(item.year) === year);
  return annual?.usdRate || board.budgets[0]?.usdRate || 4000;
}

export function buildActivityFromApprovedSession(
  session: WorkshopSession,
  evaluation: WorkshopEvaluation | null,
  board: AccountingBoard,
  existing?: Activity,
): Activity | null {
  const beneficiaryId = session.beneficiaryIds[0] || "";
  if (!beneficiaryId) return null;
  if (!board.beneficiaries.some((item) => item.id === beneficiaryId)) return null;

  const minimum = parseBudgetField(evaluation?.fields.budgetMinimum || "");
  const optional = parseBudgetField(evaluation?.fields.budgetOptional || "");
  const { totalCop: minimumCop } = budgetTotals(minimum);
  const { totalCop: optionalCop } = budgetTotals(optional);
  const totalCop = minimumCop + optionalCop;

  const costs = emptyActivityCosts();
  addLinesToCosts(costs, minimum.lines);
  addLinesToCosts(costs, optional.lines, "contingencies");

  const now = new Date().toISOString();
  const usdRate = resolveUsdRate(minimum, optional, board, session.date);
  const kindLabel = session.kind === "event" ? "Evento" : "Taller";
  const beneficiaryNames = session.beneficiaryIds
    .map((id) => board.beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const notes = [
    `Generado desde cronograma (${kindLabel} aprobado).`,
    beneficiaryNames ? `Beneficiarios: ${beneficiaryNames}.` : "",
    evaluation?.evaluatedBy ? `Propuesta por: ${evaluation.evaluatedBy}.` : "",
    session.location ? `Lugar: ${session.location}.` : "",
    session.coach ? `Facilitador: ${session.coach}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: existing?.id || createId("act"),
    beneficiaryId,
    title: session.title || session.eventName || "Actividad del cronograma",
    date: session.date || now.slice(0, 10),
    usdRate,
    receivedCop: totalCop,
    costs: {
      materials: {
        amountCop: costs.materials.amountCop,
        files: existing?.costs.materials.files || [],
      },
      logistics: {
        amountCop: costs.logistics.amountCop,
        files: existing?.costs.logistics.files || [],
      },
      collaborations: {
        amountCop: costs.collaborations.amountCop,
        files: existing?.costs.collaborations.files || [],
      },
      contingencies: {
        amountCop: costs.contingencies.amountCop,
        files: existing?.costs.contingencies.files || [],
      },
    },
    notes,
    scheduleSessionId: session.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function wasApprovedTransition(
  previous: WorkshopSession | undefined,
  next: WorkshopSession,
) {
  return (
    next.status === "scheduled" &&
    previous?.status === "pending_approval"
  );
}

function shouldSyncSession(
  previous: WorkshopSession | undefined,
  next: WorkshopSession,
  activities: Activity[],
) {
  if (next.status !== "scheduled" && next.status !== "done") return false;
  if (!next.beneficiaryIds.length) return false;
  const exists = activities.some((item) => item.scheduleSessionId === next.id);
  if (wasApprovedTransition(previous, next)) return true;
  return !exists;
}

export async function syncApprovedSessionsToAccounting(
  previousSessions: WorkshopSession[],
  nextSessions: WorkshopSession[],
  options: {
    readAccountingBoard: () => Promise<AccountingBoard>;
    writeAccountingBoard: (board: AccountingBoard) => Promise<void>;
    readFollowUpBoard: () => Promise<{ evaluations: WorkshopEvaluation[] }>;
  },
): Promise<{ synced: number; skipped: number }> {
  const previousById = new Map(previousSessions.map((item) => [item.id, item]));
  const accountingBoard = await options.readAccountingBoard();
  const candidates = nextSessions.filter((session) =>
    shouldSyncSession(
      previousById.get(session.id),
      session,
      accountingBoard.activities,
    ),
  );

  if (!candidates.length) return { synced: 0, skipped: 0 };

  const followUpBoard = await options.readFollowUpBoard();
  const evaluationsBySession = new Map(
    followUpBoard.evaluations.map((item) => [item.sessionId, item]),
  );

  let synced = 0;
  let skipped = 0;
  const nextActivities = [...accountingBoard.activities];

  for (const session of candidates) {
    const evaluation = evaluationsBySession.get(session.id) || null;
    const existingIndex = nextActivities.findIndex(
      (item) => item.scheduleSessionId === session.id,
    );
    const existing = existingIndex >= 0 ? nextActivities[existingIndex] : undefined;
    const activity = buildActivityFromApprovedSession(
      session,
      evaluation,
      accountingBoard,
      existing,
    );
    if (!activity) {
      skipped += 1;
      continue;
    }

    if (existingIndex >= 0) {
      nextActivities[existingIndex] = activity;
    } else {
      nextActivities.unshift(activity);
    }
    synced += 1;
  }

  if (synced > 0) {
    await options.writeAccountingBoard({
      ...accountingBoard,
      activities: nextActivities,
    });
  }

  return { synced, skipped };
}
