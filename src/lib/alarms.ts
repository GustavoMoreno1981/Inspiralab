import {
  formatCop,
  formatUsdFromCop,
  getYearSummary,
  type AccountingBoard,
} from "@/lib/accounting/types";
import type { Activity, TasksBoard, TeamMember } from "@/lib/tasks/types";

export type TaskAlarmLevel = "green" | "yellow" | "red" | "blue" | "gray";

export type TaskAlarmReason =
  | "done"
  | "paused"
  | "overdue"
  | "due_soon"
  | "pending_review"
  | "on_track";

export type TaskAlarm = {
  activityId: string;
  title: string;
  finishedDate: string;
  status: Activity["status"];
  level: TaskAlarmLevel;
  reason: TaskAlarmReason;
  daysUntilDue: number | null;
  assignees: TeamMember[];
  message: string;
};

export type BudgetAlarmLevel = "ok" | "warning" | "critical";

export type BudgetAlarm = {
  year: number;
  level: BudgetAlarmLevel;
  usedPercent: number;
  totalCop: number;
  spentCop: number;
  availableCop: number;
  rate: number;
  message: string;
};

/** Umbral de aviso: se acerca al tope del presupuesto anual. */
export const BUDGET_WARNING_PERCENT = 80;

/** Días antes del fin para semáforo amarillo. */
export const TASK_DUE_SOON_DAYS = 3;

export const TASK_ALARM_COLORS: Record<
  TaskAlarmLevel,
  { bg: string; text: string; label: string }
> = {
  green: { bg: "#16a34a", text: "#fff", label: "Terminada" },
  yellow: { bg: "#ca8a04", text: "#fff", label: "Por vencer / revisión" },
  red: { bg: "#dc2626", text: "#fff", label: "Vencida" },
  blue: { bg: "#2563eb", text: "#fff", label: "En pausa" },
  gray: { bg: "#94a3b8", text: "#fff", label: "En plazo" },
};

function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateOnly(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntilDue(finishedDate: string, from = todayLocal()): number | null {
  const end = parseDateOnly(finishedDate);
  if (!end) return null;
  return Math.round((end.getTime() - from.getTime()) / 86_400_000);
}

export function getTaskAlarmLevel(activity: Activity, from = todayLocal()): TaskAlarmLevel {
  return getTaskAlarmReason(activity, from).level;
}

export function getTaskAlarmReason(
  activity: Activity,
  from = todayLocal(),
): { level: TaskAlarmLevel; reason: TaskAlarmReason } {
  if (activity.status === "done") return { level: "green", reason: "done" };
  if (activity.status === "paused") return { level: "blue", reason: "paused" };

  const days = daysUntilDue(activity.finishedDate, from);
  if (days !== null && days < 0) return { level: "red", reason: "overdue" };
  if (activity.status === "pending_review") {
    return { level: "yellow", reason: "pending_review" };
  }
  if (days !== null && days <= TASK_DUE_SOON_DAYS) {
    return { level: "yellow", reason: "due_soon" };
  }
  return { level: "gray", reason: "on_track" };
}

function assigneeNames(activity: Activity, members: TeamMember[]) {
  const list = activity.assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is TeamMember => Boolean(m));
  return list;
}

function formatAssignees(assignees: TeamMember[]) {
  if (assignees.length === 0) return "Sin asignar";
  return assignees.map((m) => m.name).join(", ");
}

export function getTaskAlarms(board: TasksBoard, from = todayLocal()): TaskAlarm[] {
  return board.activities
    .map((activity) => {
      const { level, reason } = getTaskAlarmReason(activity, from);
      const days = daysUntilDue(activity.finishedDate, from);
      const assignees = assigneeNames(activity, board.members);
      const who = formatAssignees(assignees);
      let message = "";

      if (reason === "overdue") {
        const overdue = days === null ? 0 : Math.abs(days);
        const verb = assignees.length === 1 ? "no ha terminado" : "no han terminado";
        message = `${who} ${verb} “${activity.title}” (vencida hace ${overdue} día${overdue === 1 ? "" : "s"}, fin ${activity.finishedDate}).`;
      } else if (reason === "pending_review") {
        const verb = assignees.length === 1 ? "tiene" : "tienen";
        message = `${who} ${verb} “${activity.title}” pendiente por revisión.`;
      } else if (reason === "due_soon") {
        const verb = assignees.length === 1 ? "tiene" : "tienen";
        const daysLeft = days ?? 0;
        message = `${who} ${verb} “${activity.title}” por vencer en ${daysLeft} día${daysLeft === 1 ? "" : "s"} (fin ${activity.finishedDate}).`;
      } else if (reason === "paused") {
        message = `“${activity.title}” está en pausa (${who}).`;
      } else if (reason === "done") {
        message = `“${activity.title}” terminada (${who}).`;
      } else {
        message = `“${activity.title}” en plazo (${who}).`;
      }

      return {
        activityId: activity.id,
        title: activity.title,
        finishedDate: activity.finishedDate,
        status: activity.status,
        level,
        reason,
        daysUntilDue: days,
        assignees,
        message,
      };
    })
    .sort((a, b) => {
      const order: Record<TaskAlarmLevel, number> = {
        red: 0,
        yellow: 1,
        blue: 2,
        green: 3,
        gray: 4,
      };
      const reasonOrder: Record<TaskAlarmReason, number> = {
        overdue: 0,
        pending_review: 1,
        due_soon: 2,
        paused: 3,
        done: 4,
        on_track: 5,
      };
      return (
        order[a.level] - order[b.level] ||
        reasonOrder[a.reason] - reasonOrder[b.reason] ||
        a.title.localeCompare(b.title)
      );
    });
}

/** Alarmas que requieren atención (vencidas / por vencer / revisión). */
export function getTaskNotifications(board: TasksBoard, from = todayLocal()) {
  return getTaskAlarms(board, from).filter(
    (item) => item.level === "red" || item.level === "yellow",
  );
}

export function getBudgetAlarm(
  board: AccountingBoard,
  year = new Date().getFullYear(),
): BudgetAlarm | null {
  const summary = getYearSummary(board, year);
  if (!summary.budget || summary.totalCop <= 0) return null;

  const { usedPercent, totalCop, spentCop, availableCop, rate } = summary;

  let level: BudgetAlarmLevel = "ok";
  let message = `Presupuesto ${year}: uso ${usedPercent}%. Disponible ${formatUsdFromCop(availableCop, rate)} (${formatCop(availableCop)}).`;

  if (spentCop > totalCop) {
    level = "critical";
    const over = spentCop - totalCop;
    message = `Presupuesto ${year} excedido: se pasó por ${formatUsdFromCop(over, rate)} (${formatCop(over)}). Ejecutado ${usedPercent}% del tope anual.`;
  } else if (usedPercent >= BUDGET_WARNING_PERCENT) {
    level = "warning";
    message = `Presupuesto ${year} cerca del tope: ya se usó el ${usedPercent}%. Queda ${formatUsdFromCop(availableCop, rate)} (${formatCop(availableCop)}).`;
  }

  return {
    year,
    level,
    usedPercent,
    totalCop,
    spentCop,
    availableCop,
    rate,
    message,
  };
}

export function getBudgetAlarms(board: AccountingBoard): BudgetAlarm[] {
  const years = new Set<number>([
    new Date().getFullYear(),
    ...board.budgets.map((b) => b.year),
  ]);
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => getBudgetAlarm(board, year))
    .filter((item): item is BudgetAlarm => Boolean(item))
    .filter((item) => item.level === "warning" || item.level === "critical");
}
