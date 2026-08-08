"use client";

import {
  getActivityProgress,
  TASK_STATUSES,
  type Activity,
  type TeamMember,
} from "@/lib/tasks/types";

function parseDay(value: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDayLabel(ms: number) {
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function addDays(ms: number, days: number) {
  return ms + days * 86400000;
}

const DAY = 86400000;

type Props = {
  members: TeamMember[];
  activities: Activity[];
};

export function TasksGantt({ members, activities }: Props) {
  const timeline = (() => {
    const starts = activities.map((t) => parseDay(t.date)).filter((v): v is number => v != null);
    const ends = activities
      .map((t) => parseDay(t.finishedDate) ?? parseDay(t.date))
      .filter((v): v is number => v != null);

    if (!starts.length) return null;

    let min = Math.min(...starts);
    let max = Math.max(...ends, ...starts);
    if (max <= min) max = addDays(min, 7);
    // padding
    min = addDays(min, -1);
    max = addDays(max, 1);
    const span = Math.max(max - min, DAY);

    const ticks: number[] = [];
    const tickCount = Math.min(8, Math.max(4, Math.round(span / DAY) + 1));
    for (let i = 0; i < tickCount; i++) {
      ticks.push(min + (span * i) / (tickCount - 1));
    }

    return { min, max, span, ticks };
  })();

  if (!members.length) {
    return (
      <div className="border border-[color:var(--line)] bg-white p-8 text-center text-sm text-[color:var(--muted)]">
        Agrega integrantes para ver el Gantt.
      </div>
    );
  }

  if (!activities.length || !timeline) {
    return (
      <div className="border border-[color:var(--line)] bg-white p-8 text-center text-sm text-[color:var(--muted)]">
        Crea actividades con fecha de inicio y fecha de fin para ver el cronograma.
      </div>
    );
  }

  const rows = members
    .map((member) => ({
      member,
      activities: activities.filter((activity) =>
        (activity.assigneeIds || []).includes(member.id),
      ),
    }))
    .filter((row) => row.activities.length > 0);

  if (!rows.length) {
    return (
      <div className="border border-[color:var(--line)] bg-white p-8 text-center text-sm text-[color:var(--muted)]">
        No hay actividades asignadas en esta vista.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[200px_1fr] border-b border-[color:var(--line)] bg-[color:var(--mist)]/60">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Integrante
          </div>
          <div className="relative px-2 py-3">
            <div className="relative h-5">
              {timeline.ticks.map((tick, i) => {
                const left = ((tick - timeline.min) / timeline.span) * 100;
                return (
                  <span
                    key={i}
                    className="absolute -translate-x-1/2 text-[10px] font-semibold text-[color:var(--muted)]"
                    style={{ left: `${left}%` }}
                  >
                    {formatDayLabel(tick)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {rows.map(({ member, activities: memberActivities }) => (
          <div
            key={member.id}
            className="grid grid-cols-[200px_1fr] border-b border-[color:var(--line)] last:border-b-0"
          >
            <div className="flex items-start gap-3 border-r border-[color:var(--line)] px-4 py-4">
              {member.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photo}
                  alt={member.name}
                  className="h-10 w-10 shrink-0 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[color:var(--mist)] text-sm font-semibold">
                  {member.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{member.name}</p>
                <p className="text-xs text-[color:var(--muted)]">
                  {memberActivities.length}{" "}
                  {memberActivities.length === 1 ? "actividad" : "actividades"}
                </p>
              </div>
            </div>

            <div className="relative space-y-2 px-2 py-3">
              <div
                className="pointer-events-none absolute inset-y-0 left-2 right-2 opacity-40"
                aria-hidden
              >
                {timeline.ticks.map((tick, i) => {
                  const left = ((tick - timeline.min) / timeline.span) * 100;
                  return (
                    <span
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-[color:var(--line)]"
                      style={{ left: `${left}%` }}
                    />
                  );
                })}
              </div>

              {memberActivities.map((activity) => {
                const start = parseDay(activity.date);
                const endRaw = parseDay(activity.finishedDate) ?? start;
                if (start == null || endRaw == null) return null;
                const end = Math.max(endRaw, start);
                const left = ((start - timeline.min) / timeline.span) * 100;
                const width = Math.max(((end - start + DAY) / timeline.span) * 100, 2.5);
                const progress = getActivityProgress(activity);
                const statusLabel =
                  TASK_STATUSES.find((s) => s.value === activity.status)?.label ||
                  activity.status;

                return (
                  <div key={activity.id} className="relative h-11">
                    <div
                      className="absolute top-0 flex h-11 flex-col justify-center overflow-hidden border border-[color:var(--accent)]/30 bg-[#fff1f4]"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${activity.title} · ${progress}% · ${statusLabel}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[color:var(--accent)]/25"
                        style={{ width: `${progress}%` }}
                      />
                      <div className="relative z-10 truncate px-2 text-[11px] font-semibold leading-tight text-[color:var(--ink)]">
                        {activity.title}
                      </div>
                      <div className="relative z-10 truncate px-2 text-[10px] text-[color:var(--muted)]">
                        {activity.date}
                        {activity.finishedDate ? ` → ${activity.finishedDate}` : ""} · {progress}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
