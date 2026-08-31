export type SessionStatus =
  | "scheduled"
  | "done"
  | "cancelled"
  | "pending_approval"
  | "rejected";

export type SessionKind = "workshop" | "event";

export type WorkshopSession = {
  id: string;
  /** Taller del catálogo o evento libre. */
  kind: SessionKind;
  /** Nombre del evento (cuando kind === "event"). */
  eventName: string;
  /** Id del taller en site_content; vacío si es sesión libre. */
  workshopId: string;
  /** Índice de flor (0–2) o -1 si no aplica. */
  flowerIndex: number;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  location: string;
  coach: string;
  /** Beneficiarios de contabilidad vinculados a esta sesión. */
  beneficiaryIds: string[];
  status: SessionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleBeneficiary = {
  id: string;
  name: string;
  contact: string;
};

export type ScheduleBoard = {
  sessions: WorkshopSession[];
};

export const SESSION_STATUSES: { value: SessionStatus; label: string }[] = [
  { value: "scheduled", label: "Programado" },
  { value: "pending_approval", label: "Pendiente de aprobación" },
  { value: "rejected", label: "Rechazada" },
  { value: "done", label: "Realizado" },
  { value: "cancelled", label: "Cancelado" },
];

/** Sesiones visibles en el calendario (aprobadas o realizadas). */
export function isCalendarSession(status: SessionStatus) {
  return status === "scheduled" || status === "done";
}

export const SESSION_KINDS: { value: SessionKind; label: string }[] = [
  { value: "workshop", label: "Taller" },
  { value: "event", label: "Evento" },
];

export function normalizeKind(value: unknown): SessionKind {
  return value === "event" ? "event" : "workshop";
}

export function createId(prefix = "sess") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBoard(): ScheduleBoard {
  return { sessions: [] };
}

export function normalizeStatus(value: unknown): SessionStatus {
  if (
    value === "done" ||
    value === "cancelled" ||
    value === "scheduled" ||
    value === "pending_approval" ||
    value === "rejected"
  ) {
    return value;
  }
  return "scheduled";
}

export function normalizeSession(
  item: Partial<WorkshopSession>,
  fallbackId?: string,
): WorkshopSession {
  const now = new Date().toISOString();
  const kind = normalizeKind(item.kind);
  const eventName = (item.eventName || "").trim();
  const title =
    (item.title || "").trim() ||
    (kind === "event" ? eventName : "");
  return {
    id: item.id || fallbackId || createId(),
    kind,
    eventName,
    workshopId: kind === "workshop" ? item.workshopId || "" : "",
    flowerIndex:
      kind === "workshop" &&
      typeof item.flowerIndex === "number" &&
      Number.isFinite(item.flowerIndex)
        ? item.flowerIndex
        : -1,
    title,
    date: item.date || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    location: item.location || "",
    coach: item.coach || "",
    beneficiaryIds: Array.isArray(item.beneficiaryIds)
      ? item.beneficiaryIds.map(String).filter(Boolean)
      : [],
    status: normalizeStatus(item.status),
    notes: item.notes || "",
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

export function normalizeBoard(data: Partial<ScheduleBoard> | null): ScheduleBoard {
  return {
    sessions: Array.isArray(data?.sessions)
      ? data.sessions.map((item, index) =>
          normalizeSession(item as Partial<WorkshopSession>, `sess-${index}`),
        )
      : [],
  };
}

export type WorkshopOption = {
  id: string;
  title: string;
  flowerIndex: number;
  flowerName: string;
  coach: string;
  duration: string;
};
