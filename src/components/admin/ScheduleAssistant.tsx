"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BudgetFieldInput } from "@/components/admin/BudgetFieldInput";
import { ListFieldInput } from "@/components/admin/ListFieldInput";
import { parseBudgetField } from "@/lib/followup/budget-fields";
import {
  formatFieldDisplay,
  isBudgetField,
  isListField,
  parseListField,
} from "@/lib/followup/list-fields";
import {
  emptyFields,
  fieldsForPhase,
  type EvaluationFields,
  type FieldDef,
} from "@/lib/followup/types";
import { printProposalDocument } from "@/lib/schedule/export-proposal";
import type { ApprovalBudgetContext } from "@/lib/accounting/approval-budget";
import { proposalBudgetTotalCop } from "@/lib/followup/budget-fields";
import { ApprovalBudgetPanel } from "@/components/admin/ApprovalBudgetPanel";
import { ProposalBudgetBreakdown } from "@/components/admin/ProposalBudgetBreakdown";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import {
  SESSION_STATUSES,
  createId,
  type ScheduleBeneficiary,
  type SessionKind,
  type SessionStatus,
  type WorkshopOption,
  type WorkshopSession,
} from "@/lib/schedule/types";

type Intent = "create" | "update";

type Step =
  | "intent"
  | "kind"
  | "identity"
  | "date"
  | "times"
  | "location"
  | "coach"
  | "beneficiaries"
  | "notes"
  | "beforeWho"
  | "beforeFields"
  | "pick"
  | "status"
  | "confirm"
  | "pendingApproval";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type CreateDraft = {
  kind: SessionKind;
  workshopId: string;
  flowerIndex: number;
  eventName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  coach: string;
  beneficiaryIds: string[];
  notes: string;
};

type UpdateDraft = {
  sessionId: string;
  status: SessionStatus | null;
  notes: string;
};

type Props = {
  open: boolean;
  workshops: WorkshopOption[];
  beneficiaries: ScheduleBeneficiary[];
  sessions: WorkshopSession[];
  saving?: boolean;
  defaultDate?: string;
  canApprove?: boolean;
  approvalBudget?: ApprovalBudgetContext | null;
  onClose: () => void;
  onCreate: (
    session: WorkshopSession,
    before?: { fields: EvaluationFields; evaluatedBy: string },
  ) => Promise<boolean>;
  onApprove: (sessionId: string) => Promise<boolean>;
  onUpdate: (input: {
    sessionId: string;
    status: SessionStatus;
    notes: string;
  }) => Promise<boolean>;
};

function msg(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
  };
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: SessionStatus) {
  return SESSION_STATUSES.find((item) => item.value === status)?.label || status;
}

function sessionLabel(session: WorkshopSession) {
  if (session.kind === "event") {
    return session.eventName || session.title || "Evento";
  }
  return session.title || "Taller";
}

