"use client";

import {
  SESSION_STATUSES,
  type ScheduleBeneficiary,
  type WorkshopSession,
} from "@/lib/schedule/types";

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
const FLOWER_COLORS = ["#e00d45", "#0d6e8a", "#c47a12"];
const EVENT_COLOR = "#5b21b6";

const GANTT_LEGEND = [
  { label: "Taller · Flor del Amor", color: FLOWER_COLORS[0] },
  { label: "Taller · Flor de la Fe", color: FLOWER_COLORS[1] },
  { label: "Taller · Flor de la Esperanza", color: FLOWER_COLORS[2] },
  { label: "Evento", color: EVENT_COLOR },
] as const;

function GanttLegendFlag({ color }: { color: string }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-stretch" aria-hidden>
      <span
        className="w-1 rounded-l-sm"
        style={{ backgroundColor: color }}
      />
      <span
        className="h-5 w-7 rounded-r-sm border border-black/15 shadow-sm"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function GanttLegendBar() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-[color:var(--line)] bg-[color:var(--mist)]/50 px-4 py-3">
      <span className="text-xs font-semibold text-[color:var(--ink)]">
        Identificación por color
      </span>
      {GANTT_LEGEND.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]"
        >
          <GanttLegendFlag color={item.color} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

type Props = {
  sessions: WorkshopSession[];
  beneficiaries: ScheduleBeneficiary[];
  onSelectSession?: (session: WorkshopSession) => void;
};

export function ScheduleGantt({
  sessions,
  beneficiaries,
  onSelectSession,
}: Props) {
  const active = sessions.filter((item) => item.status !== "cancelled");

  const timeline = (() => {
    const days = active
      .map((item) => parseDay(item.date))
      .filter((v): v is number => v != null);
    if (!days.length) return null;

    let min = Math.min(...days);
    let max = Math.max(...days);
    if (max <= min) max = addDays(min, 7);
    min = addDays(min, -1);
    max = addDays(max, 1);
    const span = Math.max(max - min, DAY);
    const ticks: number[] = [];
    const tickCount = Math.min(8, Math.max(4, Math.round(span / DAY) + 1));
    for (let i = 0; i < tickCount; i += 1) {
      ticks.push(min + (span * i) / (tickCount - 1));
    }
    return { min, max, span, ticks };
  })();

  if (!active.length || !timeline) {
    return (
      <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
        <GanttLegendBar />
        <div className="p-8 text-center text-sm text-[color:var(--muted)]">
          Programa talleres con fecha para ver el gráfico Gantt.
        </div>
      </div>
    );
  }

  const byBeneficiary = beneficiaries
    .map((beneficiary) => ({
      beneficiary,
      sessions: active.filter((session) =>
        (session.beneficiaryIds || []).includes(beneficiary.id),
      ),
    }))
    .filter((row) => row.sessions.length > 0);

  const linkedIds = new Set(
    byBeneficiary.flatMap((row) => row.sessions.map((session) => session.id)),
  );
  const leftover = active.filter((session) => !linkedIds.has(session.id));

  const rows: Array<{
    key: string;
    label: string;
    subtitle: string;
    sessions: WorkshopSession[];
  }> = [
    ...byBeneficiary.map((row) => ({
      key: row.beneficiary.id,
      label: row.beneficiary.name,
      subtitle: row.beneficiary.contact || "Beneficiario",
      sessions: row.sessions,
    })),
    ...(leftover.length
      ? [
          {
            key: "__none__",
            label: "Sin beneficiario",
            subtitle: "Sesiones sin asignar",
            sessions: leftover,
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-x-auto border border-[color:var(--line)] bg-white">
      <GanttLegendBar />
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[200px_1fr] border-b border-[color:var(--line)] bg-[color:var(--mist)]/60">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Beneficiario
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

        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[200px_1fr] border-b border-[color:var(--line)] last:border-b-0"
          >
            <div className="border-r border-[color:var(--line)] px-4 py-4">
              <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                {row.label}
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                {row.sessions.length}{" "}
                {row.sessions.length === 1 ? "taller" : "talleres"}
                {row.subtitle ? ` · ${row.subtitle}` : ""}
              </p>
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

              {row.sessions.map((session) => {
                const start = parseDay(session.date);
                if (start == null) return null;
                const end = start;
                const left = ((start - timeline.min) / timeline.span) * 100;
                const width = Math.max(
                  ((end - start + DAY) / timeline.span) * 100,
                  2.5,
                );
                const color =
                  session.kind === "event"
                    ? EVENT_COLOR
                    : session.flowerIndex >= 0
                      ? FLOWER_COLORS[session.flowerIndex % 3]
                      : FLOWER_COLORS[0];
                const status =
                  SESSION_STATUSES.find((item) => item.value === session.status)
                    ?.label || session.status;
                const label =
                  session.kind === "event"
                    ? `Evento · ${session.eventName || session.title}`
                    : session.title;

                return (
                  <div key={`${row.key}-${session.id}`} className="relative h-11">
                    <button
                      type="button"
                      onClick={() => onSelectSession?.(session)}
                      className="absolute top-0 flex h-11 w-full flex-col justify-center overflow-hidden border text-left"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        borderColor: `${color}55`,
                        background: `${color}14`,
                      }}
                      title={`${label} · ${session.date} · ${status}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ background: color }}
                      />
                      <div className="relative z-10 truncate px-2 text-[11px] font-semibold leading-tight text-[color:var(--ink)]">
                        {label}
                      </div>
                      <div className="relative z-10 truncate px-2 text-[10px] text-[color:var(--muted)]">
                        {session.date}
                        {session.startTime ? ` · ${session.startTime}` : ""} ·{" "}
                        {status}
                      </div>
                    </button>
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
