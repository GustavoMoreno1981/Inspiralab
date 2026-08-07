import {
  formatCop,
  formatUsdFromCop,
  getYearSummary,
  type AccountingBoard,
} from "@/lib/accounting/types";
import type { Task, TasksBoard, TeamMember } from "@/lib/tasks/types";

export type TaskAlarmLevel = "green" | "yellow" | "red" | "blue" | "none";

export type TaskAlarm = {
  taskId: string;
  title: string;
  finishedDate: string;
  status: Task["status"];
  level: TaskAlarmLevel;
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
  Exclude<TaskAlarmLevel, "none">,
  { bg: string; text: string; label: string }
> = {
  green: { bg: "#16a34a", text: "#fff", label: "Terminada" },
  yellow: { bg: "#ca8a04", text: "#fff", label: "Por vencer (3 días)" },
  red: { bg: "#dc2626", text: "#fff", label: "Vencida" },
  blue: { bg: "#2563eb", text: "#fff", label: "En pausa" },
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

/**
 * Semáforo de tarea:
 * - verde: terminada
 * - azul: pausada
 * - rojo: no terminada y fecha fin ya pasó
 * - amarillo: no terminada y faltan ≤ 3 días
 * - none: en curso con margen o sin fecha fin
 */
export function getTaskAlarmLevel(task: Task, from = todayLocal()): TaskAlarmLevel {
  if (task.status === "done") return "green";
  if (task.status === "paused") return "blue";

  const days = daysUntilDue(task.finishedDate, from);
  if (days === null) return "none";
  if (days < 0) return "red";
  if (days <= TASK_DUE_SOON_DAYS) return "yellow";
  return "none";
}

function assigneeNames(task: Task, members: TeamMember[]) {
  const list = task.assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is TeamMember => Boolean(m));
  return list;
}

function formatAssignees(assignees: TeamMember[]) {
  if (assignees.length === 0) return "Sin asignar";
  return assignees.map((m) => m.name).join(", ");
}

export function getTaskAlarms(board: TasksBoard, from = todayLocal()): TaskAlarm[] {
  return board.tasks
    .map((task) => {
      const level = getTaskAlarmLevel(task, from);
      const days = daysUntilDue(task.finishedDate, from);
      const assignees = assigneeNames(task, board.members);
      let message = "";

      if (level === "red") {
        const overdue = days === null ? 0 : Math.abs(days);
        const who = formatAssignees(assignees);
        const verb = assignees.length === 1 ? "no ha terminado" : "no han terminado";
        message = `${who} ${verb} “${task.title}” (vencida hace ${overdue} día${overdue === 1 ? "" : "s"}, fin ${task.finishedDate}).`;
      } else if (level === "yellow") {
        const who = formatAssignees(assignees);
        const verb = assignees.length === 1 ? "tiene" : "tienen";
        message = `${who} ${verb} “${task.title}” por vencer en ${days} día${days === 1 ? "" : "s"} (fin ${task.finishedDate}).`;
      } else if (level === "blue") {
        message = `“${task.title}” está en pausa (${formatAssignees(assignees)}).`;
      } else if (level === "green") {
        message = `“${task.title}” terminada (${formatAssignees(assignees)}).`;
      }

      return {
        taskId: task.id,
        title: task.title,
        finishedDate: task.finishedDate,
        status: task.status,
        level,
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
        none: 4,
      };
      return order[a.level] - order[b.level] || a.title.localeCompare(b.title);
    });
}

/** Alarmas que requieren atención (vencidas / por vencer). */
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