function beneficiaryNames(ids: string[], beneficiaries: ScheduleBeneficiary[]) {
  return ids
    .map((id) => beneficiaries.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

function emptyCreateDraft(defaultDate?: string): CreateDraft {
  return {
    kind: "workshop",
    workshopId: "",
    flowerIndex: -1,
    eventName: "",
    title: "",
    date: defaultDate || todayIso(),
    startTime: "09:00",
    endTime: "11:00",
    location: "",
    coach: "",
    beneficiaryIds: [],
    notes: "",
  };
}

function fieldPrompt(field: FieldDef) {
  const prefix = field.letter
    ? `${field.section}${field.letter}. `
    : `${field.section}. `;
  return `${prefix}${field.label}. ${field.help}`;
}

function emptyUpdateDraft(): UpdateDraft {
  return { sessionId: "", status: null, notes: "" };
}

const BEFORE_FIELDS = fieldsForPhase("before");
const CREATE_BASE_STEPS = 9;
const CREATE_STEPS = CREATE_BASE_STEPS + 1 + BEFORE_FIELDS.length + 1;
const UPDATE_STEPS = 4;

export function ScheduleAssistant({
  open,
  workshops,
  beneficiaries,
  sessions,
  saving = false,
  defaultDate,
  canApprove = false,
  approvalBudget = null,
  onClose,
  onCreate,
  onApprove,
  onUpdate,
}: Props) {
  const { t } = useAdminLanguage();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [step, setStep] = useState<Step>("intent");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(() =>
    emptyCreateDraft(defaultDate),
  );
  const [updateDraft, setUpdateDraft] = useState<UpdateDraft>(emptyUpdateDraft);
  const [textInput, setTextInput] = useState("");
  const [dateValue, setDateValue] = useState(defaultDate || todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [beforeFields, setBeforeFields] = useState<EvaluationFields>(emptyFields);
  const [beforeEvaluatedBy, setBeforeEvaluatedBy] = useState("");
  const [beforeFieldIndex, setBeforeFieldIndex] = useState(0);
  const [savedProposal, setSavedProposal] = useState<WorkshopSession | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const editableSessions = useMemo(
    () =>
      [...sessions]
        .filter((item) => item.status !== "cancelled")
        .sort((a, b) => {
          const byDate = a.date.localeCompare(b.date);
          if (byDate !== 0) return byDate;
          return (a.startTime || "").localeCompare(b.startTime || "");
        }),
    [sessions],
  );

  const selectedSession =
    sessions.find((item) => item.id === updateDraft.sessionId) || null;

  const totalSteps =
    intent === "create" ? CREATE_STEPS : intent === "update" ? UPDATE_STEPS : 1;

  const stepNumber = useMemo(() => {
    if (step === "intent") return 1;
    if (intent === "create") {
      if (step === "kind") return 2;
      if (step === "identity") return 3;
      if (step === "date") return 4;
      if (step === "times") return 5;
      if (step === "location") return 6;
      if (step === "coach") return 7;
      if (step === "beneficiaries") return 8;
      if (step === "notes") return 9;
      if (step === "beforeWho") return 10;
      if (step === "beforeFields") return 11 + beforeFieldIndex;
      return CREATE_STEPS;
    }
    if (step === "pick") return 2;
    if (step === "status") return 3;
    if (step === "notes") return 4;
    return 4;
  }, [step, intent, beforeFieldIndex]);

  useEffect(() => {
    if (!open) return;
    setIntent(null);
    setStep("intent");
    setCreateDraft(emptyCreateDraft(defaultDate));
    setUpdateDraft(emptyUpdateDraft());
    setTextInput("");
    setDateValue(defaultDate || todayIso());
    setStartTime("09:00");
    setEndTime("11:00");
    setBeforeFields(emptyFields());
    setBeforeEvaluatedBy("");
    setBeforeFieldIndex(0);
    setSavedProposal(null);
    setMessages([msg("assistant", t.schedule.assistantGreeting)]);
  }, [open, defaultDate, t.schedule.assistantGreeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, msg(role, text)]);
  }

  function chooseIntent(next: Intent) {
    setIntent(next);
    push(
      "user",
      next === "create"
        ? t.schedule.assistantNewRequest
        : t.schedule.assistantUpdateSession,
    );
    if (next === "create") {
      setStep("kind");
      push("assistant", "¿Es un taller del catálogo o un evento libre?");
      return;
    }
    setStep("pick");
    push(
      "assistant",
      editableSessions.length
        ? "Elige la sesión que quieres actualizar."
        : "No hay sesiones para actualizar. Puedes programar una nueva.",
    );
  }

  function chooseKind(kind: SessionKind) {
    setCreateDraft((prev) => ({
      ...prev,
      kind,
      workshopId: kind === "workshop" ? prev.workshopId : "",
      flowerIndex: kind === "workshop" ? prev.flowerIndex : -1,
      eventName: kind === "event" ? prev.eventName : "",
    }));
    push("user", kind === "event" ? "Evento" : "Taller");
    setStep("identity");
    if (kind === "event") {
      push("assistant", "¿Cómo se llama el evento?");
      setTextInput("");
    } else {
      push(
        "assistant",
        workshops.length
          ? "Elige el taller del catálogo."
          : "No hay talleres en el catálogo. Escribe el nombre del taller.",
      );
      setTextInput("");
    }
  }

  function pickWorkshop(workshop: WorkshopOption) {
    setCreateDraft((prev) => ({
      ...prev,
      kind: "workshop",
      workshopId: workshop.id,
      flowerIndex: workshop.flowerIndex,
      title: workshop.title,
      coach: workshop.coach || prev.coach,
      eventName: "",
    }));
    push("user", `${workshop.title} · ${workshop.flowerName}`);
    setStep("date");
    setDateValue(createDraft.date || defaultDate || todayIso());
    push("assistant", "¿En qué fecha se realiza?");
  }

  function submitIdentity() {
    const value = textInput.trim();
    if (!value) return;
    if (createDraft.kind === "event") {
      setCreateDraft((prev) => ({
        ...prev,
        eventName: value,
        title: value,
      }));
      push("user", value);
    } else {
      setCreateDraft((prev) => ({
        ...prev,
        title: value,
        workshopId: "",
        flowerIndex: -1,
      }));
      push("user", value);
    }
    setTextInput("");
    setStep("date");
    setDateValue(createDraft.date || defaultDate || todayIso());
    push("assistant", "¿En qué fecha se realiza?");
  }

  function submitDate() {
    if (!dateValue) return;
    setCreateDraft((prev) => ({ ...prev, date: dateValue }));
    push("user", formatDate(dateValue));
    setStep("times");
    setStartTime(createDraft.startTime || "09:00");
    setEndTime(createDraft.endTime || "11:00");
    push("assistant", "Indica la hora de inicio y la hora de fin.");
  }

  function submitTimes() {
    if (!startTime) {
      push("assistant", "Necesito al menos la hora de inicio.");
      return;
    }
    if (endTime && endTime < startTime) {
      push("assistant", "La hora de fin no puede ser anterior al inicio.");
      return;
    }
    setCreateDraft((prev) => ({
      ...prev,
      startTime,
      endTime,
    }));
    push(
      "user",
      endTime ? `${startTime} – ${endTime}` : startTime,
    );
    setStep("location");
    push("assistant", "¿Dónde se realiza? Puedes escribir el lugar o saltar.");
    setTextInput(createDraft.location || "");
  }

  function submitLocation(skip = false) {
    const value = skip ? "" : textInput.trim();
    setCreateDraft((prev) => ({ ...prev, location: value }));
    push("user", skip || !value ? "Sin lugar" : value);
    setTextInput("");
    setStep("coach");
    push("assistant", "¿Quién es el coach o responsable? Puedes saltar.");
    setTextInput(createDraft.coach || "");
  }

  function submitCoach(skip = false) {
    const value = skip ? createDraft.coach : textInput.trim();
    setCreateDraft((prev) => ({ ...prev, coach: value }));
    push("user", value ? value : "Sin coach");
    setTextInput("");
    setStep("beneficiaries");
    push(
      "assistant",
      beneficiaries.length
        ? "¿A qué beneficiarios aplica? Selecciona uno o más, o salta."
        : "No hay beneficiarios en contabilidad. Puedes continuar sin asignar.",
    );
  }

  function toggleBeneficiary(id: string) {
    setCreateDraft((prev) => {
      const exists = prev.beneficiaryIds.includes(id);
      return {
        ...prev,
        beneficiaryIds: exists
          ? prev.beneficiaryIds.filter((item) => item !== id)
          : [...prev.beneficiaryIds, id],
      };
    });
  }

  function submitBeneficiaries(skip = false) {
    if (skip) {
      setCreateDraft((prev) => ({ ...prev, beneficiaryIds: [] }));
      push("user", "Sin beneficiarios");
    } else {
      const names =
        beneficiaryNames(createDraft.beneficiaryIds, beneficiaries) ||
        "Sin beneficiarios";
      push("user", names);
    }
    setStep("notes");
    push(
      "assistant",
      "¿Quieres agregar una nota? Puedes escribirla o saltar este paso.",
    );
    setTextInput("");
  }

  function askBeforeField(index: number, fields: EvaluationFields) {
    const field = BEFORE_FIELDS[index];
    if (!field) return;
    push("assistant", fieldPrompt(field));
    if (!isListField(field) && !isBudgetField(field)) {
      setTextInput(fields[field.key]?.trim() || "");
    }
  }

  function submitNotes(skip = false) {
    const value = skip ? "" : textInput.trim();
    if (intent === "create") {
      setCreateDraft((prev) => ({ ...prev, notes: value }));
      push("user", skip || !value ? "Sin notas" : value);
      setTextInput("");
      setStep("beforeWho");
      push(
        "assistant",
        "Ahora la evaluación previa. ¿Quién completa esta planificación?",
      );
      setTextInput("");
      return;
    }
    setUpdateDraft((prev) => ({ ...prev, notes: value }));
    push("user", skip || !value ? "Sin cambio de notas" : value);
    setTextInput("");
    setStep("confirm");
    push("assistant", "Revisa el resumen y confirma para guardar.");
  }

  function submitBeforeWho() {
    const name = textInput.trim();
    if (!name) return;
    setBeforeEvaluatedBy(name);
    push("user", name);
    setTextInput("");
    setBeforeFieldIndex(0);
    setStep("beforeFields");
    askBeforeField(0, beforeFields);
  }

  function submitBeforeField(skip = false) {
    const field = BEFORE_FIELDS[beforeFieldIndex];
    if (!field) return;

    let nextFields: EvaluationFields;
    let displayValue: string;

    if (isListField(field)) {
      const current = beforeFields[field.key];
      if (!skip && !parseListField(current).length) return;
      nextFields = beforeFields;
      displayValue = formatFieldDisplay(current, field);
    } else if (isBudgetField(field)) {
      const current = beforeFields[field.key];
      if (!skip && !parseBudgetField(current).lines.length) return;
      nextFields = beforeFields;
      displayValue = formatFieldDisplay(current, field);
    } else {
      const value = skip ? beforeFields[field.key] || "" : textInput.trim();
      if (!skip && !value) return;
      nextFields = { ...beforeFields, [field.key]: value };
      setBeforeFields(nextFields);
      displayValue = value || "—";
    }

    const skipped =
      skip &&
      !parseListField(nextFields[field.key]).length &&
      !parseBudgetField(nextFields[field.key]).lines.length &&
      !nextFields[field.key]?.trim();
    push("user", skipped ? "Sin respuesta / saltar" : displayValue);

    const nextIndex = beforeFieldIndex + 1;
    if (nextIndex < BEFORE_FIELDS.length) {
      setBeforeFieldIndex(nextIndex);
      setTextInput("");
      askBeforeField(nextIndex, nextFields);
      return;
    }
    setStep("confirm");
    push(
      "assistant",
      "Listo. Revisa el resumen y envía la propuesta. Don Saul (o quien autorice) debe aprobarla para que aparezca en el calendario.",
    );
  }

  function pickSession(session: WorkshopSession) {
    setUpdateDraft({
      sessionId: session.id,
      status: null,
      notes: session.notes || "",
    });
    push("user", `${sessionLabel(session)} · ${formatDate(session.date)}`);
    setStep("status");
    push(
      "assistant",
      `Ahora está “${statusLabel(session.status)}”. ¿A qué estado la pasas?`,
    );
  }

  function submitStatus(status: SessionStatus) {
    setUpdateDraft((prev) => ({ ...prev, status }));
    push("user", statusLabel(status));
    setStep("notes");
    push(
      "assistant",
      "¿Quieres actualizar la nota? Puedes escribirla o saltar.",
    );
    setTextInput(updateDraft.notes || selectedSession?.notes || "");
  }

  async function confirmSave() {
    if (intent === "create") {
      const kind = createDraft.kind;
      const title =
        createDraft.title.trim() ||
        (kind === "event" ? createDraft.eventName.trim() : "");
      if (!createDraft.date || !title) return;
      if (kind === "event" && !createDraft.eventName.trim() && !title) return;

      const now = new Date().toISOString();
      const session: WorkshopSession = {
        id: createId("sess"),
        kind,
        eventName: kind === "event" ? createDraft.eventName.trim() || title : "",
        workshopId: kind === "workshop" ? createDraft.workshopId : "",
        flowerIndex: kind === "workshop" ? createDraft.flowerIndex : -1,
        title,
        date: createDraft.date,
        startTime: createDraft.startTime || "",
        endTime: createDraft.endTime || "",
        location: createDraft.location.trim(),
        coach: createDraft.coach.trim(),
        beneficiaryIds: [...createDraft.beneficiaryIds],
        status: "pending_approval",
        notes: createDraft.notes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      const ok = await onCreate(session, {
        fields: beforeFields,
        evaluatedBy: beforeEvaluatedBy,
      });
      if (ok) {
        setSavedProposal(session);
        setStep("pendingApproval");
        push(
          "assistant",
          "Propuesta guardada y pendiente de aprobación. Puedes imprimirla o aprobarla ahora para programarla en el calendario.",
        );
      }
      return;
    }

    if (!updateDraft.sessionId || !updateDraft.status) return;
    const ok = await onUpdate({
      sessionId: updateDraft.sessionId,
      status: updateDraft.status,
      notes: updateDraft.notes.trim(),
    });
    if (ok) onClose();
  }

  async function approveProposal() {
    if (!savedProposal) return;
    const ok = await onApprove(savedProposal.id);
    if (ok) onClose();
  }

  function printProposal() {
    if (!savedProposal) return;
    const ok = printProposalDocument({
      session: savedProposal,
      fields: beforeFields,
      evaluatedBy: beforeEvaluatedBy,
      beneficiaries,
    });
    if (!ok) {
      push(
        "assistant",
        "No se pudo abrir la ventana de impresión. Permite ventanas emergentes e intenta de nuevo.",
      );
    }
  }

  if (!open) return null;

  const progressPct = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]">
              Asistente guiado
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {step === "pendingApproval"
                ? "Pendiente de aprobación"
                : `Paso ${stepNumber} de ${totalSteps} · Sin IA, solo preguntas`}
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

        <div className="h-1.5 shrink-0 bg-[color:var(--mist)]">
          <div
            className="h-full bg-[color:var(--accent)] transition-all"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {step !== "pendingApproval" && (step === "intent" || intent === "create") ? (
            <div className="border border-[color:var(--accent)]/35 bg-[color:var(--mist)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                {t.schedule.assistantRequestTitle}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--ink)]">
                {t.schedule.assistantRequestNotice}
              </p>
            </div>
          ) : null}

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

          {step === "pendingApproval" && savedProposal ? (
            <div className="space-y-3">
              <div className="border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">
                  {sessionLabel(savedProposal)}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {formatDate(savedProposal.date)} · Pendiente de aprobación ·
                  elaboró {beforeEvaluatedBy || "—"}
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  {canApprove
                    ? t.schedule.approvalHint
                    : t.schedule.approvalOnlyAdmin}
                </p>
              </div>
              {canApprove ? (
                <ApprovalBudgetPanel
                  budget={approvalBudget}
                  proposedCop={proposalBudgetTotalCop(
                    beforeFields.budgetMinimum,
                    beforeFields.budgetOptional,
                  )}
                  compact
                />
              ) : null}
              <ProposalBudgetBreakdown
                compact
                budgetMinimum={beforeFields.budgetMinimum}
                budgetOptional={beforeFields.budgetOptional}
              />
            </div>
          ) : null}

          {step === "confirm" && intent === "create" ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-[color:var(--ink)]">
                {createDraft.kind === "event"
                  ? createDraft.eventName || createDraft.title
                  : createDraft.title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {createDraft.kind === "event" ? "Evento" : "Taller"} ·{" "}
                {formatDate(createDraft.date)} · {createDraft.startTime || "—"}
                {createDraft.endTime ? ` – ${createDraft.endTime}` : ""}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Lugar: {createDraft.location || "—"} · Coach:{" "}
                {createDraft.coach || "—"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Beneficiarios:{" "}
                {beneficiaryNames(createDraft.beneficiaryIds, beneficiaries) ||
                  "—"}
              </p>
              {createDraft.notes ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Notas: {createDraft.notes}
                </p>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-[color:var(--ink)]">
                Planificación · {beforeEvaluatedBy || "—"}
              </p>
              <ul className="mt-1 space-y-1 text-xs text-[color:var(--muted)]">
                {BEFORE_FIELDS.map((field) => (
                  <li key={field.key}>
                    <strong>{field.label}:</strong>{" "}
                    {formatFieldDisplay(beforeFields[field.key], field)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "confirm" && intent === "update" && selectedSession ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-[color:var(--ink)]">
                {sessionLabel(selectedSession)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {formatDate(selectedSession.date)} ·{" "}
                {statusLabel(selectedSession.status)} →{" "}
                <strong>
                  {updateDraft.status ? statusLabel(updateDraft.status) : "—"}
                </strong>
              </p>
              {updateDraft.notes ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Nota: {updateDraft.notes}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--muted)]">Sin nota</p>
              )}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-[color:var(--line)] bg-white px-4 py-3">
          {step === "intent" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseIntent("create")}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {t.schedule.assistantNewRequest}
              </button>
              <button
                type="button"
                onClick={() => chooseIntent("update")}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {t.schedule.assistantUpdateSession}
              </button>
            </div>
          ) : null}

          {step === "kind" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseKind("workshop")}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Taller
              </button>
              <button
                type="button"
                onClick={() => chooseKind("event")}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                Evento
              </button>
            </div>
          ) : null}

          {step === "identity" && createDraft.kind === "workshop" ? (
            workshops.length ? (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {workshops.map((workshop) => (
                  <li key={workshop.id}>
                    <button
                      type="button"
                      onClick={() => pickWorkshop(workshop)}
                      className="w-full border border-[color:var(--line)] px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
                    >
                      <span className="font-semibold text-[color:var(--ink)]">
                        {workshop.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {workshop.flowerName}
                        {workshop.coach ? ` · ${workshop.coach}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitIdentity();
                    }
                  }}
                  placeholder="Nombre del taller"
                  className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={submitIdentity}
                  disabled={!textInput.trim()}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )
          ) : null}

          {step === "identity" && createDraft.kind === "event" ? (
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitIdentity();
                  }
                }}
                placeholder="Nombre del evento"
                className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={submitIdentity}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "date" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-[color:var(--muted)]">
                Fecha
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  className="mt-1 block w-full border border-[color:var(--line)] px-2 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
              </label>
              <button
                type="button"
                onClick={submitDate}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "times" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-[color:var(--muted)]">
                  Inicio
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="mt-1 w-full border border-[color:var(--line)] px-2 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="text-xs text-[color:var(--muted)]">
                  Fin
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="mt-1 w-full border border-[color:var(--line)] px-2 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={submitTimes}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "location" ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitLocation(false);
                  }
                }}
                placeholder="Lugar (opcional)"
                className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => submitLocation(true)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => submitLocation(false)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "coach" ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitCoach(false);
                  }
                }}
                placeholder="Coach (opcional)"
                className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => submitCoach(true)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => submitCoach(false)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "beneficiaries" ? (
            <div className="flex max-h-[36svh] min-h-0 flex-col gap-2">
              {beneficiaries.length ? (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                  {beneficiaries.map((item) => {
                    const checked = createDraft.beneficiaryIds.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleBeneficiary(item.id)}
                          className={`w-full border px-3 py-2 text-left text-sm ${
                            checked
                              ? "border-[color:var(--accent)] bg-[#fff1f4]"
                              : "border-[color:var(--line)]"
                          }`}
                        >
                          {item.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  Sin beneficiarios cargados.
                </p>
              )}
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[color:var(--line)] pt-2">
                <button
                  type="button"
                  onClick={() => submitBeneficiaries(true)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={() => submitBeneficiaries(false)}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}

          {step === "beforeWho" ? (
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitBeforeWho();
                  }
                }}
                placeholder="Tu nombre"
                className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={submitBeforeWho}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "beforeFields" && BEFORE_FIELDS[beforeFieldIndex] ? (
            isBudgetField(BEFORE_FIELDS[beforeFieldIndex]) ? (
              <div className="flex max-h-[36svh] min-h-0 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <BudgetFieldInput
                    value={beforeFields[BEFORE_FIELDS[beforeFieldIndex].key]}
                    onChange={(value) =>
                      setBeforeFields((prev) => ({
                        ...prev,
                        [BEFORE_FIELDS[beforeFieldIndex].key]: value,
                      }))
                    }
                    rateDate={createDraft.date || defaultDate || todayIso()}
                    placeholder={BEFORE_FIELDS[beforeFieldIndex].help}
                    compact
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 border-t border-[color:var(--line)] pt-2">
                  <button
                    type="button"
                    onClick={() => submitBeforeField(true)}
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Saltar
                  </button>
                  <button
                    type="button"
                    onClick={() => submitBeforeField(false)}
                    disabled={
                      !parseBudgetField(
                        beforeFields[BEFORE_FIELDS[beforeFieldIndex].key],
                      ).lines.length
                    }
                    className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : isListField(BEFORE_FIELDS[beforeFieldIndex]) ? (
              <div className="flex max-h-[36svh] min-h-0 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <ListFieldInput
                    value={beforeFields[BEFORE_FIELDS[beforeFieldIndex].key]}
                    onChange={(value) =>
                      setBeforeFields((prev) => ({
                        ...prev,
                        [BEFORE_FIELDS[beforeFieldIndex].key]: value,
                      }))
                    }
                    placeholder={BEFORE_FIELDS[beforeFieldIndex].help}
                    compact
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 border-t border-[color:var(--line)] pt-2">
                  <button
                    type="button"
                    onClick={() => submitBeforeField(true)}
                    className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                  >
                    Saltar
                  </button>
                  <button
                    type="button"
                    onClick={() => submitBeforeField(false)}
                    disabled={
                      !parseListField(
                        beforeFields[BEFORE_FIELDS[beforeFieldIndex].key],
                      ).length
                    }
                    className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <textarea
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  rows={3}
                  placeholder="Escribe tu respuesta"
                  className="min-w-[12rem] w-full flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => submitBeforeField(true)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={() => submitBeforeField(false)}
                  disabled={!textInput.trim()}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )
          ) : null}

          {step === "pick" ? (
            editableSessions.length === 0 ? (
              <button
                type="button"
                onClick={() => chooseIntent("create")}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {t.schedule.assistantNewRequest}
              </button>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {editableSessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => pickSession(session)}
                      className="w-full border border-[color:var(--line)] px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
                    >
                      <span className="font-semibold text-[color:var(--ink)]">
                        {sessionLabel(session)}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {formatDate(session.date)} · {statusLabel(session.status)}
                        {session.startTime ? ` · ${session.startTime}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {step === "status" ? (
            <div className="flex flex-wrap gap-2">
              {SESSION_STATUSES.filter(
                (item) => item.value !== "pending_approval",
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => submitStatus(item.value)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold hover:border-[color:var(--accent)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {step === "notes" ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitNotes(false);
                  }
                }}
                placeholder="Notas (opcional)"
                className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => submitNotes(true)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => submitNotes(false)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
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
                onClick={() => void confirmSave()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Guardando..."
                  : intent === "create"
                    ? "Enviar propuesta"
                    : "Confirmar y guardar"}
              </button>
            </div>
          ) : null}

          {step === "pendingApproval" ? (
            <div className="flex flex-col gap-2">
              {canApprove ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void approveProposal()}
                  className="bg-[color:var(--accent)] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Aprobar y programar en calendario"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={printProposal}
                className="border border-[color:var(--line)] px-3 py-2.5 text-xs font-semibold"
              >
                Imprimir propuesta
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)]"
              >
                Cerrar (seguir pendiente)
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
