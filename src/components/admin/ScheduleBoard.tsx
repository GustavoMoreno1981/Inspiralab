"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFooter } from "@/components/admin/AdminFooter";
import {
  BeforeEvaluationSection,
  mergeBeforeIntoEvaluation,
} from "@/components/admin/BeforeEvaluationSection";
import { ProposalViewModal } from "@/components/admin/ProposalViewModal";
import { ScheduleAssistant } from "@/components/admin/ScheduleAssistant";
import { ScheduleGantt } from "@/components/admin/ScheduleGantt";
import { useToast } from "@/components/admin/AdminToast";
import {
  createEmptyEvaluation,
  emptyFields,
  type EvaluationFields,
  type FollowUpBoard,
  type WorkshopEvaluation,
} from "@/lib/followup/types";
import type { SiteContent } from "@/lib/i18n/dictionaries";
import { printProposalDocument } from "@/lib/schedule/export-proposal";
import {
  SESSION_KINDS,
  SESSION_STATUSES,
  createId,
  emptyBoard,
  isCalendarSession,
  type ScheduleBeneficiary,
  type ScheduleBoard,
  type SessionKind,
  type SessionStatus,
  type WorkshopOption,
  type WorkshopSession,
} from "@/lib/schedule/types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FLOWER_COLORS = ["#e00d45", "#0d6e8a", "#c47a12"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function monthLabel(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatTimeRange(start: string, end: string) {
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Hasta ${end}`;
  return "Sin hora";
}

function statusLabel(status: SessionStatus) {
  return SESSION_STATUSES.find((item) => item.value === status)?.label || status;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sessionDisplayTitle(session: WorkshopSession) {
  if (session.kind === "event") {
    return session.eventName || session.title || "Evento";
  }
  return session.title || "Taller";
}

function beneficiaryNames(
  session: WorkshopSession,
  beneficiaries: ScheduleBeneficiary[],
) {
  const names = (session.beneficiaryIds || [])
    .map((id) => beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean) as string[];
  return names.length ? names.join(", ") : "Sin beneficiario";
}

function SessionCardMeta({
  session,
  beneficiaries,
}: {
  session: WorkshopSession;
  beneficiaries: ScheduleBeneficiary[];
}) {
  return (
    <dl className="mt-2 space-y-1 text-xs">
      <div className="flex gap-1.5">
        <dt className="shrink-0 font-semibold text-[color:var(--ink)]">Dónde:</dt>
        <dd className="text-[color:var(--ink)]">
          {session.location?.trim() || "Sin lugar"}
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="shrink-0 font-semibold text-[color:var(--ink)]">
          Beneficiario:
        </dt>
        <dd className="text-[color:var(--ink)]">
          {beneficiaryNames(session, beneficiaries)}
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="shrink-0 font-semibold text-[color:var(--ink)]">Coach:</dt>
        <dd className="text-[color:var(--ink)]">
          {session.coach?.trim() || "Sin coach"}
        </dd>
      </div>
    </dl>
  );
}

function statusClass(status: SessionStatus) {
  if (status === "done") return "bg-emerald-50 text-emerald-800";
  if (status === "cancelled") return "bg-stone-100 text-stone-500 line-through";
  if (status === "pending_approval") return "bg-amber-50 text-amber-900";
  return "bg-[color:var(--mist)] text-[color:var(--ink)]";
}

function extractWorkshopOptions(content: SiteContent | null): WorkshopOption[] {
  if (!content) return [];
  const categories = content.es?.workshops?.categories || [];
  const options: WorkshopOption[] = [];
  categories.forEach((category, flowerIndex) => {
    (category.workshops || []).forEach((workshop) => {
      options.push({
        id: workshop.id,
        title: workshop.title || "Sin título",
        flowerIndex,
        flowerName: category.title || `Flor ${flowerIndex + 1}`,
        coach: workshop.coach || "",
        duration: workshop.duration || "",
      });
    });
  });
  // Orden fijo: Amor → Fe → Esperanza; dentro de cada flor, por título.
  return options.sort((a, b) => {
    if (a.flowerIndex !== b.flowerIndex) {
      return a.flowerIndex - b.flowerIndex;
    }
    return a.title.localeCompare(b.title, "es");
  });
}

function blankForm(date = ""): WorkshopSession {
  const now = new Date().toISOString();
  return {
    id: "",
    kind: "workshop",
    eventName: "",
    workshopId: "",
    flowerIndex: -1,
    title: "",
    date,
    startTime: "09:00",
    endTime: "11:00",
    location: "",
    coach: "",
    beneficiaryIds: [],
    status: "scheduled",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function ScheduleBoard() {
  const router = useRouter();
  const toast = useToast();
  const [board, setBoard] = useState<ScheduleBoard>(emptyBoard());
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<ScheduleBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [today] = useState(() => new Date());
  const [todayIso] = useState(() =>
    toIsoDate(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<WorkshopSession | null>(
    null,
  );
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [form, setForm] = useState<WorkshopSession>(blankForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<WorkshopEvaluation[]>([]);
  const [beforeFields, setBeforeFields] = useState<EvaluationFields>(emptyFields());
  const [beforeEvaluatedBy, setBeforeEvaluatedBy] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [scheduleRes, contentRes, accountingRes, followupRes] =
          await Promise.all([
          fetch("/api/schedule", { cache: "no-store" }),
          fetch("/api/content", { cache: "no-store" }),
          fetch("/api/accounting", { cache: "no-store" }),
          fetch("/api/followup", { cache: "no-store" }),
        ]);
        if (scheduleRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!scheduleRes.ok) throw new Error("No se pudo cargar el cronograma");
        const schedule = (await scheduleRes.json()) as ScheduleBoard & {
          beneficiaries?: ScheduleBeneficiary[];
        };
        const content = contentRes.ok
          ? ((await contentRes.json()) as SiteContent)
          : null;

        let fromSchedule = Array.isArray(schedule.beneficiaries)
          ? schedule.beneficiaries
          : [];
        // Refuerzo: si Contabilidad responde, usa ese listado (fuente de verdad).
        if (accountingRes.ok) {
          const accounting = (await accountingRes.json()) as {
            beneficiaries?: Array<{ id: string; name?: string; contact?: string }>;
          };
          if (Array.isArray(accounting.beneficiaries) && accounting.beneficiaries.length) {
            fromSchedule = accounting.beneficiaries
              .map((item) => ({
                id: item.id,
                name: item.name || "Sin nombre",
                contact: item.contact || "",
              }))
              .sort((a, b) => a.name.localeCompare(b.name, "es"));
          }
        }

        const followup = followupRes.ok
          ? ((await followupRes.json()) as FollowUpBoard)
          : null;

        if (!cancelled) {
          setBoard({
            sessions: Array.isArray(schedule.sessions) ? schedule.sessions : [],
          });
          setBeneficiaries(fromSchedule);
          setWorkshops(extractWorkshopOptions(content));
          setEvaluations(
            Array.isArray(followup?.evaluations) ? followup.evaluations : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Error al cargar cronograma",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, toast]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkshopSession[]>();
    for (const session of board.sessions) {
      if (!session.date || !isCalendarSession(session.status)) continue;
      const list = map.get(session.date) || [];
      list.push(session);
      map.set(session.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    }
    return map;
  }, [board.sessions]);

  const calendarDays = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: Array<{
      key: string;
      day: number | null;
      iso: string | null;
      inMonth: boolean;
    }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ key: `pad-${i}`, day: null, iso: null, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        key: `d-${day}`,
        day,
        iso: toIsoDate(cursor.year, cursor.month, day),
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({
        key: `trail-${cells.length}`,
        day: null,
        iso: null,
        inMonth: false,
      });
    }
    return cells;
  }, [cursor]);

  const pendingProposals = useMemo(
    () =>
      [...board.sessions]
        .filter((item) => item.status === "pending_approval")
        .sort((a, b) => {
          const byDate = a.date.localeCompare(b.date);
          if (byDate !== 0) return byDate;
          return (a.startTime || "").localeCompare(b.startTime || "");
        }),
    [board.sessions],
  );

  const upcoming = useMemo(() => {
    return [...board.sessions]
      .filter(
        (item) =>
          item.date >= todayIso &&
          item.status !== "cancelled" &&
          item.status !== "pending_approval",
      )
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return (a.startTime || "").localeCompare(b.startTime || "");
      })
      .slice(0, 12);
  }, [board.sessions, todayIso]);

  async function persist(next: ScheduleBoard, successMessage?: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.status === 401) {
        router.push("/login");
        return false;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo guardar");
      }
      setBoard(next);
      toast.success(successMessage || "Cronograma guardado");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function proposalFieldsFor(sessionId: string): EvaluationFields {
    const evaluation = evaluations.find((item) => item.sessionId === sessionId);
    return evaluation?.fields ? { ...evaluation.fields } : emptyFields();
  }

  function proposalAuthorFor(sessionId: string) {
    return evaluations.find((item) => item.sessionId === sessionId)?.evaluatedBy || "";
  }

  function printPendingProposal(session: WorkshopSession) {
    const ok = printProposalDocument({
      session,
      fields: proposalFieldsFor(session.id),
      evaluatedBy: proposalAuthorFor(session.id),
      beneficiaries,
    });
    if (!ok) {
      toast.error("Permite ventanas emergentes para imprimir la propuesta");
      return;
    }
    toast.success("Listo para imprimir la propuesta");
  }

  async function approveProposal(sessionId: string) {
    const nextSessions = board.sessions.map((item) =>
      item.id === sessionId
        ? {
            ...item,
            status: "scheduled" as SessionStatus,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    return persist(
      { sessions: nextSessions },
      "Propuesta aprobada · ya está en el calendario",
    );
  }

  function loadBeforeEvaluation(sessionId: string | null) {
    if (!sessionId) {
      setBeforeFields(emptyFields());
      setBeforeEvaluatedBy("");
      return;
    }
    const existing = evaluations.find((item) => item.sessionId === sessionId);
    if (existing) {
      setBeforeFields({ ...existing.fields });
      setBeforeEvaluatedBy(existing.evaluatedBy || "");
      return;
    }
    setBeforeFields(emptyFields());
    setBeforeEvaluatedBy("");
  }

  async function persistBeforeEvaluation(
    sessionId: string,
    fields = beforeFields,
    evaluatedBy = beforeEvaluatedBy,
  ) {
    const existing =
      evaluations.find((item) => item.sessionId === sessionId) ||
      createEmptyEvaluation(sessionId);
    const merged = mergeBeforeIntoEvaluation(existing, fields, evaluatedBy);
    const others = evaluations.filter((item) => item.sessionId !== sessionId);
    const nextBoard: FollowUpBoard = { evaluations: [...others, merged] };
    const res = await fetch("/api/followup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextBoard),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "No se pudo guardar la evaluación previa");
    }
    setEvaluations(nextBoard.evaluations);
  }

  function openCreate(date: string) {
    setEditingId(null);
    setForm(blankForm(date));
    loadBeforeEvaluation(null);
    setModalOpen(true);
  }

  function openEdit(session: WorkshopSession) {
    setViewingProposal(null);
    setEditingId(session.id);
    setForm({
      ...session,
      kind: session.kind === "event" ? "event" : "workshop",
      eventName: session.eventName || (session.kind === "event" ? session.title : ""),
      beneficiaryIds: Array.isArray(session.beneficiaryIds)
        ? session.beneficiaryIds
        : [],
    });
    loadBeforeEvaluation(session.id);
    setModalOpen(true);
  }

  function openViewProposal(session: WorkshopSession) {
    setViewingProposal(session);
  }

  function toggleBeneficiary(id: string) {
    setForm((prev) => {
      const current = prev.beneficiaryIds || [];
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { ...prev, beneficiaryIds: next };
    });
  }

  function applyWorkshop(workshopId: string) {
    const workshop = workshops.find((item) => item.id === workshopId);
    setForm((prev) => ({
      ...prev,
      kind: "workshop",
      workshopId,
      flowerIndex: workshop?.flowerIndex ?? -1,
      title: workshop?.title || prev.title,
      coach: workshop?.coach || prev.coach,
      eventName: "",
    }));
  }

  function applyCopiedEvent(sourceId: string) {
    if (!sourceId) return;
    const source = board.sessions.find((item) => item.id === sourceId);
    if (!source) return;
    setForm((prev) => ({
      ...prev,
      kind: "event",
      eventName: source.eventName || source.title,
      title: source.title,
      workshopId: "",
      flowerIndex: -1,
      startTime: source.startTime || prev.startTime,
      endTime: source.endTime || prev.endTime,
      location: source.location,
      coach: source.coach,
      beneficiaryIds: [...(source.beneficiaryIds || [])],
      notes: source.notes,
      status: "scheduled",
    }));
  }

  const existingEvents = useMemo(
    () =>
      board.sessions
        .filter(
          (item) =>
            item.kind === "event" &&
            item.id !== editingId &&
            (item.eventName || item.title),
        )
        .sort((a, b) =>
          (a.eventName || a.title).localeCompare(b.eventName || b.title, "es"),
        ),
    [board.sessions, editingId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.date.trim()) {
      toast.error("Elige una fecha");
      return;
    }
    const kind: SessionKind = form.kind === "event" ? "event" : "workshop";
    const eventName = form.eventName.trim();
    const title =
      form.title.trim() || (kind === "event" ? eventName : "");
    if (kind === "event" && !eventName && !title) {
      toast.error("Escribe el nombre del evento");
      return;
    }
    if (!title) {
      toast.error("Escribe el nombre del taller o sesión");
      return;
    }

    const now = new Date().toISOString();
    const session: WorkshopSession = {
      ...form,
      id: editingId || createId(),
      kind,
      eventName: kind === "event" ? eventName || title : "",
      workshopId: kind === "workshop" ? form.workshopId : "",
      flowerIndex: kind === "workshop" ? form.flowerIndex : -1,
      title,
      location: form.location.trim(),
      coach: form.coach.trim(),
      notes: form.notes.trim(),
      beneficiaryIds: Array.isArray(form.beneficiaryIds)
        ? form.beneficiaryIds
        : [],
      createdAt: editingId ? form.createdAt || now : now,
      updatedAt: now,
    };

    const nextSessions = editingId
      ? board.sessions.map((item) => (item.id === editingId ? session : item))
      : [...board.sessions, session];

    const ok = await persist({ sessions: nextSessions });
    if (!ok) return;
    try {
      await persistBeforeEvaluation(session.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Cronograma guardado, pero falló la evaluación previa",
      );
      return;
    }
    setModalOpen(false);
  }

  async function handleAssistantCreate(
    session: WorkshopSession,
    before?: { fields: EvaluationFields; evaluatedBy: string },
  ) {
    const ok = await persist(
      { sessions: [...board.sessions, session] },
      "Propuesta enviada · pendiente de aprobación de Don Saul",
    );
    if (!ok) return false;
    if (before) {
      try {
        await persistBeforeEvaluation(
          session.id,
          before.fields,
          before.evaluatedBy,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Propuesta guardada, pero falló la planificación previa",
        );
        return false;
      }
    }
    return true;
  }

  async function handleAssistantApprove(sessionId: string) {
    const session = board.sessions.find((item) => item.id === sessionId);
    const ok = await approveProposal(sessionId);
    if (ok && session?.date) {
      const [y, m] = session.date.split("-").map(Number);
      if (y && m) setCursor({ year: y, month: m - 1 });
    }
    return ok;
  }

  async function handleAssistantUpdate(input: {
    sessionId: string;
    status: SessionStatus;
    notes: string;
  }) {
    const target = board.sessions.find((item) => item.id === input.sessionId);
    if (!target) return false;
    const nextSessions = board.sessions.map((item) =>
      item.id === input.sessionId
        ? {
            ...item,
            status: input.status,
            notes: input.notes,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    const ok = await persist({ sessions: nextSessions });
    if (ok) setAssistantOpen(false);
    return ok;
  }

  async function handleDelete(sessionId?: string) {
    const id = sessionId || editingId;
    if (!id) return;
    const target = board.sessions.find((item) => item.id === id);
    const label =
      target?.kind === "event"
        ? target.eventName || target.title || "este evento"
        : target?.title || "esta sesión";
    const kindLabel = target?.kind === "event" ? "evento" : "taller";
    if (!window.confirm(`¿Eliminar el ${kindLabel} “${label}” del cronograma?`)) {
      return;
    }
    const next = {
      sessions: board.sessions.filter((item) => item.id !== id),
    };
    await persist(next);
    if (editingId === id) {
      setModalOpen(false);
      setEditingId(null);
    }
  }

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function exportPdf() {
    const monthName = monthLabel(cursor.year, cursor.month);
    const monthPrefix = `${cursor.year}-${pad(cursor.month + 1)}`;
    const monthSessions = [...board.sessions]
      .filter(
        (item) =>
          item.date.startsWith(monthPrefix) && isCalendarSession(item.status),
      )
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return (a.startTime || "").localeCompare(b.startTime || "");
      });
    const allSessions = [...board.sessions].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    const listHtml = allSessions.length
      ? `<table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Título</th>
              <th>Fecha</th>
              <th>Horario</th>
              <th>Lugar</th>
              <th>Coach</th>
              <th>Beneficiarios</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            ${allSessions
              .map((session) => {
                const kind =
                  session.kind === "event" ? "Evento" : "Taller";
                return `<tr>
                  <td>${escapeHtml(kind)}</td>
                  <td>${escapeHtml(sessionDisplayTitle(session))}</td>
                  <td>${escapeHtml(session.date.split("-").reverse().join("/"))}</td>
                  <td>${escapeHtml(formatTimeRange(session.startTime, session.endTime))}</td>
                  <td>${escapeHtml(session.location || "—")}</td>
                  <td>${escapeHtml(session.coach || "—")}</td>
                  <td>${escapeHtml(beneficiaryNames(session, beneficiaries))}</td>
                  <td>${escapeHtml(statusLabel(session.status))}</td>
                  <td>${escapeHtml(session.notes || "—")}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>`
      : `<p class="empty">No hay sesiones programadas.</p>`;

    const calendarCells = calendarDays
      .map((cell) => {
        if (!cell.inMonth || !cell.iso) {
          return `<div class="day empty-day"></div>`;
        }
        const sessions = sessionsByDate.get(cell.iso) || [];
        const items = sessions
          .slice(0, 4)
          .map((session) => {
            const kind = session.kind === "event" ? "E" : "T";
            return `<div class="chip ${session.kind === "event" ? "event" : "workshop"}">${escapeHtml(
              `${kind} ${session.startTime ? `${session.startTime} ` : ""}${sessionDisplayTitle(session)}`,
            )}</div>`;
          })
          .join("");
        const more =
          sessions.length > 4
            ? `<div class="more">+${sessions.length - 4} más</div>`
            : "";
        return `<div class="day">
          <div class="num">${cell.day}</div>
          ${items}${more}
        </div>`;
      })
      .join("");

    const active = allSessions.filter((item) => isCalendarSession(item.status));
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
    const ganttRows = [
      ...byBeneficiary.map((row) => ({
        label: row.beneficiary.name,
        sessions: row.sessions,
      })),
      ...(leftover.length
        ? [{ label: "Sin beneficiario", sessions: leftover }]
        : []),
    ];

    let ganttHtml = `<p class="empty">Sin datos para el Gantt.</p>`;
    if (ganttRows.length) {
      const days = active
        .map((item) => item.date)
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .map((value) => {
          const [y, m, d] = value.split("-").map(Number);
          return Date.UTC(y, m - 1, d);
        });
      if (days.length) {
        const DAY = 86400000;
        let min = Math.min(...days) - DAY;
        let max = Math.max(...days) + DAY;
        if (max <= min) max = min + 7 * DAY;
        const span = Math.max(max - min, DAY);
        const ticks: number[] = [];
        const tickCount = Math.min(8, Math.max(4, Math.round(span / DAY) + 1));
        for (let i = 0; i < tickCount; i += 1) {
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
            return `<span class="tick" style="left:${left}%">${escapeHtml(label)}</span>`;
          })
          .join("");

        ganttHtml = `<div class="gantt">
          <div class="gantt-head">
            <div class="gantt-label">Beneficiario</div>
            <div class="gantt-track">${tickLabels}</div>
          </div>
          ${ganttRows
            .map((row) => {
              const bars = row.sessions
                .map((session) => {
                  const [y, m, d] = session.date.split("-").map(Number);
                  const start = Date.UTC(y, m - 1, d);
                  const left = ((start - min) / span) * 100;
                  const width = Math.max((DAY / span) * 100, 2.5);
                  const color =
                    session.kind === "event"
                      ? "#5b21b6"
                      : session.flowerIndex >= 0
                        ? FLOWER_COLORS[session.flowerIndex % 3]
                        : "#e00d45";
                  return `<div class="bar" style="left:${left}%;width:${width}%;border-color:${color};background:${color}22">
                    <span style="border-left:3px solid ${color}">${escapeHtml(sessionDisplayTitle(session))}</span>
                  </div>`;
                })
                .join("");
              return `<div class="gantt-row">
                <div class="gantt-label">
                  <strong>${escapeHtml(row.label)}</strong>
                  <small>${row.sessions.length} sesión${row.sessions.length === 1 ? "" : "es"}</small>
                </div>
                <div class="gantt-track">${bars}</div>
              </div>`;
            })
            .join("")}
        </div>`;
      }
    }

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cronograma Inspiralab — ${escapeHtml(monthName)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 28px; max-width: 1100px; margin: 0 auto; }
    h1 { color: #e00d45; font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; color: #111; }
    .meta { color: #666; font-size: 12px; margin: 0 0 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f6f6f6; }
    .empty { color: #777; font-size: 13px; }
    .cal { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #ddd; }
    .wd { background: #f6f6f6; font-size: 10px; font-weight: 700; text-align: center; padding: 6px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; }
    .day { min-height: 84px; border-right: 1px solid #eee; border-bottom: 1px solid #eee; padding: 6px; }
    .empty-day { background: #fafafa; }
    .num { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
    .chip { font-size: 9px; padding: 2px 4px; margin-bottom: 2px; background: #fff1f4; border-left: 3px solid #e00d45; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .chip.event { background: #f3e8ff; border-left-color: #5b21b6; }
    .more { font-size: 9px; color: #777; }
    .gantt { border: 1px solid #ddd; }
    .gantt-head, .gantt-row { display: grid; grid-template-columns: 180px 1fr; border-bottom: 1px solid #eee; }
    .gantt-head { background: #f6f6f6; }
    .gantt-label { padding: 10px; border-right: 1px solid #eee; font-size: 12px; }
    .gantt-label small { display: block; color: #777; margin-top: 2px; }
    .gantt-track { position: relative; min-height: 52px; padding: 8px; }
    .tick { position: absolute; top: 4px; transform: translateX(-50%); font-size: 9px; color: #777; }
    .bar { position: absolute; top: 22px; height: 24px; border: 1px solid; font-size: 10px; overflow: hidden; }
    .bar span { display: block; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { padding: 0; } @page { margin: 12mm; size: landscape; } }
  </style>
</head>
<body>
  <h1>Inspiralab — Cronograma</h1>
  <p class="meta">${escapeHtml(monthName)} · ${allSessions.length} sesión${allSessions.length === 1 ? "" : "es"} en total · ${monthSessions.length} en este mes</p>

  <h2>1. Información del cronograma</h2>
  ${listHtml}

  <h2>2. Calendario — ${escapeHtml(monthName)}</h2>
  <div class="cal">
    ${WEEKDAYS.map((day) => `<div class="wd">${day}</div>`).join("")}
    ${calendarCells}
  </div>

  <h2>3. Gantt por beneficiario</h2>
  ${ganttHtml}

  <p class="footer">Inspiralab · Exportado ${escapeHtml(
    new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
  )}</p>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      toast.error("Permite ventanas emergentes para exportar el PDF");
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
    toast.success("Listo para exportar / imprimir PDF");
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="border-b border-[color:var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--accent)]">
              Inspiralab
            </p>
            <p className="text-sm text-[color:var(--muted)]">Cronograma de talleres</p>
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">
              Recordatorios por correo a 5, 3 y 1 día antes (admin@inspiralab.org y equipo)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Panel
            </Link>
            <button
              type="button"
              onClick={exportPdf}
              disabled={loading}
              className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              Asistente guiado
            </button>
            <button
              type="button"
              onClick={() => openCreate(todayIso)}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              Programar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8 md:py-10">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)]">
            Cronograma
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)]">
            Programa talleres y eventos. El Gantt va arriba; debajo, el calendario
            mensual.
          </p>
        </div>

        {loading ? (
          <p className="mt-10 text-sm text-[color:var(--muted)]">Cargando calendario…</p>
        ) : (
          <div className="mt-8 space-y-8">
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                    Gantt por beneficiario
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Vista temporal de talleres y eventos. Haz clic en una barra
                    para editarla.
                  </p>
                </div>
                <p className="text-xs text-[color:var(--muted)]">
                  {beneficiaries.length} beneficiario
                  {beneficiaries.length === 1 ? "" : "s"} en el listado
                </p>
              </div>
              <ScheduleGantt
                sessions={board.sessions}
                beneficiaries={beneficiaries}
                onSelectSession={openEdit}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                    Calendario
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => shiftMonth(-1)}
                      className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
                    >
                      Anterior
                    </button>
                    <p className="min-w-[10rem] text-center text-sm font-semibold text-[color:var(--ink)]">
                      {monthLabel(cursor.year, cursor.month)}
                    </p>
                    <button
                      type="button"
                      onClick={() => shiftMonth(1)}
                      className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
                    >
                      Siguiente
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCursor({
                          year: today.getFullYear(),
                          month: today.getMonth(),
                        })
                      }
                      className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold"
                    >
                      Hoy
                    </button>
                  </div>
                </div>

                <div className="border border-[color:var(--line)] bg-white">
                  <div className="grid grid-cols-7 border-b border-[color:var(--line)]">
                    {WEEKDAYS.map((day) => (
                      <div
                        key={day}
                        className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((cell) => {
                      const sessions = cell.iso
                        ? sessionsByDate.get(cell.iso) || []
                        : [];
                      const isToday = cell.iso === todayIso;
                      return (
                        <div
                          key={cell.key}
                          role={cell.inMonth && cell.iso ? "button" : undefined}
                          tabIndex={cell.inMonth && cell.iso ? 0 : undefined}
                          onClick={() => {
                            if (cell.iso) openCreate(cell.iso);
                          }}
                          onKeyDown={(event) => {
                            if (
                              cell.iso &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              openCreate(cell.iso);
                            }
                          }}
                          className={`min-h-[110px] border-b border-r border-[color:var(--line)] p-2 text-left align-top ${
                            cell.inMonth
                              ? "cursor-pointer bg-white hover:bg-[color:var(--mist)]/50"
                              : "bg-[color:var(--mist)]/40"
                          } ${isToday ? "!bg-[#fff5f8]" : ""}`}
                        >
                          {cell.day && cell.iso ? (
                            <>
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center text-xs font-semibold ${
                                  isToday
                                    ? "rounded-full bg-[color:var(--accent)] text-white"
                                    : "text-[color:var(--ink)]"
                                }`}
                              >
                                {cell.day}
                              </span>
                              <div className="mt-1 space-y-1">
                                {sessions.slice(0, 3).map((session) => {
                                  const color =
                                    session.kind === "event"
                                      ? "#5b21b6"
                                      : session.flowerIndex >= 0
                                        ? FLOWER_COLORS[session.flowerIndex % 3]
                                        : "var(--accent)";
                                  const label =
                                    session.kind === "event"
                                      ? session.eventName || session.title
                                      : session.title;
                                  return (
                                    <button
                                      key={session.id}
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openEdit(session);
                                      }}
                                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold ${statusClass(session.status)}`}
                                      style={{ borderLeft: `3px solid ${color}` }}
                                      title={`${session.kind === "event" ? "Evento · " : ""}${label} · ${formatTimeRange(session.startTime, session.endTime)}`}
                                    >
                                      {session.startTime
                                        ? `${session.startTime} `
                                        : ""}
                                      {session.kind === "event" ? "E · " : ""}
                                      {label}
                                    </button>
                                  );
                                })}
                                {sessions.length > 3 ? (
                                  <span className="block px-1 text-[10px] text-[color:var(--muted)]">
                                    +{sessions.length - 3} más
                                  </span>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="border border-amber-200 bg-amber-50/80 p-4">
                  <h2 className="text-sm font-semibold text-amber-950">
                    Pendientes de aprobación
                  </h2>
                  <p className="mt-1 text-xs text-amber-900">
                    Don Saul o quien autorice debe aprobar para que aparezcan en
                    el calendario.
                  </p>
                  {pendingProposals.length === 0 ? (
                    <p className="mt-3 text-sm text-amber-900/80">
                      No hay propuestas pendientes.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {pendingProposals.map((session) => (
                        <li
                          key={session.id}
                          className="border border-amber-200 bg-white px-3 py-2"
                        >
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            {sessionDisplayTitle(session)}
                          </p>
                          <p className="mt-1.5">
                            <span className="text-sm font-bold tabular-nums text-[color:var(--ink)]">
                              {session.date.split("-").reverse().join("/")}
                            </span>
                            <span className="mx-1 text-sm text-[color:var(--muted)]">
                              ·
                            </span>
                            <span className="text-sm font-medium text-[color:var(--ink)]">
                              {formatTimeRange(session.startTime, session.endTime)}
                            </span>
                          </p>
                          <SessionCardMeta
                            session={session}
                            beneficiaries={beneficiaries}
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void approveProposal(session.id)}
                              className="bg-[color:var(--accent)] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() => printPendingProposal(session)}
                              className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                            >
                              Imprimir propuesta
                            </button>
                            <button
                              type="button"
                              onClick={() => openViewProposal(session)}
                              className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(session)}
                              className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                            >
                              Editar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border border-[color:var(--line)] bg-white p-4">
                  <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                    Próximas sesiones
                  </h2>
                  {upcoming.length === 0 ? (
                    <p className="mt-3 text-sm text-[color:var(--muted)]">
                      No hay talleres programados a futuro.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {upcoming.map((session) => (
                        <li
                          key={session.id}
                          className="border border-[color:var(--line)] px-3 py-2"
                        >
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            {session.kind === "event" ? "Evento · " : ""}
                            {session.kind === "event"
                              ? session.eventName || session.title
                              : session.title}
                          </p>
                          <p className="mt-1.5">
                            <span className="text-sm font-bold tabular-nums text-[color:var(--ink)]">
                              {session.date.split("-").reverse().join("/")}
                            </span>
                            <span className="mx-1 text-sm text-[color:var(--muted)]">
                              ·
                            </span>
                            <span className="text-sm font-medium text-[color:var(--ink)]">
                              {formatTimeRange(session.startTime, session.endTime)}
                            </span>
                          </p>
                          <SessionCardMeta
                            session={session}
                            beneficiaries={beneficiaries}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(session)}
                              className="border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(session.id)}
                              disabled={saving}
                              className="border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </aside>
            </div>
          </div>
        )}
      </main>

      <AdminFooter />

      <ProposalViewModal
        open={Boolean(viewingProposal)}
        session={viewingProposal}
        fields={
          viewingProposal
            ? proposalFieldsFor(viewingProposal.id)
            : emptyFields()
        }
        evaluatedBy={
          viewingProposal ? proposalAuthorFor(viewingProposal.id) : ""
        }
        beneficiaries={beneficiaries}
        saving={saving}
        onClose={() => setViewingProposal(null)}
        onEdit={() => {
          if (!viewingProposal) return;
          openEdit(viewingProposal);
        }}
        onPrint={() => {
          if (!viewingProposal) return;
          printPendingProposal(viewingProposal);
        }}
        onApprove={() => {
          if (!viewingProposal) return;
          void approveProposal(viewingProposal.id).then((ok) => {
            if (ok) setViewingProposal(null);
          });
        }}
      />

      <ScheduleAssistant
        open={assistantOpen}
        workshops={workshops}
        beneficiaries={beneficiaries}
        sessions={board.sessions}
        saving={saving}
        defaultDate={todayIso}
        onClose={() => setAssistantOpen(false)}
        onCreate={handleAssistantCreate}
        onApprove={handleAssistantApprove}
        onUpdate={handleAssistantUpdate}
      />

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="max-h-[90svh] w-full max-w-2xl overflow-y-auto border border-[color:var(--line)] bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  {editingId
                    ? form.status === "pending_approval"
                      ? "Editar propuesta"
                      : form.kind === "event"
                        ? "Editar evento"
                        : "Editar taller"
                    : "Programar en calendario"}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {editingId
                    ? form.status === "pending_approval"
                      ? "Modifica la propuesta y guarda. Don Saul debe aprobar para que aparezca en el calendario."
                      : "Modifica los datos y guarda, o elimina esta sesión."
                    : "Puede ser un taller del catálogo o un evento."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Tipo
                </span>
                <select
                  value={form.kind || "workshop"}
                  onChange={(event) => {
                    const kind = event.target.value as SessionKind;
                    setForm((prev) => ({
                      ...prev,
                      kind,
                      workshopId: kind === "workshop" ? prev.workshopId : "",
                      flowerIndex: kind === "workshop" ? prev.flowerIndex : -1,
                      eventName: kind === "event" ? prev.eventName || prev.title : "",
                      title:
                        kind === "event"
                          ? prev.eventName || prev.title
                          : prev.title,
                    }));
                  }}
                  className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                >
                  {SESSION_KINDS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.kind === "event" ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Copiar de un evento existente
                    </span>
                    <select
                      defaultValue=""
                      onChange={(event) => applyCopiedEvent(event.target.value)}
                      className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                    >
                      <option value="">No copiar · evento nuevo</option>
                      {existingEvents.map((item) => (
                        <option key={item.id} value={item.id}>
                          {(item.eventName || item.title) +
                            (item.date
                              ? ` · ${item.date.split("-").reverse().join("/")}`
                              : "")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Nombre del evento
                    </span>
                    <input
                      required
                      value={form.eventName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          eventName: event.target.value,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Ej: Día de la familia, inauguración…"
                      className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                    />
                  </label>
                </>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Taller del catálogo
                  </span>
                  <select
                    value={form.workshopId}
                    onChange={(event) => applyWorkshop(event.target.value)}
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  >
                    <option value="">Sesión libre / sin catálogo</option>
                    {workshops.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.flowerName} · {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.kind !== "event" ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Título
                  </span>
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1.5 sm:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Fecha
                  </span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Inicio
                  </span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Fin
                  </span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        endTime: event.target.value,
                      }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Lugar
                  </span>
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Salón, sede, virtual…"
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Coach / facilita
                  </span>
                  <input
                    value={form.coach}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, coach: event.target.value }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>

              {form.status === "pending_approval" ? (
                <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Estado
                  </span>
                  <p className="mt-0.5 font-semibold">Pendiente de aprobación</p>
                </div>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Estado
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as SessionStatus,
                      }))
                    }
                    className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  >
                    {SESSION_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <fieldset className="space-y-2 border border-[color:var(--line)] p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Beneficiarios
                </legend>
                {beneficiaries.length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    No hay beneficiarios. Créalos en Contabilidad para
                    asignarlos aquí.
                  </p>
                ) : (
                  <ul className="max-h-44 space-y-2 overflow-y-auto">
                    {beneficiaries.map((item) => {
                      const checked = (form.beneficiaryIds || []).includes(
                        item.id,
                      );
                      return (
                        <li key={item.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-[color:var(--ink)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBeneficiary(item.id)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold">{item.name}</span>
                              {item.contact ? (
                                <span className="block text-xs text-[color:var(--muted)]">
                                  {item.contact}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(form.beneficiaryIds || []).length > 0 ? (
                  <p className="text-xs text-[color:var(--muted)]">
                    {(form.beneficiaryIds || []).length} seleccionado
                    {(form.beneficiaryIds || []).length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </fieldset>

              <BeforeEvaluationSection
                fields={beforeFields}
                evaluatedBy={beforeEvaluatedBy}
                budgetDate={form.date || todayIso}
                onFieldChange={(key, value) =>
                  setBeforeFields((prev) => ({ ...prev, [key]: value }))
                }
                onEvaluatedByChange={setBeforeEvaluatedBy}
              />

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Notas
                </span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
              </label>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Vista Gantt
                </p>
                <ScheduleGantt
                  sessions={[
                    ...board.sessions.filter((item) => item.id !== editingId),
                    {
                      ...form,
                      id: editingId || "__draft__",
                      title: form.title.trim() || "Nueva sesión",
                      beneficiaryIds: form.beneficiaryIds || [],
                    },
                  ]}
                  beneficiaries={beneficiaries}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              {editingId && form.status === "pending_approval" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void approveProposal(editingId).then((ok) => {
                        if (ok) setModalOpen(false);
                      })
                    }
                    className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Aprobar y programar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      printPendingProposal({
                        ...form,
                        id: editingId,
                        beneficiaryIds: form.beneficiaryIds || [],
                      })
                    }
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Imprimir propuesta
                  </button>
                </div>
              ) : editingId ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  disabled={saving}
                >
                  {form.kind === "event" ? "Eliminar evento" : "Eliminar taller"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Guardando…"
                    : editingId
                      ? form.status === "pending_approval"
                        ? "Guardar propuesta"
                        : "Guardar cambios"
                      : "Guardar"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
