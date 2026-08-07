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

export type Subtask = {
  id: string;
  title: string;
  /** Sincronizado con status === "done" (compatibilidad / progreso). */
  done: boolean;
  status: TaskStatus;
  url: string;
};

export type Task = {
  id: string;
  title: string;
  date: string;
  finishedDate: string;
  processUrl: string;
  deliverableUrl: string;
  status: TaskStatus;
  assigneeIds: string[];
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
};

export type TasksBoard = {
  members: TeamMember[];
  tasks: Task[];
};

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "waiting", label: "En espera" },
  { value: "in_progress", label: "En proceso" },
  { value: "paused", label: "En pausa" },
  { value: "pending_review", label: "Pendiente por revisión" },
  { value: "done", label: "Terminada" },
];

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeSubtaskStatus(
  status: unknown,
  done?: boolean,
): TaskStatus {
  const value = typeof status === "string" ? status : "";
  if (TASK_STATUSES.some((item) => item.value === value)) {
    return value as TaskStatus;
  }
  return done ? "done" : "waiting";
}

export function withSubtaskStatus(
  subtask: Partial<Subtask> & { title?: string },
  status: TaskStatus,
): Pick<Subtask, "status" | "done"> {
  return {
    status,
    done: status === "done",
  };
}

export function isSubtaskDone(subtask: Subtask): boolean {
  return subtask.status === "done" || subtask.done;
}

export function getTaskProgress(task: Task): number {
  // Sin subtareas: el avance lo marca el estado general de la tarea
  if (!task.subtasks.length) {
    switch (task.status) {
      case "waiting":
        return 0;
      case "in_progress":
        return 40;
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
  const done = task.subtasks.filter(isSubtaskDone).length;
  return Math.round((done / task.subtasks.length) * 100);
}

export function areAllSubtasksDone(task: Task): boolean {
  // Sin subtareas: la entrega de la tarea no depende de nada más
  if (!task.subtasks.length) return true;
  return task.subtasks.every(isSubtaskDone);
}

export function emptyBoard(): TasksBoard {
  return { members: [], tasks: [] };
}
