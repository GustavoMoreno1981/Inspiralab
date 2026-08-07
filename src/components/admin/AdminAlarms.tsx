"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BUDGET_WARNING_PERCENT,
  TASK_ALARM_COLORS,
  getBudgetAlarms,
  getTaskAlarms,
  getTaskNotifications,
  type BudgetAlarm,
  type TaskAlarm,
} from "@/lib/alarms";
import type { AccountingBoard } from "@/lib/accounting/types";
import type { TasksBoard } from "@/lib/tasks/types";
import { formatCop, formatUsdFromCop } from "@/lib/accounting/types";

function SemaphoreDot({
  level,
  size = "md",
}: {
  level: keyof typeof TASK_ALARM_COLORS | "none";
  size?: "sm" | "md";
}) {
  if (level === "none") {
    return (
      <span
        className={`inline-block rounded-full border border-[color:var(--line)] bg-transparent ${
          size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
        }`}
        title="En plazo"
      />
    );
  }
  const color = TASK_ALARM_COLORS[level];
  return (
    <span
      className={`inline-block rounded-full ${size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`}
      style={{ backgroundColor: color.bg }}
      title={color.label}
    />
  );
}

export function AdminAlarms({
  tasksBoard,
  accounting,
  loading = false,
  showBudget = true,
}: {
  tasksBoard: TasksBoard | null;
  accounting: AccountingBoard;
  loading?: boolean;
  showBudget?: boolean;
}) {
  const taskAlarms = useMemo(
    () => (tasksBoard ? getTaskAlarms(tasksBoard) : []),
    [tasksBoard],
  );
  const taskNotifications = useMemo(
    () => (tasksBoard ? getTaskNotifications(tasksBoard) : []),
    [tasksBoard],
  );
  const budgetAlarms = useMemo(
    () => (showBudget ? getBudgetAlarms(accounting) : []),
    [accounting, showBudget],
  );

  const counts = useMemo(() => {
    const base = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const alarm of taskAlarms) {
      if (alarm.level === "red" || alarm.level === "yellow" || alarm.level === "blue" || alarm.level === "green") {
        base[alarm.level] += 1;
      }
    }
    return base;
  }, [taskAlarms]);

  const attentionCount = taskNotifications.length + budgetAlarms.length;

  if (loading) {
    return (
      <section className="mt-10 border border-[color:var(--line)] bg-white p-5">
        <p className="text-sm text-[color:var(--muted)]">Cargando alarmas...</p>
      </section>
    );
  }

  return (
    <section className="mt-10 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--ink)]">
            Alarmas
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Tareas por vencer o vencidas, y tope del presupuesto anual.
            {attentionCount > 0
              ? ` ${attentionCount} pendiente${attentionCount === 1 ? "" : "s"} de atención.`
              : " Todo en orden por ahora."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          {(
            [
              ["red", counts.red],
              ["yellow", counts.yellow],
              ["blue", counts.blue],
              ["green", counts.green],
            ] as const
          ).map(([level, count]) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-[color:var(--muted)]">
              <SemaphoreDot level={level} />
              {TASK_ALARM_COLORS[level].label}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className={`grid gap-5 ${showBudget ? "lg:grid-cols-2" : ""}`}>
        <div className="border border-[color:var(--line)] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)] px-4 py-3">
            <h3 className="font-semibold">Tareas</h3>
            <Link href="/admin/tareas" className="text-xs font-semibold text-[color:var(--accent)]">
              Ir a tareas
            </Link>
          </div>

          {taskNotifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
              Nadie tiene tareas vencidas ni por vencer en los próximos 3 días.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {taskNotifications.map((alarm) => (
                <TaskAlarmRow key={alarm.taskId} alarm={alarm} />
              ))}
            </ul>
          )}

          {counts.blue > 0 && (
            <div className="border-t border-[color:var(--line)] px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                En pausa
              </p>
              <ul className="space-y-2">
                {taskAlarms
                  .filter((a) => a.level === "blue")
                  .map((alarm) => (
                    <li key={alarm.taskId} className="flex items-start gap-2 text-sm">
                      <SemaphoreDot level="blue" size="sm" />
                      <span>
                        <span className="font-semibold">{alarm.title}</span>
                        {" — "}
                        {alarm.assignees.map((m) => m.name).join(", ") || "Sin asignar"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {showBudget && (
        <div className="border border-[color:var(--line)] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)] px-4 py-3">
            <h3 className="font-semibold">Presupuesto</h3>
            <Link
              href="/admin/contabilidad"
              className="text-xs font-semibold text-[color:var(--accent)]"
            >
              Ir a contabilidad
            </Link>
          </div>

          {budgetAlarms.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
              Ningún presupuesto anual está cerca del tope (≥{BUDGET_WARNING_PERCENT}%) ni
              excedido.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {budgetAlarms.map((alarm) => (
                <BudgetAlarmRow key={alarm.year} alarm={alarm} />
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
    </section>
  );
}

function TaskAlarmRow({ alarm }: { alarm: TaskAlarm }) {
  const tone =
    alarm.level === "red"
      ? "border-l-[#dc2626]"
      : alarm.level === "yellow"
        ? "border-l-[#ca8a04]"
        : "border-l-transparent";

  return (
    <li className={`border-l-4 px-4 py-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1">
          <SemaphoreDot level={alarm.level === "none" ? "none" : alarm.level} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[color:var(--ink)]">{alarm.title}</p>
          <p className="mt-0.5 text-sm text-[color:var(--muted)]">{alarm.message}</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Fin: {alarm.finishedDate || "—"} ·{" "}
            {alarm.assignees.map((m) => m.name).join(", ") || "Sin asignar"}
          </p>
        </div>
      </div>
    </li>
  );
}

function BudgetAlarmRow({ alarm }: { alarm: BudgetAlarm }) {
  const isCritical = alarm.level === "critical";
  return (
    <li
      className={`border-l-4 px-4 py-3 ${
        isCritical ? "border-l-[#dc2626]" : "border-l-[#ca8a04]"
      }`}
    >
      <p className="font-semibold text-[color:var(--ink)]">
        {isCritical ? "Presupuesto excedido" : "Cerca del tope"} · {alarm.year}
      </p>
      <p className="mt-1 text-sm text-[color:var(--muted)]">{alarm.message}</p>
      <p className="mt-2 text-xs text-[color:var(--muted)]">
        Ejecutado {formatUsdFromCop(alarm.spentCop, alarm.rate)} /{" "}
        {formatUsdFromCop(alarm.totalCop, alarm.rate)} · {formatCop(alarm.spentCop)} /{" "}
        {formatCop(alarm.totalCop)}
      </p>
    </li>
  );
}

/** Punto de semáforo reutilizable en listados de tareas. */
export function TaskSemaphore({ level }: { level: keyof typeof TASK_ALARM_COLORS | "none" }) {
  return <SemaphoreDot level={level} />;
}
