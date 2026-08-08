"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Activity, TasksBoard, TeamMember } from "@/lib/tasks/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDayLabel(iso = new Date()) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(iso);
}

function formatShort(date: string) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function absoluteUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

type MemberWorkload = {
  member: TeamMember;
  activities: Activity[];
};

function getInProgressByMember(board: TasksBoard): MemberWorkload[] {
  return board.members
    .map((member) => ({
      member,
      activities: board.activities.filter(
        (activity) =>
          activity.status === "in_progress" &&
          (activity.assigneeIds || []).includes(member.id),
      ),
    }))
    .filter((row) => row.activities.length > 0)
    .sort((a, b) => a.member.name.localeCompare(b.member.name));
}

function MemberPhoto({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo?: string;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const [broken, setBroken] = useState(false);
  const src = (photo || "").trim();
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${box} shrink-0 object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center bg-[color:var(--mist)] text-sm font-semibold text-[color:var(--muted)]`}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function AdminDailyBriefing({
  board,
  loading,
}: {
  board: TasksBoard | null;
  loading?: boolean;
}) {
  const rows = useMemo(
    () => (board ? getInProgressByMember(board) : []),
    [board],
  );
  const totalActivities = rows.reduce((acc, row) => acc + row.activities.length, 0);
  const todayLabel = formatDayLabel();

  function exportPdf() {
    const peopleHtml = rows.length
      ? rows
          .map((row) => {
            const photo = absoluteUrl(row.member.photo || "");
            const photoBlock = photo
              ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(row.member.name)}" />`
              : `<div class="photo placeholder">${escapeHtml(initials(row.member.name) || "?")}</div>`;

            const activitiesHtml = row.activities
              .map(
                (activity) => `
                <li>
                  <strong>${escapeHtml(activity.title)}</strong>
                  <span class="meta">Inicio ${escapeHtml(formatShort(activity.date))} · Fin ${escapeHtml(formatShort(activity.finishedDate))}</span>
                  ${
                    activity.processUrl
                      ? `<span class="meta">Proceso: <a href="${escapeHtml(activity.processUrl)}">${escapeHtml(activity.processUrl)}</a></span>`
                      : ""
                  }
                </li>`,
              )
              .join("");

            return `
              <article class="person">
                <div class="head">
                  ${photoBlock}
                  <div>
                    <h2>${escapeHtml(row.member.name)}</h2>
                    <p class="role">${escapeHtml(row.member.role || "Integrante")}</p>
                  </div>
                </div>
                <ul>${activitiesHtml}</ul>
              </article>`;
          })
          .join("")
      : `<p class="empty">Hoy no hay actividades en proceso asignadas al equipo.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe diario — ${escapeHtml(todayLabel)}</title>
  <style>
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      padding: 36px 40px;
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.45;
    }
    .letter-head { margin-bottom: 28px; }
    .brand { font-family: Arial, Helvetica, sans-serif; color: #e00d45; font-weight: 700; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 18px; }
    .salute { font-size: 22px; margin: 0 0 8px; }
    .motto { font-size: 16px; font-style: italic; margin: 0 0 14px; color: #333; }
    .intro { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #555; margin: 0 0 8px; }
    .date { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #777; margin: 0 0 28px; }
    .person {
      border-top: 1px solid #ddd;
      padding: 18px 0;
      page-break-inside: avoid;
    }
    .head { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
    .photo { width: 64px; height: 64px; object-fit: cover; background: #f3f3f3; }
    .photo.placeholder {
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, Helvetica, sans-serif; font-weight: 700; color: #888; font-size: 16px;
    }
    h2 { font-family: Arial, Helvetica, sans-serif; font-size: 16px; margin: 0; }
    .role { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #666; margin: 2px 0 0; }
    ul { margin: 0; padding-left: 18px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
    li { margin: 0 0 8px; }
    li strong { display: block; }
    .meta { display: block; color: #666; font-size: 11px; margin-top: 2px; }
    a { color: #e00d45; word-break: break-all; }
    .empty { font-family: Arial, Helvetica, sans-serif; color: #666; }
    .footer { margin-top: 28px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      @page { margin: 14mm; size: portrait; }
    }
  </style>
</head>
<body>
  <div class="letter-head">
    <p class="brand">Inspiralab</p>
    <p class="salute">Don Saul,</p>
    <p class="motto">La excelencia está en el orden ✨</p>
    <p class="intro">Este es un informe diario de las actividades en que el equipo está trabajando.</p>
    <p class="date">${escapeHtml(todayLabel)} · Solo actividades en proceso</p>
  </div>
  ${peopleHtml}
  <p class="footer">Inspiralab · Informe diario del equipo · ${rows.length} integrante${rows.length === 1 ? "" : "s"} · ${totalActivities} actividad${totalActivities === 1 ? "" : "es"} en proceso</p>
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
        // imprimir manualmente
      }
    }, 500);
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  if (loading) {
    return (
      <section className="mt-10 border border-[color:var(--line)] bg-white p-5">
        <p className="text-sm text-[color:var(--muted)]">Cargando actividad diaria...</p>
      </section>
    );
  }

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--ink)]">
            Actividad diaria
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Qué está trabajando cada integrante ahora (solo en proceso). {todayLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tareas"
            className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
          >
            Ver tareas
          </Link>
          <button
            type="button"
            onClick={exportPdf}
            className="bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border border-[color:var(--line)] bg-white px-4 py-8 text-center text-sm text-[color:var(--muted)]">
          Nadie tiene actividades en proceso en este momento.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ member, activities }) => (
            <article
              key={member.id}
              className="border border-[color:var(--line)] bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <MemberPhoto name={member.name} photo={member.photo} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--ink)]">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-[color:var(--muted)]">
                    {member.role || "Integrante"} · {activities.length} en proceso
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 border-t border-[color:var(--line)] pt-3">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {activity.title}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {formatShort(activity.date)} → {formatShort(activity.finishedDate)}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
