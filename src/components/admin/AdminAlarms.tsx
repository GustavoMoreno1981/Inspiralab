"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BUDGET_WARNING_PERCENT,
  TASK_ALARM_COLORS,
  getBudgetAlarms,
  getTaskAlarms,
  getTaskNotifications,
  type BudgetAlarm,
  type TaskAlarm,
  type TaskAlarmLevel,
} from "@/lib/alarms";
import type { AccountingBoard } from "@/lib/accounting/types";
import { TASK_STATUSES, type TasksBoard } from "@/lib/tasks/types";
import { formatCop, formatUsdFromCop } from "@/lib/accounting/types";

function SemaphoreDot({
  level,
  color,
  size = "md",
}: {
  level?: TaskAlarmLevel;
  color?: string;
  size?: "sm" | "md";
}) {
  const bg = color || (level ? TASK_ALARM_COLORS[level].bg : "#94a3b8");
  const label = level ? TASK_ALARM_COLORS[level].label : undefined;
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${
        size === "sm" ? "h-3 w-3" : "h-4 w-4"
      }`}
      style={{ backgroundColor: bg }}
      title={label}
      aria-label={label || "Estado"}
    />
  );
}

function statusLabel(status: TaskAlarm["status"]) {
  return TASK_STATUSES.find((item) => item.value === status)?.label || status;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reasonLabel(reason: TaskAlarm["reason"]) {
  switch (reason) {
    case "pending_review":
      return "Pendiente por revisión";
    case "due_soon":
      return "Por vencer";
    case "overdue":
      return "Vencida";
    case "paused":
      return "En pausa";
    case "done":
      return "Terminada";
    default:
      return "En plazo";
  }
}

function printAlarmActivities(title: string, alarms: TaskAlarm[]) {
  const printedAt = new Date().toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const rows = alarms.length
    ? alarms
        .map(
          (alarm) => `
      <tr>
        <td>${escapeHtml(alarm.title)}</td>
        <td>${escapeHtml(statusLabel(alarm.status))}</td>
        <td>${escapeHtml(reasonLabel(alarm.reason))}</td>
        <td>${escapeHtml(alarm.finishedDate || "—")}</td>
        <td>${escapeHtml(
          alarm.assignees.map((m) => m.name).join(", ") || "Sin asignar",
        )}</td>
        <td>${escapeHtml(alarm.message)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#666;">No hay actividades en este estado.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Alarmas — ${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { margin: 0 0 18px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; }
    .footer { margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <h1>Inspiralab · ${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(printedAt)} · ${alarms.length} actividad${alarms.length === 1 ? "" : "es"}</p>
  <table>
    <thead>
      <tr>
        <th>Actividad</th>
        <th>Estado</th>
        <th>Alarma</th>
        <th>Fecha fin</th>
        <th>Asignados</th>
        <th>Detalle</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Inspiralab · Listado de alarmas · ${escapeHtml(title)}</p>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    alert("Permite ventanas emergentes para imprimir");
    return;
  }
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // imprimir manualmente
    }
  }, 400);
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
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
  type AlarmFilter = TaskAlarmLevel | "pending_review";
  const [filter, setFilter] = useState<AlarmFilter | null>(null);

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
    const base = { red: 0, yellow: 0, blue: 0, green: 0, gray: 0 };
    for (const alarm of taskAlarms) {
      base[alarm.level] += 1;
    }
    return base;
  }, [taskAlarms]);

  const pendingReviewCount = useMemo(
    () => taskAlarms.filter((item) => item.reason === "pending_review").length,
    [taskAlarms],
  );

  const filteredAlarms = useMemo(() => {
    if (!filter) return [];
    if (filter === "pending_review") {
      return taskAlarms.filter((item) => item.reason === "pending_review");
    }
    return taskAlarms.filter((item) => item.level === filter);
  }, [filter, taskAlarms]);

  const filterTitle =
    filter === "pending_review"
      ? "Pendiente por revisión"
      : filter
        ? TASK_ALARM_COLORS[filter].label
        : "";

  const filterLevelDot: TaskAlarmLevel | null =
    filter === "pending_review" ? "yellow" : filter;

  const attentionCount = taskNotifications.length + budgetAlarms.length;

  useEffect(() => {
    if (!filter) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilter(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filter]);

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
            Tareas vencidas, por vencer, pendientes por revisión y tope del presupuesto.
            {attentionCount > 0
              ? ` ${attentionCount} pendiente${attentionCount === 1 ? "" : "s"} de atención.`
              : " Todo en orden por ahora."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {(
            [
              ["red", counts.red],
              ["yellow", counts.yellow],
              ["blue", counts.blue],
              ["green", counts.green],
              ["gray", counts.gray],
            ] as const
          ).map(([level, count]) => (
            <button
              key={level}
              type="button"
              onClick={() => setFilter(level)}
              className="inline-flex items-center gap-1.5 border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-[color:var(--muted)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
              title={`Ver tareas: ${TASK_ALARM_COLORS[level].label}`}
            >
              <SemaphoreDot level={level} size="sm" />
              {TASK_ALARM_COLORS[level].label}: {count}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter("pending_review")}
            className="inline-flex items-center gap-1.5 border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-[color:var(--muted)] transition hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]"
            title="Ver tareas pendientes por revisión"
          >
            <SemaphoreDot level="yellow" size="sm" />
            Pendiente por revisión: {pendingReviewCount}
          </button>
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
              Nadie tiene tareas vencidas, por vencer ni pendientes por revisión.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {taskNotifications.map((alarm) => (
                <TaskAlarmRow key={alarm.activityId} alarm={alarm} />
              ))}
            </ul>
          )}

          {pendingReviewCount > 0 && (
            <div className="border-t border-[color:var(--line)] px-4 py-3">
              <button
                type="button"
                onClick={() => setFilter("pending_review")}
                className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent)] hover:underline"
              >
                Pendiente por revisión: {pendingReviewCount} · ver listado
              </button>
            </div>
          )}

          {counts.blue > 0 && (
            <div className="border-t border-[color:var(--line)] px-4 py-3">
              <button
                type="button"
                onClick={() => setFilter("blue")}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)] hover:text-[color:var(--ink)]"
              >
                En pausa · ver todas
              </button>
              <ul className="space-y-2">
                {taskAlarms
                  .filter((a) => a.level === "blue")
                  .map((alarm) => (
                    <li key={alarm.activityId} className="flex items-start gap-2 text-sm">
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

      {filter && filterLevelDot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alarms-modal-title"
          onClick={() => setFilter(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden border border-[color:var(--line)] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <SemaphoreDot level={filterLevelDot} />
                <div>
                  <h3
                    id="alarms-modal-title"
                    className="font-semibold text-[color:var(--ink)]"
                  >
                    {filterTitle}
                  </h3>
                  <p className="text-xs text-[color:var(--muted)]">
                    {filteredAlarms.length} tarea
                    {filteredAlarms.length === 1 ? "" : "s"} en este estado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto">
              {filteredAlarms.length === 0 ? (
                <p className="px-4 py-8 text-sm text-[color:var(--muted)]">
                  No hay tareas en este estado.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {filteredAlarms.map((alarm) => (
                    <TaskAlarmRow key={alarm.activityId} alarm={alarm} showStatus />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-4 py-3">
              <Link
                href="/admin/tareas"
                className="text-sm font-semibold text-[color:var(--accent)]"
                onClick={() => setFilter(null)}
              >
                Ir al tablero de tareas
              </Link>
              <button
                type="button"
                onClick={() => printAlarmActivities(filterTitle, filteredAlarms)}
                disabled={filteredAlarms.length === 0}
                className="border border-[color:var(--line)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] disabled:opacity-40"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TaskAlarmRow({
  alarm,
  showStatus = false,
}: {
  alarm: TaskAlarm;
  showStatus?: boolean;
}) {
  const tone =
    alarm.level === "red"
      ? "border-l-[#dc2626]"
      : alarm.level === "yellow"
        ? "border-l-[#ca8a04]"
        : "border-l-transparent";

  const badge =
    alarm.reason === "pending_review"
      ? "Revisión"
      : alarm.reason === "due_soon"
        ? "Por vencer"
        : alarm.reason === "overdue"
          ? "Vencida"
          : null;

  return (
    <li className={`border-l-4 px-4 py-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1">
          <SemaphoreDot level={alarm.level} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[color:var(--ink)]">{alarm.title}</p>
            {badge && (
              <span className="border border-[color:var(--line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[color:var(--muted)]">{alarm.message}</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {showStatus ? `${statusLabel(alarm.status)} · ` : null}
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
export function TaskSemaphore({
  level,
  color,
}: {
  level?: TaskAlarmLevel;
  color?: string;
}) {
  return <SemaphoreDot level={level} color={color} />;
}
