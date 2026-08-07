"use client";

import { useMemo, useState } from "react";
import {
  TASK_STATUSES,
  getTaskProgress,
  type Task,
  type TeamMember,
} from "@/lib/tasks/types";
import { TasksGantt } from "@/components/admin/TasksGantt";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShort(value: string) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function parseDay(value: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function statusLabel(status: string) {
  return TASK_STATUSES.find((item) => item.value === status)?.label || status;
}

function isActiveOnDay(task: Task, dayIso: string) {
  const day = parseDay(dayIso);
  const start = parseDay(task.date);
  if (day == null || start == null) return false;
  if (day < start) return false;

  const end = parseDay(task.finishedDate);
  if (end != null) return day <= end;
  if (task.status === "done") return day === start;
  return true;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function linkHtml(url: string) {
  if (!url) return "—";
  const safe = escapeHtml(url);
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
}

const DAY_MS = 86400000;

function buildGanttHtml(members: TeamMember[], tasks: Task[]) {
  const scoped = members
    .map((member) => ({
      member,
      tasks: tasks.filter((task) => (task.assigneeIds || []).includes(member.id)),
    }))
    .filter((row) => row.tasks.length > 0);

  if (!scoped.length) {
    return `<p style="color:#666;font-size:12px;">No hay tareas para mostrar en el Gantt.</p>`;
  }

  const starts = tasks.map((t) => parseDay(t.date)).filter((v): v is number => v != null);
  const ends = tasks
    .map((t) => parseDay(t.finishedDate) ?? parseDay(t.date))
    .filter((v): v is number => v != null);

  if (!starts.length) {
    return `<p style="color:#666;font-size:12px;">Faltan fechas para armar el Gantt.</p>`;
  }

  let min = Math.min(...starts) - DAY_MS;
  let max = Math.max(...ends, ...starts) + DAY_MS;
  if (max <= min) max = min + 7 * DAY_MS;
  const span = Math.max(max - min, DAY_MS);

  const tickCount = Math.min(7, Math.max(4, Math.round(span / DAY_MS) + 1));
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    ticks.push(min + (span * i) / (tickCount - 1));
  }

  const tickLabels = ticks
    .map((tick) => {
      const left = ((tick - min) / span) * 100;
      const label = new Date(tick).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      });
      return `<span style="position:absolute;left:${left}%;transform:translateX(-50%);font-size:9px;color:#666;">${escapeHtml(label)}</span>`;
    })
    .join("");

  const rowsHtml = scoped
    .map(({ member, tasks: memberTasks }) => {
      const bars = memberTasks
        .map((task) => {
          const start = parseDay(task.date);
          const endRaw = parseDay(task.finishedDate) ?? start;
          if (start == null || endRaw == null) return "";
          const end = Math.max(endRaw, start);
          const left = ((start - min) / span) * 100;
          const width = Math.max(((end - start + DAY_MS) / span) * 100, 3);
          const progress = getTaskProgress(task);
          return `<div style="position:relative;height:28px;margin:3px 0;">
            <div style="position:absolute;left:${left}%;width:${width}%;top:0;height:28px;background:#fff1f4;border:1px solid #e00d45;overflow:hidden;">
              <div style="position:absolute;inset:0 auto 0 0;width:${progress}%;background:rgba(224,13,69,.25);"></div>
              <div style="position:relative;z-index:1;padding:3px 5px;font-size:9px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(task.title)} · ${progress}%
              </div>
            </div>
          </div>`;
        })
        .join("");

      return `<tr>
        <td style="width:150px;vertical-align:top;padding:8px;border:1px solid #ddd;font-size:11px;font-weight:700;">
          ${escapeHtml(member.name)}
        </td>
        <td style="padding:8px;border:1px solid #ddd;position:relative;">
          <div style="position:relative;min-height:28px;">${bars}</div>
        </td>
      </tr>`;
    })
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr>
          <th style="width:150px;text-align:left;padding:8px;border:1px solid #ddd;background:#f5f5f5;font-size:10px;text-transform:uppercase;">Integrante</th>
          <th style="text-align:left;padding:8px;border:1px solid #ddd;background:#f5f5f5;">
            <div style="position:relative;height:16px;">${tickLabels}</div>
          </th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

type Props = {
  members: TeamMember[];
  tasks: Task[];
};

type Scope = "all" | string;

type ReportLine = {
  memberName: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  processUrl: string;
  deliverableUrl: string;
};

