"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";
import { FollowUpAssistant } from "@/components/admin/FollowUpAssistant";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import { ScoreFieldInput } from "@/components/admin/ScoreFieldInput";
import { BudgetFieldInput } from "@/components/admin/BudgetFieldInput";
import { ListFieldInput } from "@/components/admin/ListFieldInput";
import { useToast } from "@/components/admin/AdminToast";
import {
  formatFieldHtml,
  isBudgetField,
  isListField,
  isScoreField,
} from "@/lib/followup/list-fields";
import {
  afterScoreCount,
  computeAverageScore,
  withComputedAverage,
} from "@/lib/followup/after-scores";
import {
  PHASE_LABELS,
  sectionTitle,
  createEmptyEvaluation,
  emptyBoard,
  fieldsForPhase,
  isPhaseUnlocked,
  markPhaseStatus,
  phaseProgress,
  type EvaluationFields,
  type EvaluationPhase,
  type FollowUpBoard,
  type PhaseStatus,
  type WorkshopEvaluation,
} from "@/lib/followup/types";
import type {
  ScheduleBeneficiary,
  WorkshopSession,
} from "@/lib/schedule/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function sessionTitle(session: WorkshopSession) {
  if (session.kind === "event") return session.eventName || session.title || "Evento";
  return session.title || "Taller";
}

