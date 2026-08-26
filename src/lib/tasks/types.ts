export type TaskStatus =
  | "waiting"
  | "in_progress"
  | "paused"
  | "pending_review"
  | "done";

/** Permiso de acceso al panel (distinto del cargo `role`). */
export type AccessRole = "admin" | "member";

export type TeamMember = {
  id: string;
  name: string;
  /** Cargo / puesto (texto libre). */
  role: string;
  email: string;
  photo: string;
  /** Indicativo internacional, ej. +57 */
  phoneCountryCode: string;
  /** Número local sin indicativo (solo dígitos). */
  phone: string;
  createdAt: string;
  /** Permiso de módulos en el admin. */
  accessRole: AccessRole;
  /** Puede iniciar sesión con email + contraseña. */
  canLogin: boolean;
  /** Tiene contraseña configurada (nunca se envía el hash). */
  hasPassword: boolean;
  /** Solo escritura: nueva contraseña al guardar (no se persiste en claro). */
  newPassword?: string;
};

/** Indicativos frecuentes para WhatsApp / contacto. */
export const PHONE_COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+57", label: "Colombia (+57)" },
  { code: "+1", label: "EE.UU. / Canadá (+1)" },
  { code: "+52", label: "México (+52)" },
  { code: "+34", label: "España (+34)" },
  { code: "+51", label: "Perú (+51)" },
  { code: "+56", label: "Chile (+56)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+58", label: "Venezuela (+58)" },
  { code: "+593", label: "Ecuador (+593)" },
  { code: "+507", label: "Panamá (+507)" },
  { code: "+506", label: "Costa Rica (+506)" },
  { code: "+502", label: "Guatemala (+502)" },
  { code: "+55", label: "Brasil (+55)" },
];

/** Número E.164 sin + (para wa.me). */
export function memberWhatsAppDigits(member: Pick<TeamMember, "phoneCountryCode" | "phone">) {
  const code = (member.phoneCountryCode || "").replace(/\D/g, "");
  const phone = (member.phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!code || !phone) return "";
  return `${code}${phone}`;
}

export function formatMemberPhone(member: Pick<TeamMember, "phoneCountryCode" | "phone">) {
  const phone = (member.phone || "").replace(/\D/g, "");
  if (!phone) return "";
  const code = member.phoneCountryCode || "+57";
  return `${code} ${phone}`;
}

/** Paso a paso dentro de una tarea. */
export type Subtask = {
  id: string;
  title: string;
  /** Sincronizado con status === "done". */
  done: boolean;
  status: TaskStatus;
  url: string;
};

/** Algo concreto que hay que hacer dentro de una actividad. */
export type Task = {
  id: string;
  activityId: string;
  title: string;
  status: TaskStatus;
  done: boolean;
  url: string;
  subtasks: Subtask[];
};

export type TaskNote = {
  id: string;
  text: string;
  /** Fecha/hora en que se escribió la nota (ISO). */
  createdAt: string;
};

/** Respuesta a una solicitud de revisión (como opciones de encuesta en WhatsApp). */
export type ReviewResponseValue = "yes" | "no" | "pending" | "call";

/** Mensaje de revisión enviado al equipo (historial + WhatsApp). */
export type ReviewMessage = {
  id: string;
  recipientIds: string[];
  recipientNames: string[];
  body: string;
  url: string;
  fullText: string;
  createdAt: string;
  channel: "whatsapp" | "copied";
  response?: ReviewResponseValue | null;
  responseAt?: string;
  responseBy?: string;
};

/** Objetivo / proyecto grande (antes era la "tarea" de nivel superior). */
export type Activity = {
  id: string;
  title: string;
  date: string;
  finishedDate: string;
  processUrl: string;
  deliverableUrl: string;
  status: TaskStatus;
  assigneeIds: string[];
  tasks: Task[];
  notes: TaskNote[];
  reviewMessages: ReviewMessage[];
  createdAt: string;
  updatedAt: string;
};

export type TasksBoard = {
  members: TeamMember[];
  activities: Activity[];
  /**
   * Banco de ideas / propuestas de actividades pendientes de crear.
   * Útil para listar todo lo que hay que montar como actividad formal.
   */
  bank: TaskBankItem[];
};

