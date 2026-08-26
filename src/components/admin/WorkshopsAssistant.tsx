"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkshopLevel } from "@/lib/content/store";

type Step =
  | "flower"
  | "title"
  | "text"
  | "duration"
  | "level"
  | "coach"
  | "materials"
  | "steps"
  | "confirm";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type WorkshopAssistantDraft = {
  flowerIndex: number;
  titleEs: string;
  titleEn: string;
  textEs: string;
  textEn: string;
  duration: string;
  level: WorkshopLevel;
  coach: string;
  materials: string[];
  steps: Array<{ title: string; simbologia: string }>;
};

type Props = {
  open: boolean;
  flowerLabels: string[];
  defaultFlowerIndex?: number;
  saving?: boolean;
  onClose: () => void;
  onCreate: (draft: WorkshopAssistantDraft) => Promise<boolean> | boolean;
};

function msg(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
  };
}

function emptyDraft(flowerIndex = 0): WorkshopAssistantDraft {
  return {
    flowerIndex,
    titleEs: "",
    titleEn: "",
    textEs: "",
    textEn: "",
    duration: "",
    level: 1,
    coach: "",
    materials: [],
    steps: [],
  };
}

const LEVEL_OPTIONS: { value: WorkshopLevel; label: string }[] = [
  { value: 1, label: "Nivel 1 · Básico" },
  { value: 2, label: "Nivel 2 · Intermedio" },
  { value: 3, label: "Nivel 3 · Avanzado" },
];

const TOTAL_STEPS = 9;

