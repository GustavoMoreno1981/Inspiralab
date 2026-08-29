import {
  formatCop,
  formatUsdFromCop,
  getYearSummary,
  type AccountingBoard,
} from "@/lib/accounting/types";
import type { AdminDictionary } from "@/lib/i18n/admin/types";
import { formatAdmin } from "@/lib/i18n/admin/helpers";
import { buildTaskAlarmMessage } from "@/lib/i18n/admin/alarms";
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

export function getTaskAlarms(
  board: TasksBoard,
  t: AdminDictionary,
  from = todayLocal(),
): TaskAlarm[] {
  return board.activities
    .map((activity) => {
      const { level, reason } = getTaskAlarmReason(activity, from);
      const days = daysUntilDue(activity.finishedDate, from);
      const assignees = assigneeNames(activity, board.members);
      const message = buildTaskAlarmMessage(t, {
        title: activity.title,
        reason,
        assignees,
        days,
        finishedDate: activity.finishedDate,
      });

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
export function getTaskNotifications(
  board: TasksBoard,
  t: AdminDictionary,
  from = todayLocal(),
) {
  return getTaskAlarms(board, t, from).filter(
    (item) => item.level === "red" || item.level === "yellow",
  );
}

export function getBudgetAlarm(
  board: AccountingBoard,
  t: AdminDictionary,
  year = new Date().getFullYear(),
): BudgetAlarm | null {
  const summary = getYearSummary(board, year);
  if (!summary.budget || summary.totalCop <= 0) return null;

  const { usedPercent, totalCop, spentCop, availableCop, rate } = summary;

  let level: BudgetAlarmLevel = "ok";
  let message = formatAdmin(t.alarms.messages.budgetOk, {
    year,
    percent: usedPercent,
    availableUsd: formatUsdFromCop(availableCop, rate),
    availableCop: formatCop(availableCop),
  });

  if (spentCop > totalCop) {
    level = "critical";
    const over = spentCop - totalCop;
    message = formatAdmin(t.alarms.messages.budgetCritical, {
      year,
      overUsd: formatUsdFromCop(over, rate),
      overCop: formatCop(over),
      percent: usedPercent,
    });
  } else if (usedPercent >= BUDGET_WARNING_PERCENT) {
    level = "warning";
    message = formatAdmin(t.alarms.messages.budgetWarning, {
      year,
      percent: usedPercent,
      availableUsd: formatUsdFromCop(availableCop, rate),
      availableCop: formatCop(availableCop),
    });
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

export function getBudgetAlarms(board: AccountingBoard, t: AdminDictionary): BudgetAlarm[] {
  const years = new Set<number>([
    new Date().getFullYear(),
    ...board.budgets.map((b) => b.year),
  ]);
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => getBudgetAlarm(board, t, year))
    .filter((item): item is BudgetAlarm => Boolean(item))
    .filter((item) => item.level === "warning" || item.level === "critical");
}