/** Idea o propuesta pendiente de convertirse en actividad. */
export type TaskBankItem = {
  id: string;
  title: string;
  notes: string;
  /** Integrante dueño del ítem del banco (quien se seleccionó). */
  ownerId: string;
  suggestedAssigneeIds: string[];
  convertedActivityId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "waiting", label: "En espera" },
  { value: "in_progress", label: "En proceso" },
  { value: "paused", label: "En pausa" },
  { value: "pending_review", label: "Pendiente por revisión" },
  { value: "done", label: "Terminada" },
];

/** Colores del círculo y etiqueta según estado. */
export const TASK_STATUS_COLORS: Record<
  TaskStatus,
  { bg: string; text: string; label: string }
> = {
  waiting: { bg: "#94a3b8", text: "#fff", label: "En espera" },
  in_progress: { bg: "#e00d45", text: "#fff", label: "En proceso" },
  paused: { bg: "#2563eb", text: "#fff", label: "En pausa" },
  pending_review: { bg: "#ca8a04", text: "#fff", label: "Pendiente por revisión" },
  done: { bg: "#16a34a", text: "#fff", label: "Terminada" },
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeItemStatus(status: unknown, done?: boolean): TaskStatus {
  const value = typeof status === "string" ? status : "";
  if (TASK_STATUSES.some((item) => item.value === value)) {
    return value as TaskStatus;
  }
  return done ? "done" : "waiting";
}

/** @deprecated Usar normalizeItemStatus */
export const normalizeSubtaskStatus = normalizeItemStatus;

export function withDoneStatus(status: TaskStatus): Pick<Subtask, "status" | "done"> {
  return {
    status,
    done: status === "done",
  };
}

export function isItemDone(item: { status: TaskStatus; done?: boolean }): boolean {
  return item.status === "done" || Boolean(item.done);
}

export function isSubtaskDone(subtask: Subtask): boolean {
  return isItemDone(subtask);
}

export function isTaskDone(task: Task): boolean {
  return isItemDone(task);
}

function statusHeuristic(status: TaskStatus): number {
  switch (status) {
    case "waiting":
      return 0;
    case "in_progress":
    case "paused":
      return 40;
    case "pending_review":
      return 80;
    case "done":
      return 100;
    default:
      return 0;
  }
}

export function getTaskProgress(task: Task): number {
  if (!task.subtasks.length) return statusHeuristic(task.status);
  const done = task.subtasks.filter(isSubtaskDone).length;
  return Math.round((done / task.subtasks.length) * 100);
}

export function getActivityProgress(activity: Activity): number {
  if (!activity.tasks.length) return statusHeuristic(activity.status);
  const total = activity.tasks.reduce((sum, task) => sum + getTaskProgress(task), 0);
  return Math.round(total / activity.tasks.length);
}

export function areAllSubtasksDone(task: Task): boolean {
  if (!task.subtasks.length) return isTaskDone(task);
  return task.subtasks.every(isSubtaskDone);
}

export function areAllTasksDone(activity: Activity): boolean {
  if (!activity.tasks.length) return activity.status === "done";
  return activity.tasks.every(isTaskDone);
}

function deriveStatusFromItems(
  items: { status: TaskStatus; done?: boolean }[],
): TaskStatus | null {
  if (!items.length) return null;
  if (items.every(isItemDone)) return "done";
  if (items.some((item) => item.status === "pending_review")) return "pending_review";
  if (items.some((item) => item.status === "in_progress")) return "in_progress";
  if (items.some((item) => item.status === "paused")) return "paused";
  return "waiting";
}

export function deriveTaskStatusFromSubtasks(subtasks: Subtask[]): TaskStatus | null {
  return deriveStatusFromItems(subtasks);
}

export function deriveActivityStatusFromTasks(tasks: Task[]): TaskStatus | null {
  return deriveStatusFromItems(tasks);
}

export function emptyBoard(): TasksBoard {
  return { members: [], activities: [], bank: [] };
}