function beneficiaryLabel(
  session: WorkshopSession,
  beneficiaries: ScheduleBeneficiary[],
) {
  const names = (session.beneficiaryIds || [])
    .map((id) => beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Sin beneficiario";
}

function statusBadge(status: PhaseStatus) {
  if (status === "done") return "Completa";
  if (status === "in_progress") return "En progreso";
  return "Pendiente";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fieldAnswerHtml(
  field: ReturnType<typeof fieldsForPhase>[number],
  value: string,
) {
  return formatFieldHtml(value, field, escapeHtml);
}

function exportEvaluationDocument({
  session,
  evaluation,
  beneficiaries,
}: {
  session: WorkshopSession;
  evaluation: WorkshopEvaluation;
  beneficiaries: ScheduleBeneficiary[];
}) {
  const phaseBlocks = (["before", "after"] as EvaluationPhase[])
    .map((phase) => {
      const fields = fieldsForPhase(phase);
      const sections = new Map<number, typeof fields>();
      for (const field of fields) {
        const list = sections.get(field.section) || [];
        list.push(field);
        sections.set(field.section, list);
      }
      const sectionsHtml = [...sections.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sectionNumber, sectionFields]) => {
          const rows = sectionFields
            .map(
              (field) => `<div class="field">
              <p class="q">${field.letter ? `${field.letter}. ` : ""}${escapeHtml(
                field.label,
              )}</p>
              <div class="a">${fieldAnswerHtml(
                field,
                evaluation.fields[field.key] || "",
              )}</div>
            </div>`,
            )
            .join("");
          return `<h3>${sectionNumber}. ${escapeHtml(
            sectionTitle(phase, sectionNumber),
          )}</h3>${rows}${
            phase === "after" && sectionNumber === 1
              ? `<div class="field"><p class="q">Nota promedio</p><div class="a">${escapeHtml(
                  evaluation.fields.averageScore
                    ? `${evaluation.fields.averageScore} / 5`
                    : "—",
                )}</div></div>`
              : ""
          }`;
        })
        .join("");

      return `<section>
        <h2>${PHASE_LABELS[phase]} · ${statusBadge(
          evaluation.phaseStatus[phase],
        )}</h2>
        ${sectionsHtml || "<p>Sin campos.</p>"}
      </section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sessionTitle(session))} · Evaluación Inspiralab</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 32px 24px; line-height: 1.5; }
    .brand { color: #e00d45; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; margin: 0; }
    h1 { font-size: 26px; margin: 8px 0 4px; }
    .meta { color: #666; margin: 0 0 24px; }
    h2 { font-size: 17px; margin: 28px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    h3 { font-size: 14px; margin: 18px 0 8px; color: #333; }
    .field { margin: 0 0 12px; }
    .q { font-weight: 700; margin: 0 0 4px; font-size: 13px; }
    .a { margin: 0; color: #333; white-space: pre-wrap; }
    .a ul.items { margin: 0; padding-left: 1.25rem; white-space: normal; }
    .a ul.items li { margin: 0 0 4px; }
    .a table.budget { width: 100%; border-collapse: collapse; margin: 0; white-space: normal; font-size: 12px; }
    .a table.budget th, .a table.budget td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    .a table.budget td.num, .a table.budget th:nth-child(2), .a table.budget th:nth-child(3) { text-align: right; }
    .a table.budget tr.total { background: #f7f7f7; }
    .a .budget-meta { margin: 0 0 8px; font-size: 12px; color: #666; }
    @media print { body { padding: 0; } @page { margin: 14mm; } }
  </style>
</head>
<body>
  <p class="brand">Inspiralab</p>
  <h1>${escapeHtml(sessionTitle(session))}</h1>
  <p class="meta">${escapeHtml(formatDate(session.date))}
    ${session.startTime ? ` · ${escapeHtml(session.startTime)}` : ""}
    · ${escapeHtml(beneficiaryLabel(session, beneficiaries))}
    · Completó: ${escapeHtml(evaluation.evaluatedBy || "—")}</p>
  ${phaseBlocks}
  ${
    evaluation.notes.trim()
      ? `<section><h2>Notas generales</h2><p class="a">${escapeHtml(
          evaluation.notes,
        ).replaceAll("\n", "<br/>")}</p></section>`
      : ""
  }
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      // impresión manual
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  return true;
}

export function WorkshopFollowUpBoard() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useAdminLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [board, setBoard] = useState<FollowUpBoard>(emptyBoard());
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<ScheduleBeneficiary[]>([]);
  const phase: EvaluationPhase = "after";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkshopEvaluation | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const today = useMemo(() => todayIso(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/followup", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("No se pudo cargar el seguimiento");
        const data = (await res.json()) as {
          evaluations?: WorkshopEvaluation[];
          sessions?: WorkshopSession[];
          beneficiaries?: ScheduleBeneficiary[];
        };
        if (!cancelled) {
          setBoard({
            evaluations: Array.isArray(data.evaluations) ? data.evaluations : [],
          });
          setSessions(Array.isArray(data.sessions) ? data.sessions : []);
          setBeneficiaries(
            Array.isArray(data.beneficiaries) ? data.beneficiaries : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Error al cargar",
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

  const evaluationBySession = useMemo(() => {
    const map = new Map<string, WorkshopEvaluation>();
    for (const item of board.evaluations) {
      if (item.sessionId) map.set(item.sessionId, item);
    }
    return map;
  }, [board.evaluations]);

  const workshopSessions = useMemo(
    () =>
      sessions.filter(
        (item) =>
          item.status !== "cancelled" &&
          item.status !== "pending_approval" &&
          item.status !== "rejected" &&
          Boolean(item.date),
      ),
    [sessions],
  );

  const phaseSessions = useMemo(() => {
    return workshopSessions
      .filter((session) => isPhaseUnlocked(session.date, today, phase))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return (a.startTime || "").localeCompare(b.startTime || "");
      });
  }, [workshopSessions, today, phase]);

  async function persist(next: FollowUpBoard) {
    setSaving(true);
    try {
      const res = await fetch("/api/followup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.status === 401) {
        router.push("/login");
        return false;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "No se pudo guardar");
      }
      setBoard(next);
      toast.success("Evaluación guardada");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openSession(session: WorkshopSession) {
    const existing = evaluationBySession.get(session.id);
    const evaluation = existing || createEmptyEvaluation(session.id);
    setSelectedId(session.id);
    setForm({
      ...evaluation,
      fields: withComputedAverage({ ...evaluation.fields }),
      phaseStatus: { ...evaluation.phaseStatus },
    });
  }

  function updateField(key: keyof EvaluationFields, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const fields = withComputedAverage({
        ...prev.fields,
        [key]: value,
      });
      return {
        ...prev,
        fields,
        phaseStatus: {
          ...prev.phaseStatus,
          [phase]:
            prev.phaseStatus[phase] === "done"
              ? "done"
              : ("in_progress" as PhaseStatus),
        },
      };
    });
  }

  async function saveForm(event: FormEvent, markDone: boolean) {
    event.preventDefault();
    if (!form || !selectedId) return;
    let nextEval = {
      ...form,
      sessionId: selectedId,
      fields: withComputedAverage(form.fields),
      updatedAt: new Date().toISOString(),
    };
    if (markDone) {
      nextEval = markPhaseStatus(nextEval, phase, "done");
    } else {
      const progress = phaseProgress(nextEval, phase);
      nextEval = markPhaseStatus(
        nextEval,
        phase,
        progress.filled > 0 ? "in_progress" : "empty",
      );
    }
    const others = board.evaluations.filter(
      (item) => item.sessionId !== selectedId,
    );
    const ok = await persist({ evaluations: [...others, nextEval] });
    if (ok) {
      setForm(nextEval);
    }
  }

  async function handleAssistantSave(evaluation: WorkshopEvaluation) {
    const others = board.evaluations.filter(
      (item) => item.sessionId !== evaluation.sessionId,
    );
    const ok = await persist({ evaluations: [...others, evaluation] });
    if (ok) {
      setAssistantOpen(false);
      setSelectedId(evaluation.sessionId);
      setForm(evaluation);
    }
  }

  const selectedSession =
    sessions.find((item) => item.id === selectedId) || null;
  const phaseFields = fieldsForPhase(phase);
  const sections = useMemo(() => {
    const map = new Map<number, typeof phaseFields>();
    for (const field of phaseFields) {
      const list = map.get(field.section) || [];
      list.push(field);
      map.set(field.section, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [phaseFields]);

  const averageScore = form ? computeAverageScore(form.fields) : "";
  const ratedCount = form ? afterScoreCount(form.fields) : 0;

  if (loading) {
    return (
      <div className="p-10 text-sm text-[color:var(--muted)]">{t.followup.loading}</div>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              {t.followup.pageTitle}
            </p>
            <p className="text-xs text-[color:var(--muted)]">{t.followup.pageSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminLanguageSwitcher />
            <Link
              href="/admin"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.panel}
            </Link>
            <Link
              href="/admin/cronograma"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.dashboard.schedule}
            </Link>
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              {t.common.guidedAssistant}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-12 md:px-8">
        <p className="mb-4 max-w-2xl text-sm text-[color:var(--muted)]">
          Cuando la fecha del taller ya pasó en el cronograma, califica cada
          aspecto de 1 a 5. Al final se calcula la nota promedio. También puedes
          registrar inconvenientes, mejoras y el enlace al registro fotográfico.
        </p>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="border border-[color:var(--line)] bg-white">
            <div className="border-b border-[color:var(--line)] px-4 py-3">
              <h2 className="text-sm font-bold text-[color:var(--ink)]">
                Talleres vencidos
              </h2>
              <p className="text-xs text-[color:var(--muted)]">
                {phaseSessions.length} disponible
                {phaseSessions.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="max-h-[70vh] divide-y divide-[color:var(--line)] overflow-y-auto">
              {phaseSessions.length === 0 ? (
                <li className="px-4 py-6 text-sm text-[color:var(--muted)]">
                  Aún no hay talleres con fecha vencida en el cronograma.
                </li>
              ) : (
                phaseSessions.map((session) => {
                  const evaluation = evaluationBySession.get(session.id);
                  const status = evaluation?.phaseStatus?.[phase] || "empty";
                  const progress = phaseProgress(evaluation, phase);
                  const active = selectedId === session.id;
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => openSession(session)}
                        className={`w-full px-4 py-3 text-left ${
                          active ? "bg-[#fff1f4]" : "hover:bg-[color:var(--mist)]"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[color:var(--ink)]">
                          {sessionTitle(session)}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                          {formatDate(session.date)}
                          {session.startTime ? ` · ${session.startTime}` : ""} ·{" "}
                          {beneficiaryLabel(session, beneficiaries)}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-[color:var(--accent)]">
                          {statusBadge(status)} · {progress.filled}/
                          {progress.total} campos
                        </p>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
            {!form || !selectedSession ? (
              <div className="py-16 text-center text-sm text-[color:var(--muted)]">
                Elige un taller vencido para completar su evaluación.
              </div>
            ) : (
              <form
                onSubmit={(event) => void saveForm(event, false)}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                      {sessionTitle(selectedSession)}
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {formatDate(selectedSession.date)} ·{" "}
                      {statusBadge(form.phaseStatus.after)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = exportEvaluationDocument({
                        session: selectedSession,
                        evaluation: form,
                        beneficiaries,
                      });
                      if (!ok) {
                        toast.error(
                          "Permite ventanas emergentes para exportar",
                        );
                        return;
                      }
                      toast.success("Listo para exportar / imprimir");
                    }}
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Exportar evaluación
                  </button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                    Quién evalúa / completa
                  </span>
                  <input
                    value={form.evaluatedBy}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, evaluatedBy: event.target.value }
                          : prev,
                      )
                    }
                    placeholder="Tu nombre"
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>

                {sections.map(([sectionNumber, fields]) => (
                  <div
                    key={sectionNumber}
                    className="space-y-3 border border-[color:var(--line)] p-4"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-[color:var(--ink)]">
                        {sectionNumber}. {sectionTitle(phase, sectionNumber)}
                      </h3>
                      {sectionNumber === 1 && phase === "after" ? (
                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          Califica cada pregunta de 1 (bajo) a 5 (excelente).
                        </p>
                      ) : null}
                    </div>
                    {fields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                          {field.letter ? `${field.letter} — ` : ""}
                          {field.label}
                        </p>
                        {isScoreField(field) ? (
                          <ScoreFieldInput
                            value={form.fields[field.key]}
                            onChange={(value) => updateField(field.key, value)}
                            help={field.help}
                          />
                        ) : field.inputType === "url" ? (
                          <input
                            type="url"
                            value={form.fields[field.key]}
                            onChange={(event) =>
                              updateField(field.key, event.target.value)
                            }
                            placeholder={field.help}
                            className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                          />
                        ) : isBudgetField(field) ? (
                          <BudgetFieldInput
                            value={form.fields[field.key]}
                            onChange={(value) => updateField(field.key, value)}
                            rateDate={selectedSession?.date || today}
                            placeholder={field.help}
                          />
                        ) : isListField(field) ? (
                          <ListFieldInput
                            value={form.fields[field.key]}
                            onChange={(value) => updateField(field.key, value)}
                            placeholder={field.help}
                          />
                        ) : (
                          <textarea
                            value={form.fields[field.key]}
                            onChange={(event) =>
                              updateField(field.key, event.target.value)
                            }
                            rows={3}
                            placeholder={field.help}
                            className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                          />
                        )}
                      </div>
                    ))}
                    {sectionNumber === 1 && phase === "after" ? (
                      <div className="border border-[color:var(--accent)]/30 bg-[#fff1f4] px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                          Nota promedio
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--ink)]">
                          {averageScore ? `${averageScore} / 5` : "—"}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          {ratedCount > 0
                            ? `Promedio de ${ratedCount} calificación${
                                ratedCount === 1 ? "" : "es"
                              } registrada${ratedCount === 1 ? "" : "s"}.`
                            : "Completa al menos una calificación para calcular el promedio."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                    Notas generales (opcional)
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev ? { ...prev, notes: event.target.value } : prev,
                      )
                    }
                    rows={2}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="border border-[color:var(--line)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar avance"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(event) => void saveForm(event, true)}
                    className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Marcar fase completa
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>

      <AdminFooter />

      <FollowUpAssistant
        open={assistantOpen}
        sessions={workshopSessions}
        evaluationsBySession={evaluationBySession}
        beneficiaries={beneficiaries}
        today={today}
        saving={saving}
        onClose={() => setAssistantOpen(false)}
        onSave={handleAssistantSave}
      />
    </div>
  );
}