export function TasksReports({ members, tasks }: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [reportDay, setReportDay] = useState(todayIso);
  const [recipient, setRecipient] = useState("Saul");

  const reportMembers = useMemo(() => {
    if (scope === "all") return members;
    return members.filter((m) => m.id === scope);
  }, [scope, members]);

  const scopedTasks = useMemo(() => {
    if (scope === "all") return tasks;
    return tasks.filter((task) => (task.assigneeIds || []).includes(scope));
  }, [scope, tasks]);

  const lines = useMemo(() => {
    const out: ReportLine[] = [];

    for (const member of reportMembers) {
      const memberTasks = tasks.filter(
        (task) =>
          (task.assigneeIds || []).includes(member.id) &&
          isActiveOnDay(task, reportDay),
      );

      for (const task of memberTasks) {
        out.push({
          memberName: member.name,
          title: task.title,
          startDate: task.date,
          endDate: task.finishedDate,
          status: statusLabel(task.status),
          processUrl: task.processUrl || "",
          deliverableUrl: task.deliverableUrl || "",
        });
      }
    }

    return out;
  }, [reportMembers, tasks, reportDay]);

  function downloadPdf() {
    const greeting = `Hola ${recipient.trim() || "Saul"}, en este día ${formatDate(reportDay)}.`;

    const tableRows = lines.length
      ? lines
          .map(
            (line) => `<tr>
          <td>${escapeHtml(line.memberName)}</td>
          <td>${escapeHtml(line.title)}</td>
          <td>${escapeHtml(formatShort(line.startDate))}</td>
          <td>${escapeHtml(line.endDate ? formatShort(line.endDate) : "—")}</td>
          <td>${escapeHtml(line.status)}</td>
          <td>${linkHtml(line.processUrl)}</td>
          <td>${linkHtml(line.deliverableUrl)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center;color:#666;">Hoy no hay integrantes trabajando en tareas para esta fecha.</td></tr>`;

    const ganttHtml = buildGanttHtml(reportMembers, scopedTasks);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe del día — ${escapeHtml(formatDate(reportDay))}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    p { margin: 0 0 12px; color: #555; font-size: 12px; }
    table.data { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    table.data th, table.data td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; }
    table.data th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; }
    a { color: #e00d45; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(greeting)}</h1>
  <p>Resumen organizado de lo que está trabajando el equipo / integrante seleccionado.</p>

  <h2>Detalle de tareas</h2>
  <table class="data">
    <thead>
      <tr>
        <th>Integrante</th>
        <th>Tarea</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th>Estado</th>
        <th>URL proceso</th>
        <th>URL entregable</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>Gantt — cómo van las tareas</h2>
  ${ganttHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");

    if (!win) {
      URL.revokeObjectURL(url);
      alert("Permite ventanas emergentes para descargar el PDF");
      return;
    }

    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // El usuario puede imprimir manualmente
      }
    }, 400);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  if (!members.length) {
    return (
      <div className="border border-[color:var(--line)] bg-white p-8 text-center text-sm text-[color:var(--muted)]">
        Agrega integrantes para ver reportes.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-xs font-semibold uppercase text-[color:var(--muted)]">
            Dirigido a
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 block border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm font-normal normal-case text-[color:var(--ink)]"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase text-[color:var(--muted)]">
            Día del informe
            <input
              type="date"
              value={reportDay}
              onChange={(e) => setReportDay(e.target.value)}
              className="mt-1 block border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm font-normal normal-case text-[color:var(--ink)]"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Descargar PDF
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`shrink-0 border px-4 py-3 text-left ${
            scope === "all"
              ? "border-[color:var(--accent)] bg-[#fff1f4]"
              : "border-[color:var(--line)] bg-white"
          }`}
        >
          <p className="font-[family-name:var(--font-display)] text-sm font-bold">
            Todo el equipo
          </p>
        </button>
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setScope(member.id)}
            className={`flex shrink-0 items-center gap-3 border px-4 py-3 text-left ${
              scope === member.id
                ? "border-[color:var(--accent)] bg-[#fff1f4]"
                : "border-[color:var(--line)] bg-white"
            }`}
          >
            {member.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photo} alt="" className="h-10 w-10 object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center bg-[color:var(--mist)] text-sm font-semibold">
                {member.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <p className="font-[family-name:var(--font-display)] text-sm font-bold">
              {member.name}
            </p>
          </button>
        ))}
      </div>

      <article className="space-y-5 border border-[color:var(--line)] bg-white p-5 md:p-7">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-snug">
          Hola {recipient.trim() || "Saul"}, en este día {formatDate(reportDay)}.
        </h1>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--mist)]/70 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              <tr>
                <th className="px-3 py-3">Integrante</th>
                <th className="px-3 py-3">Tarea</th>
                <th className="px-3 py-3">Inicio</th>
                <th className="px-3 py-3">Fin</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">URL proceso</th>
                <th className="px-3 py-3">URL entregable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[color:var(--muted)]">
                    Hoy no hay integrantes trabajando en tareas para esta fecha.
                  </td>
                </tr>
              ) : (
                lines.map((line, index) => (
                  <tr key={`${line.memberName}-${line.title}-${index}`} className="align-top">
                    <td className="px-3 py-3 font-semibold">{line.memberName}</td>
                    <td className="px-3 py-3">{line.title}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatShort(line.startDate)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {line.endDate ? formatShort(line.endDate) : "—"}
                    </td>
                    <td className="px-3 py-3">{line.status}</td>
                    <td className="px-3 py-3 text-xs">
                      {line.processUrl ? (
                        <a
                          href={line.processUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-semibold text-[color:var(--accent)]"
                        >
                          {line.processUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {line.deliverableUrl ? (
                        <a
                          href={line.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-semibold text-[color:var(--accent)]"
                        >
                          {line.deliverableUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-bold">
            Gantt — cómo van las tareas
          </h2>
          <TasksGantt members={reportMembers} tasks={scopedTasks} />
        </div>
      </article>
    </div>
  );
}
