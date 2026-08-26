"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyEvaluation,
  fieldsForPhase,
  isPhaseUnlocked,
  markPhaseStatus,
  type EvaluationFields,
  type FieldDef,
  type WorkshopEvaluation,
} from "@/lib/followup/types";
import {
  computeAverageScore,
  withComputedAverage,
} from "@/lib/followup/after-scores";
import { isScoreField } from "@/lib/followup/list-fields";
import type {
  ScheduleBeneficiary,
  WorkshopSession,
} from "@/lib/schedule/types";

type Step = "pick" | "who" | "fields" | "confirm";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type Props = {
  open: boolean;
  sessions: WorkshopSession[];
  evaluationsBySession: Map<string, WorkshopEvaluation>;
  beneficiaries: ScheduleBeneficiary[];
  today: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (evaluation: WorkshopEvaluation) => Promise<void>;
};

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

function msg(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
  };
}

function fieldPrompt(field: FieldDef) {
  const prefix = field.letter
    ? `${field.section}${field.letter}. `
    : `${field.section}. `;
  const scale = isScoreField(field) ? " Califica de 1 a 5." : "";
  return `${prefix}${field.label}.${scale} ${field.help}`;
}

export function FollowUpAssistant({
  open,
  sessions,
  evaluationsBySession,
  beneficiaries,
  today,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const phaseFields = useMemo(() => fieldsForPhase("after"), []);
  const [step, setStep] = useState<Step>("pick");
  const [fieldIndex, setFieldIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkshopEvaluation | null>(null);
  const [textInput, setTextInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectable = useMemo(
    () =>
      sessions
        .filter((item) => isPhaseUnlocked(item.date, today, "after"))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, today],
  );

  const selected = selectable.find((item) => item.id === sessionId) || null;

  const totalSteps = 2 + phaseFields.length + 1;
  const stepNumber = useMemo(() => {
    if (step === "pick") return 1;
    if (step === "who") return 2;
    if (step === "fields") return 3 + fieldIndex;
    return totalSteps;
  }, [step, fieldIndex, totalSteps]);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setFieldIndex(0);
    setSessionId(null);
    setDraft(null);
    setTextInput("");
    setMessages([
      msg(
        "assistant",
        "Hola. Te guío para evaluar un taller que ya se realizó. Elige cuál quieres evaluar.",
      ),
    ]);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step, fieldIndex]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, msg(role, text)]);
  }

  function askField(index: number, currentDraft: WorkshopEvaluation) {
    const field = phaseFields[index];
    if (!field) return;
    const existing = currentDraft.fields[field.key]?.trim();
    push("assistant", fieldPrompt(field));
    setTextInput(existing || "");
  }

  function pickSession(session: WorkshopSession) {
    const existing = evaluationsBySession.get(session.id);
    const nextDraft = existing
      ? {
          ...existing,
          fields: { ...existing.fields },
          phaseStatus: { ...existing.phaseStatus },
        }
      : createEmptyEvaluation(session.id);

    setSessionId(session.id);
    setDraft(nextDraft);
    push(
      "user",
      `${sessionTitle(session)} · ${formatDate(session.date)}`,
    );
    push(
      "assistant",
      `Perfecto: ${sessionTitle(session)} (${beneficiaryLabel(
        session,
        beneficiaries,
      )}). ¿Quién está evaluando este taller?`,
    );
    setStep("who");
    setTextInput(nextDraft.evaluatedBy || "");
  }

  function submitWho() {
    const name = textInput.trim();
    if (!name || !draft) return;
    const next = { ...draft, evaluatedBy: name };
    setDraft(next);
    push("user", name);
    setTextInput("");
    setFieldIndex(0);
    setStep("fields");
    askField(0, next);
  }

  function submitFieldValue(value: string, skip = false) {
    if (!draft) return;
    const field = phaseFields[fieldIndex];
    if (!field) return;
    const finalValue = skip ? draft.fields[field.key] || "" : value.trim();
    if (!skip && !isScoreField(field) && !finalValue) return;

    const nextFields = withComputedAverage({
      ...draft.fields,
      [field.key]: finalValue,
    });
    const nextDraft = { ...draft, fields: nextFields };
    setDraft(nextDraft);
    push(
      "user",
      skip && !finalValue
        ? "Sin respuesta / saltar"
        : isScoreField(field) && finalValue
          ? `${finalValue} / 5`
          : finalValue || "—",
    );

    const nextIndex = fieldIndex + 1;
    if (nextIndex < phaseFields.length) {
      setFieldIndex(nextIndex);
      askField(nextIndex, nextDraft);
      return;
    }
    setStep("confirm");
    push(
      "assistant",
      "Listo. Revisa el resumen y confirma para guardar la evaluación.",
    );
  }

  async function confirmSave(markDone: boolean) {
    if (!draft || !sessionId) return;
    let evaluation: WorkshopEvaluation = {
      ...draft,
      sessionId,
      fields: withComputedAverage(draft.fields),
      evaluatedBy: draft.evaluatedBy.trim(),
      updatedAt: new Date().toISOString(),
    };
    evaluation = markPhaseStatus(
      evaluation,
      "after",
      markDone ? "done" : "in_progress",
    );
    await onSave(evaluation);
  }

  if (!open) return null;

  const progressPct = Math.round((stepNumber / totalSteps) * 100);
  const currentField = step === "fields" ? phaseFields[fieldIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]">
              Asistente guiado
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              Paso {stepNumber} de {totalSteps} · Evaluación posterior
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>

        <div className="h-1.5 bg-[color:var(--mist)]">
          <div
            className="h-full bg-[color:var(--accent)] transition-all"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {messages.map((item) => (
            <div
              key={item.id}
              className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 text-sm ${
                  item.role === "user"
                    ? "bg-[color:var(--accent)] text-white"
                    : "border border-[color:var(--line)] bg-[color:var(--mist)] text-[color:var(--ink)]"
                }`}
              >
                {item.text}
              </div>
            </div>
          ))}

          {step === "confirm" && draft && selected ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-[color:var(--ink)]">
                {sessionTitle(selected)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Evaluación · {draft.evaluatedBy || "—"}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                {phaseFields.map((field) => (
                  <li key={field.key}>
                    <strong>{field.label}:</strong>{" "}
                    {isScoreField(field)
                      ? draft.fields[field.key]?.trim()
                        ? `${draft.fields[field.key]} / 5`
                        : "—"
                      : draft.fields[field.key]?.trim() || "—"}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
                Nota promedio:{" "}
                {computeAverageScore(draft.fields)
                  ? `${computeAverageScore(draft.fields)} / 5`
                  : "—"}
              </p>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-[color:var(--line)] bg-white px-4 py-3">
          {step === "pick" ? (
            selectable.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                No hay talleres vencidos para evaluar hoy.
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {selectable.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => pickSession(session)}
                      className="w-full border border-[color:var(--line)] px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
                    >
                      <span className="font-semibold text-[color:var(--ink)]">
                        {sessionTitle(session)}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {formatDate(session.date)} ·{" "}
                        {beneficiaryLabel(session, beneficiaries)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {step === "who" ? (
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitWho();
                  }
                }}
                placeholder="Tu nombre"
                className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={submitWho}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "fields" && currentField ? (
            isScoreField(currentField) ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => submitFieldValue(String(score))}
                    className="min-w-[2.5rem] border border-[color:var(--line)] px-3 py-2 text-sm font-semibold hover:border-[color:var(--accent)]"
                  >
                    {score}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => submitFieldValue("", true)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  Saltar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <textarea
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  rows={currentField.inputType === "url" ? 1 : 3}
                  placeholder={
                    currentField.inputType === "url"
                      ? "https://..."
                      : "Escribe tu respuesta"
                  }
                  className="min-w-[12rem] w-full flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => submitFieldValue("", true)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={() => submitFieldValue(textInput)}
                  disabled={!textInput.trim()}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )
          ) : null}

          {step === "confirm" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClose}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSave(false)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Guardar avance
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSave(true)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar evaluación"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
