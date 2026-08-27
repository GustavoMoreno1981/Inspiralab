"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TASK_STATUS_COLORS,
  getActivityCompletionDate,
  getActivityProgress,
  type Activity,
  type TeamMember,
} from "@/lib/tasks/types";

const MONTHS = [
  { value: 0, label: "Todos los meses" },
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

function formatDate(value: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function memberNames(activity: Activity, members: TeamMember[]) {
  return (activity.assigneeIds || [])
    .map((id) => members.find((member) => member.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

type Props = {
  members: TeamMember[];
  activities: Activity[];
  selectedMemberId?: string | "all";
};

export function TasksHistory({
  members,
  activities,
  selectedMemberId: initialMemberId = "all",
}: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number | "all">("all");
  const [month, setMonth] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberId, setMemberId] = useState<string | "all">(initialMemberId);

  useEffect(() => {
    setMemberId(initialMemberId);
  }, [initialMemberId]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const activity of activities) {
      const iso = getActivityCompletionDate(activity);
      if (/^\d{4}/.test(iso)) set.add(Number(iso.slice(0, 4)));
    }
    set.add(currentYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [activities, currentYear]);

  const filtered = useMemo(() => {
    return activities
      .filter((activity) => {
        if (
          memberId !== "all" &&
          !(activity.assigneeIds || []).includes(memberId)
        ) {
          return false;
        }

        const iso = getActivityCompletionDate(activity);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return true;

        const y = Number(iso.slice(0, 4));
        const m = Number(iso.slice(5, 7));

        if (year !== "all" && y !== year) return false;
        if (month > 0 && m !== month) return false;
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        const da = getActivityCompletionDate(a);
        const db = getActivityCompletionDate(b);
        return db.localeCompare(da);
      });
  }, [activities, memberId, year, month, dateFrom, dateTo]);

  function exportPdf() {
    const rows = filtered
      .map((activity) => {
        const names = memberNames(activity, members) || "—";
        const progress = getActivityProgress(activity);
        const status =
          TASK_STATUS_COLORS[activity.status]?.label || activity.status;
        const tasksHtml = activity.tasks.length
          ? `<ul>${activity.tasks
              .map(
                (task) =>
                  `<li>${escapeHtml(task.title || "Sin título")} (${
                    task.status === "done" ? "Terminada" : task.status
                  })${
                    task.subtasks.length
                      ? ` — ${task.subtasks.filter((s) => s.status === "done").length}/${task.subtasks.length} subtareas`
                      : ""
                  }</li>`,
              )
              .join("")}</ul>`
          : "—";

        return `<tr>
          <td>${escapeHtml(activity.title)}</td>
          <td>${escapeHtml(names)}</td>
          <td>${escapeHtml(formatDate(activity.date))}</td>
          <td>${escapeHtml(formatDate(getActivityCompletionDate(activity)))}</td>
          <td>${escapeHtml(status)}</td>
          <td>${progress}%</td>
          <td>${tasksHtml}</td>
        </tr>`;
      })
      .join("");

    const filterParts = [
      year === "all" ? "Todos los años" : `Año ${year}`,
      month === 0
        ? "Todos los meses"
        : MONTHS.find((item) => item.value === month)?.label || "",
      dateFrom ? `Desde ${formatDate(dateFrom)}` : null,
      dateTo ? `Hasta ${formatDate(dateTo)}` : null,
      memberId === "all"
        ? "Todo el equipo"
        : members.find((m) => m.id === memberId)?.name || "Integrante",
    ].filter(Boolean);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Historial de actividades terminadas</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; }
    ul { margin: 0; padding-left: 16px; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <h1>Historial de actividades terminadas</h1>
  <p>Filtro: ${escapeHtml(filterParts.join(" · "))} · ${filtered.length} ${
    filtered.length === 1 ? "actividad" : "actividades"
  }</p>
  <table>
    <thead>
      <tr>
        <th>Actividad</th>
        <th>Asignados</th>
        <th>Inicio</th>
        <th>Fecha cierre</th>
        <th>Estado</th>
        <th>Avance</th>
        <th>Tareas</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows ||
        `<tr><td colspan="7">No hay actividades terminadas con este filtro.</td></tr>`
      }
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      alert("Permite ventanas emergentes para exportar el PDF");
      return;
    }
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // impresión manual
      }
    }, 400);
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  return (
    <div className="space-y-5">
      <div className="border border-[color:var(--line)] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
              Historial de actividades terminadas
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Actividades al 100% de avance. Filtra por integrante, año, mes o
              rango de fechas y exporta a PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={exportPdf}
            disabled={filtered.length === 0}
            className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Exportar PDF
          </button>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMemberId("all")}
            className={`shrink-0 border px-4 py-2.5 text-xs font-semibold ${
              memberId === "all"
                ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                : "border-[color:var(--line)] bg-white"
            }`}
          >
            Todo el equipo
          </button>
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setMemberId(member.id)}
              className={`shrink-0 border px-4 py-2.5 text-xs font-semibold ${
                memberId === member.id
                  ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                  : "border-[color:var(--line)] bg-white"
              }`}
            >
              {member.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              Año
            </span>
            <select
              value={year === "all" ? "all" : String(year)}
              onChange={(e) =>
                setYear(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            >
              <option value="all">Todos los años</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              Mes
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            >
              {MONTHS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              Desde
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
              Hasta
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            />
          </label>
        </div>

        {(dateFrom ||
          dateTo ||
          year !== "all" ||
          month > 0 ||
          memberId !== "all") && (
          <button
            type="button"
            onClick={() => {
              setYear("all");
              setMonth(0);
              setDateFrom("");
              setDateTo("");
              setMemberId("all");
            }}
            className="mt-3 text-xs font-semibold text-[color:var(--accent)]"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="text-sm text-[color:var(--muted)]">
        {filtered.length}{" "}
        {filtered.length === 1 ? "actividad terminada" : "actividades terminadas"}
        {activities.length !== filtered.length
          ? ` · ${activities.length} en total en historial`
          : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-[color:var(--line)] bg-white p-8 text-center text-sm text-[color:var(--muted)]">
          {activities.length === 0
            ? "Aún no hay actividades terminadas al 100%."
            : "No hay resultados con estos filtros."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((activity) => {
            const progress = getActivityProgress(activity);
            const names = memberNames(activity, members);
            const statusColor =
              TASK_STATUS_COLORS[activity.status] || TASK_STATUS_COLORS.done;
            return (
              <article
                key={activity.id}
                className="border border-[color:var(--line)] bg-white p-4 md:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--ink)]">
                      {activity.title}
                    </h3>
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                      }}
                    >
                      {statusColor.label}
                    </span>
                    <span className="text-xs font-semibold text-[#177245]">
                      {progress}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {formatDate(activity.date)} →{" "}
                    {formatDate(getActivityCompletionDate(activity))}
                    {names ? ` · ${names}` : ""}
                  </p>
                  {activity.tasks.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-xs text-[color:var(--muted)]">
                      {activity.tasks.map((task) => (
                        <li key={task.id}>
                          <span className="font-semibold text-[color:var(--ink)]">
                            {task.title || "Tarea"}
                          </span>
                          {task.subtasks.length
                            ? ` · ${task.subtasks.filter((s) => s.status === "done").length}/${task.subtasks.length} subtareas`
                            : " · Terminada"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
