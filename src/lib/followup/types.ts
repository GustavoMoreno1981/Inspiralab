export type EvaluationPhase = "before" | "after";

export type PhaseStatus = "empty" | "in_progress" | "done";

export type FieldInputType = "text" | "score" | "url" | "list" | "budget";

/** Campos de planificación (se completan al programar en el cronograma). */
export type BeforeFields = {
  purposeCommon: string;
  purposeProject: string;
  logisticsTasks: string;
  logisticsResources: string;
  logisticsPlan: string;
  peopleBasic: string;
  peopleSupport: string;
  budgetMinimum: string;
  budgetOptional: string;
  dateRegular: string;
  runStepByStep: string;
};

/** Campos de evaluación post-taller (se completan cuando venció la fecha). */
export type AfterFields = {
  averageScore: string;
  objectivesMet: string;
  punctualArrival: string;
  materialsComplete: string;
  startedOnTime: string;
  participantIssues: string;
  improvements: string;
  messageAppropriate: string;
  photoRecordUrl: string;
};

export type EvaluationFields = BeforeFields & AfterFields;

export type WorkshopEvaluation = {
  id: string;
  sessionId: string;
  fields: EvaluationFields;
  phaseStatus: Record<EvaluationPhase, PhaseStatus>;
  evaluatedBy: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpBoard = {
  evaluations: WorkshopEvaluation[];
};

export type FieldDef = {
  key: keyof EvaluationFields;
  phase: EvaluationPhase;
  section: number;
  letter?: string;
  label: string;
  help: string;
  inputType?: FieldInputType;
};

export const EVALUATION_FIELDS: FieldDef[] = [
  {
    key: "purposeCommon",
    phase: "before",
    section: 1,
    letter: "A",
    label: "¿Cuál será el propósito del taller?",
    help: "Describe el propósito general de este taller o actividad.",
  },
  {
    key: "purposeProject",
    phase: "before",
    section: 1,
    letter: "B",
    label: "¿Cuál es el objetivo de este taller?",
    help: "Qué busca lograr específicamente esta sesión.",
  },
  {
    key: "logisticsTasks",
    phase: "before",
    section: 2,
    letter: "A",
    label: "Describir todas las tareas",
    help: "Agrega cada tarea por separado.",
    inputType: "list",
  },
  {
    key: "logisticsResources",
    phase: "before",
    section: 2,
    letter: "B",
    label: "¿Qué apoyo logístico se necesita?",
    help: "Agrega cada apoyo por separado.",
    inputType: "list",
  },
  {
    key: "logisticsPlan",
    phase: "before",
    section: 2,
    letter: "C",
    label: "Paso a paso de la logística",
    help: "Agrega cada paso por separado (tiempos, lugar, equipos y servicios).",
    inputType: "list",
  },
  {
    key: "peopleBasic",
    phase: "before",
    section: 3,
    letter: "A",
    label: "Personal de Inspiralab que asistirá",
    help: "Quiénes de Inspiralab asistirán al taller o actividad.",
  },
  {
    key: "peopleSupport",
    phase: "before",
    section: 3,
    letter: "B",
    label: "¿Quiénes participarán de forma virtual?",
    help: "Personas que se conectan o apoyan virtualmente.",
  },
  {
    key: "budgetMinimum",
    phase: "before",
    section: 4,
    letter: "A",
    label: "¿Qué presupuesto mínimo se necesita?",
    help: "Agrega cada gasto con su valor en pesos colombianos (COP).",
    inputType: "budget",
  },
  {
    key: "budgetOptional",
    phase: "before",
    section: 4,
    letter: "B",
    label: "Otros gastos adicionales o imprevistos",
    help: "Agrega gastos extras o imprevistos con valor en COP.",
    inputType: "budget",
  },
  {
    key: "dateRegular",
    phase: "before",
    section: 5,
    label: "¿Con cuánto tiempo de anticipación se está programando?",
    help: "Indica la anticipación con la que se programa esta actividad.",
  },
  {
    key: "runStepByStep",
    phase: "before",
    section: 6,
    label: "Paso a paso de la actividad",
    help: "Agrega cada paso desde la llegada hasta el cierre.",
    inputType: "list",
  },
  {
    key: "objectivesMet",
    phase: "after",
    section: 1,
    letter: "A",
    label: "¿Se cumplieron los objetivos del taller?",
    help: "Califica de 1 (no se cumplieron) a 5 (totalmente cumplidos).",
    inputType: "score",
  },
  {
    key: "punctualArrival",
    phase: "after",
    section: 1,
    letter: "B",
    label: "¿Se llegó puntual?",
    help: "Califica de 1 (muy tarde) a 5 (totalmente puntual).",
    inputType: "score",
  },
  {
    key: "materialsComplete",
    phase: "after",
    section: 1,
    letter: "C",
    label: "¿Los materiales estuvieron completos?",
    help: "Califica de 1 (faltó mucho) a 5 (todo completo).",
    inputType: "score",
  },
  {
    key: "startedOnTime",
    phase: "after",
    section: 1,
    letter: "D",
    label: "¿El taller inició a la hora indicada?",
    help: "Califica de 1 (muy retrasado) a 5 (a tiempo).",
    inputType: "score",
  },
  {
    key: "messageAppropriate",
    phase: "after",
    section: 1,
    letter: "E",
    label: "¿Se entregó el mensaje adecuado según la simbología?",
    help: "Califica de 1 (no adecuado) a 5 (muy adecuado).",
    inputType: "score",
  },
  {
    key: "participantIssues",
    phase: "after",
    section: 2,
    label: "¿Hubo algún inconveniente con los participantes?",
    help: "Describe cualquier problema con asistentes o grupo.",
  },
  {
    key: "improvements",
    phase: "after",
    section: 3,
    label: "¿Qué podemos mejorar?",
    help: "Sugerencias para próximas sesiones.",
  },
  {
    key: "photoRecordUrl",
    phase: "after",
    section: 4,
    label: "Enlace al registro fotográfico",
    help: "URL de Drive u otro repositorio con fotos del taller.",
    inputType: "url",
  },
];

export const PHASE_LABELS: Record<EvaluationPhase, string> = {
  before: "Antes (programación)",
  after: "Después (evaluación)",
};

export const SECTION_TITLES: Record<number, string> = {
  1: "Validación del propósito",
  2: "Estimar la logística",
  3: "Determinar cuántas personas se requieren",
  4: "Ubicar un presupuesto de gastos",
  5: "Anticipación de la programación",
  6: "Describir el paso a paso de la actividad",
};

export const AFTER_SECTION_TITLES: Record<number, string> = {
  1: "Calificación del taller",
  2: "Participantes e inconvenientes",
  3: "Mejoras",
  4: "Registro fotográfico",
};

export function sectionTitle(phase: EvaluationPhase, sectionNumber: number) {
  if (phase === "after") {
    return AFTER_SECTION_TITLES[sectionNumber] || `Sección ${sectionNumber}`;
  }
  return SECTION_TITLES[sectionNumber] || `Sección ${sectionNumber}`;
}

export function createId(prefix = "eval") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyFields(): EvaluationFields {
  return {
    purposeCommon: "",
    purposeProject: "",
    logisticsTasks: "",
    logisticsResources: "",
    logisticsPlan: "",
    peopleBasic: "",
    peopleSupport: "",
    budgetMinimum: "",
    budgetOptional: "",
    dateRegular: "",
    runStepByStep: "",
    averageScore: "",
    objectivesMet: "",
    punctualArrival: "",
    materialsComplete: "",
    startedOnTime: "",
    participantIssues: "",
    improvements: "",
    messageAppropriate: "",
    photoRecordUrl: "",
  };
}

export function emptyPhaseStatus(): Record<EvaluationPhase, PhaseStatus> {
  return { before: "empty", after: "empty" };
}

export function emptyBoard(): FollowUpBoard {
  return { evaluations: [] };
}

export function fieldsForPhase(phase: EvaluationPhase): FieldDef[] {
  return EVALUATION_FIELDS.filter((item) => item.phase === phase);
}

export function createEmptyEvaluation(sessionId: string): WorkshopEvaluation {
  const now = new Date().toISOString();
  return {
    id: createId(),
    sessionId,
    fields: emptyFields(),
    phaseStatus: emptyPhaseStatus(),
    evaluatedBy: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePhaseStatus(value: unknown): PhaseStatus {
  if (value === "in_progress" || value === "done" || value === "empty") return value;
  return "empty";
}

function normalizeFields(raw: unknown): EvaluationFields {
  const base = emptyFields();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as Array<keyof EvaluationFields>) {
    const value = source[key];
    base[key] = typeof value === "string" ? value : "";
  }

  // Migración desde modelo anterior
  if (!base.improvements && typeof source.resultsFormal === "string") {
    base.improvements = source.resultsFormal;
  }
  if (!base.objectivesMet && typeof source.resultsPreliminary === "string") {
    base.objectivesMet = source.resultsPreliminary;
  }
  if (!base.averageScore && source.scores && typeof source.scores === "object") {
    const scores = source.scores as Record<string, unknown>;
    const nums = Object.values(scores)
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      base.averageScore = String(Math.round(avg * 10) / 10);
    }
  }

  return base;
}

/** Migra filas antiguas (scores 1–5) o payload parcial al nuevo modelo. */
export function normalizeEvaluation(
  item: Partial<WorkshopEvaluation> & {
    scores?: unknown;
    highlights?: string;
    improvements?: string;
    completedAt?: string | null;
    content?: unknown;
  },
  fallbackId?: string,
): WorkshopEvaluation {
  const now = new Date().toISOString();
  const fromContent =
    item.content && typeof item.content === "object"
      ? (item.content as Partial<WorkshopEvaluation>)
      : null;

  const fields = normalizeFields(fromContent?.fields || item.fields);
  if (!fields.improvements && (item.highlights || item.improvements)) {
    const bits = [
      item.highlights ? `Lo que funcionó: ${item.highlights}` : "",
      item.improvements ? `Qué mejorar: ${item.improvements}` : "",
    ].filter(Boolean);
    if (bits.length) fields.improvements = bits.join("\n");
  }

  const phaseStatus = emptyPhaseStatus();
  const incomingStatus = fromContent?.phaseStatus || item.phaseStatus;
  if (incomingStatus && typeof incomingStatus === "object") {
    const ps = incomingStatus as Record<string, unknown>;
    phaseStatus.before = normalizePhaseStatus(ps.before);
    phaseStatus.after = normalizePhaseStatus(ps.after);
    if (!phaseStatus.after && ps.during === "done") {
      phaseStatus.after = "in_progress";
    }
  } else if (item.completedAt) {
    phaseStatus.after = "done";
  }

  for (const phase of ["before", "after"] as EvaluationPhase[]) {
    if (phaseStatus[phase] === "done") continue;
    const hasText = fieldsForPhase(phase).some((field) => fields[field.key].trim());
    if (hasText) phaseStatus[phase] = "in_progress";
  }

  return {
    id: item.id || fromContent?.id || fallbackId || createId(),
    sessionId: item.sessionId || fromContent?.sessionId || "",
    fields,
    phaseStatus,
    evaluatedBy: item.evaluatedBy || fromContent?.evaluatedBy || "",
    notes: item.notes || fromContent?.notes || "",
    createdAt: item.createdAt || fromContent?.createdAt || now,
    updatedAt: item.updatedAt || fromContent?.updatedAt || now,
  };
}

export function normalizeBoard(data: Partial<FollowUpBoard> | null): FollowUpBoard {
  return {
    evaluations: Array.isArray(data?.evaluations)
      ? data.evaluations.map((item, index) =>
          normalizeEvaluation(
            item as Partial<WorkshopEvaluation>,
            `eval-${index}`,
          ),
        )
      : [],
  };
}

export function isPhaseComplete(
  evaluation: WorkshopEvaluation | null | undefined,
  phase: EvaluationPhase,
) {
  return evaluation?.phaseStatus?.[phase] === "done";
}

/** before: siempre al programar; after: solo cuando la fecha del taller ya pasó. */
export function isPhaseUnlocked(
  sessionDate: string,
  todayIso: string,
  phase: EvaluationPhase,
) {
  if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return false;
  if (phase === "before") return true;
  return sessionDate < todayIso;
}

export function phaseProgress(
  evaluation: WorkshopEvaluation | null | undefined,
  phase: EvaluationPhase,
) {
  const fields = fieldsForPhase(phase);
  if (!fields.length) return { filled: 0, total: 0, percent: 0 };
  const filled = fields.filter((field) =>
    Boolean(evaluation?.fields?.[field.key]?.trim()),
  ).length;
  return {
    filled,
    total: fields.length,
    percent: Math.round((filled / fields.length) * 100),
  };
}

export function markPhaseStatus(
  evaluation: WorkshopEvaluation,
  phase: EvaluationPhase,
  status: PhaseStatus,
): WorkshopEvaluation {
  return {
    ...evaluation,
    phaseStatus: { ...evaluation.phaseStatus, [phase]: status },
    updatedAt: new Date().toISOString(),
  };
}