export function WorkshopsAssistant({
  open,
  flowerLabels,
  defaultFlowerIndex = 0,
  saving = false,
  onClose,
  onCreate,
}: Props) {
  const [step, setStep] = useState<Step>("flower");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<WorkshopAssistantDraft>(() =>
    emptyDraft(defaultFlowerIndex),
  );
  const [textInput, setTextInput] = useState("");
  const [simbologiaInput, setSimbologiaInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const stepNumber = useMemo(() => {
    const order: Step[] = [
      "flower",
      "title",
      "text",
      "duration",
      "level",
      "coach",
      "materials",
      "steps",
      "confirm",
    ];
    return order.indexOf(step) + 1;
  }, [step]);

  useEffect(() => {
    if (!open) return;
    setStep("flower");
    setDraft(emptyDraft(defaultFlowerIndex));
    setTextInput("");
    setSimbologiaInput("");
    setMessages([
      msg(
        "assistant",
        "Hola. Te guío para crear un taller. ¿En qué flor lo publicamos?",
      ),
    ]);
  }, [open, defaultFlowerIndex]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, msg(role, text)]);
  }

  function chooseFlower(index: number) {
    setDraft((prev) => ({ ...prev, flowerIndex: index }));
    push("user", flowerLabels[index] || `Flor ${index + 1}`);
    setStep("title");
    push("assistant", "¿Cómo se llama el taller?");
    setTextInput("");
  }

  function submitTitle() {
    const title = textInput.trim();
    if (!title) return;
    setDraft((prev) => ({
      ...prev,
      titleEs: title,
      titleEn: title,
    }));
    push("user", title);
    setTextInput("");
    setStep("text");
    push("assistant", "Escribe una descripción corta del taller.");
  }

  function submitText() {
    const text = textInput.trim();
    if (!text) return;
    setDraft((prev) => ({
      ...prev,
      textEs: text,
      textEn: text,
    }));
    push("user", text);
    setTextInput("");
    setStep("duration");
    push("assistant", "¿Cuánto dura? (ej. 2 horas)");
  }

  function submitDuration() {
    const duration = textInput.trim();
    if (!duration) return;
    setDraft((prev) => ({ ...prev, duration }));
    push("user", duration);
    setTextInput("");
    setStep("level");
    push("assistant", "¿Qué nivel tiene el taller?");
  }

  function chooseLevel(level: WorkshopLevel) {
    const label =
      LEVEL_OPTIONS.find((item) => item.value === level)?.label || `Nivel ${level}`;
    setDraft((prev) => ({ ...prev, level }));
    push("user", label);
    setStep("coach");
    push("assistant", "¿Quién es el coach? Puedes escribirlo o saltar.");
    setTextInput("");
  }

  function submitCoach(skip = false) {
    const coach = skip ? "" : textInput.trim();
    setDraft((prev) => ({ ...prev, coach }));
    push("user", coach || "Sin coach");
    setTextInput("");
    setStep("materials");
    push(
      "assistant",
      "Agrega materiales uno por uno. Cuando termines, pulsa Continuar.",
    );
  }

  function addMaterial() {
    const value = textInput.trim();
    if (!value) return;
    setDraft((prev) => ({
      ...prev,
      materials: [...prev.materials, value],
    }));
    push("user", `Material: ${value}`);
    setTextInput("");
    push("assistant", "¿Otro material? Escríbelo o pulsa Continuar.");
  }

  function continueFromMaterials() {
    setStep("steps");
    push(
      "assistant",
      "Ahora el paso a paso (opcional). Escribe el paso y su simbología. Luego Continuar.",
    );
    setTextInput("");
    setSimbologiaInput("");
  }

  function addStep() {
    const title = textInput.trim();
    if (!title) return;
    const simbologia = simbologiaInput.trim();
    setDraft((prev) => ({
      ...prev,
      steps: [...prev.steps, { title, simbologia }],
    }));
    push(
      "user",
      simbologia ? `Paso: ${title} · Simbología: ${simbologia}` : `Paso: ${title}`,
    );
    setTextInput("");
    setSimbologiaInput("");
    push("assistant", "¿Otro paso? Complétalo o pulsa Continuar.");
  }

  function continueFromSteps() {
    setStep("confirm");
    push("assistant", "Listo. Revisa el resumen y confirma para crear el taller.");
  }

  async function confirmSave() {
    if (!draft.titleEs.trim()) return;
    const ok = await onCreate({
      ...draft,
      titleEs: draft.titleEs.trim(),
      titleEn: draft.titleEn.trim() || draft.titleEs.trim(),
      textEs: draft.textEs.trim(),
      textEn: draft.textEn.trim() || draft.textEs.trim(),
      duration: draft.duration.trim(),
      coach: draft.coach.trim(),
      materials: draft.materials.map((item) => item.trim()).filter(Boolean),
      steps: draft.steps
        .map((stepItem) => ({
          title: stepItem.title.trim(),
          simbologia: stepItem.simbologia.trim(),
        }))
        .filter((stepItem) => stepItem.title),
    });
    if (ok) onClose();
  }

  if (!open) return null;

  const progressPct = Math.round((stepNumber / TOTAL_STEPS) * 100);
  const flowerName = flowerLabels[draft.flowerIndex] || `Flor ${draft.flowerIndex + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]">
              Asistente guiado
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              Paso {stepNumber} de {TOTAL_STEPS} · Sin IA, solo preguntas
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

          {step === "confirm" ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="text-xs text-[color:var(--muted)]">{flowerName}</p>
              <p className="mt-1 font-semibold text-[color:var(--ink)]">{draft.titleEs}</p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">{draft.textEs}</p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                {draft.duration || "—"} · Nivel {draft.level}
                {draft.coach ? ` · Coach: ${draft.coach}` : ""}
              </p>
              {draft.materials.length ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Materiales: {draft.materials.join(", ")}
                </p>
              ) : null}
              {draft.steps.length ? (
                <ul className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                  {draft.steps.map((stepItem, index) => (
                    <li key={`${stepItem.title}-${index}`}>
                      {index + 1}. {stepItem.title}
                      {stepItem.simbologia ? ` · ${stepItem.simbologia}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-[color:var(--line)] bg-white px-4 py-3">
          {step === "flower" ? (
            <div className="flex flex-wrap gap-2">
              {flowerLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => chooseFlower(index)}
                  className={`px-3 py-2 text-xs font-semibold ${
                    index === defaultFlowerIndex
                      ? "bg-[color:var(--accent)] text-white"
                      : "border border-[color:var(--line)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {step === "title" || step === "text" || step === "duration" ? (
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (step === "title") submitTitle();
                    else if (step === "text") submitText();
                    else submitDuration();
                  }
                }}
                placeholder={
                  step === "title"
                    ? "Nombre del taller"
                    : step === "text"
                      ? "Descripción"
                      : "Duración"
                }
                className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (step === "title") submitTitle();
                  else if (step === "text") submitText();
                  else submitDuration();
                }}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {step === "level" ? (
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseLevel(item.value)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold hover:border-[color:var(--accent)]"
                >
                  {item.label}
                </button>
              ))}
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
                placeholder="Nombre del coach"
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

          {step === "materials" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addMaterial();
                    }
                  }}
                  placeholder="Ej. Cartulina, marcadores…"
                  className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="button"
                  onClick={addMaterial}
                  disabled={!textInput.trim()}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
              <button
                type="button"
                onClick={continueFromMaterials}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                Continuar
              </button>
            </div>
          ) : null}

          {step === "steps" ? (
            <div className="space-y-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder="Descripción del paso"
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <textarea
                value={simbologiaInput}
                onChange={(event) => setSimbologiaInput(event.target.value)}
                rows={2}
                placeholder="Simbología (solo exportación)"
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addStep}
                  disabled={!textInput.trim()}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  Agregar paso
                </button>
                <button
                  type="button"
                  onClick={continueFromSteps}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                >
                  Continuar
                </button>
              </div>
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
                {saving ? "Creando..." : "Confirmar y crear"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
