import { promises as fs } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  createId,
  emptyBoard,
  normalizeItemStatus,
  type AccessRole,
  type Activity,
  type ReviewMessage,
  type Subtask,
  type Task,
  type TaskBankItem,
  type TaskNote,
  type TasksBoard,
  type TeamMember,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");

type ActivityRow = {
  id: string;
  title: string;
  date: string;
  finished_date: string | null;
  process_url: string;
  deliverable_url: string;
  status: Activity["status"];
  assignee_ids: string[] | null;
  notes?: unknown;
  review_messages?: unknown;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  activity_id: string;
  title: string;
  status?: string | null;
  done: boolean;
  url?: string | null;
  position: number;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  status?: string | null;
  url?: string | null;
  position: number;
};

type MemberRow = {
  id: string;
  name: string;
  role: string;
  email: string;
  photo: string | null;
  phone_country_code?: string | null;
  phone?: string | null;
  created_at: string;
  access_role?: string | null;
  can_login?: boolean | null;
  password_hash?: string | null;
};

type StoredMember = TeamMember & { passwordHash: string };

type StoredBoard = {
  members: StoredMember[];
  activities: Activity[];
  bank: TaskBankItem[];
};

function normalizeAccessRole(value: unknown): AccessRole {
  return value === "admin" ? "admin" : "member";
}

function normalizePhoneCountryCode(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "+57";
  return raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
}

function normalizePhoneNumber(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function toPublicMember(member: StoredMember): TeamMember {
  return {
    id: member.id,
    name: member.name,
    role: member.role || "",
    email: member.email || "",
    photo: member.photo || "",
    phoneCountryCode: normalizePhoneCountryCode(member.phoneCountryCode),
    phone: normalizePhoneNumber(member.phone),
    createdAt: member.createdAt,
    accessRole: normalizeAccessRole(member.accessRole),
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.passwordHash),
  };
}

function toPublicBoard(board: StoredBoard): TasksBoard {
  return {
    members: board.members.map(toPublicMember),
    activities: board.activities,
    bank: board.bank || [],
  };
}

function normalizeStoredMember(
  member: Partial<TeamMember> & { passwordHash?: string; id: string },
): StoredMember {
  return {
    id: member.id,
    name: member.name || "",
    role: member.role || "",
    email: (member.email || "").trim().toLowerCase(),
    photo: member.photo || "",
    phoneCountryCode: normalizePhoneCountryCode(member.phoneCountryCode),
    phone: normalizePhoneNumber(member.phone),
    createdAt: member.createdAt || new Date().toISOString(),
    accessRole: normalizeAccessRole(member.accessRole),
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.passwordHash),
    passwordHash: member.passwordHash || "",
  };
}

function normalizeNotes(notes: unknown): TaskNote[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => {
      if (!note || typeof note !== "object") return null;
      const item = note as Partial<TaskNote>;
      if (!item.id || typeof item.text !== "string") return null;
      return {
        id: String(item.id),
        text: item.text,
        createdAt: item.createdAt || new Date().toISOString(),
      };
    })
    .filter((note): note is TaskNote => Boolean(note));
}

function normalizeReviewMessages(messages: unknown): ReviewMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") return null;
      const item = message as Partial<ReviewMessage>;
      if (!item.id || typeof item.fullText !== "string") return null;
      return {
        id: String(item.id),
        recipientIds: Array.isArray(item.recipientIds)
          ? item.recipientIds.map(String)
          : [],
        recipientNames: Array.isArray(item.recipientNames)
          ? item.recipientNames.map(String)
          : [],
        body: typeof item.body === "string" ? item.body : "",
        url: typeof item.url === "string" ? item.url : "",
        fullText: item.fullText,
        createdAt: item.createdAt || new Date().toISOString(),
        channel: item.channel === "copied" ? "copied" : "whatsapp",
      };
    })
    .filter((message): message is ReviewMessage => Boolean(message));
}

function normalizeSubtask(subtask: Partial<Subtask> & { id: string }): Subtask {
  const status = normalizeItemStatus(subtask.status, subtask.done);
  return {
    id: subtask.id,
    title: subtask.title || "",
    status,
    done: status === "done",
    url: subtask.url || "",
  };
}

function normalizeTask(task: Partial<Task> & { id: string; activityId: string }): Task {
  const status = normalizeItemStatus(task.status, task.done);
  return {
    id: task.id,
    activityId: task.activityId,
    title: task.title || "",
    status,
    done: status === "done",
    url: task.url || "",
    subtasks: (task.subtasks || []).map((item) =>
      normalizeSubtask({ ...item, id: item.id || createId("sub") }),
    ),
  };
}

function normalizeBank(items: unknown): TaskBankItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Partial<TaskBankItem>;
      if (!item.id) return null;
      return {
        id: String(item.id),
        title: typeof item.title === "string" ? item.title : "",
        notes: typeof item.notes === "string" ? item.notes : "",
        ownerId: typeof item.ownerId === "string" ? item.ownerId : "",
        suggestedAssigneeIds: Array.isArray(item.suggestedAssigneeIds)
          ? item.suggestedAssigneeIds.map(String)
          : [],
        convertedActivityId:
          typeof item.convertedActivityId === "string" ? item.convertedActivityId : null,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
      };
    })
    .filter((item): item is TaskBankItem => Boolean(item));
}

function normalizeActivities(activities: Activity[]): Activity[] {
  return (activities || []).map((activity) => ({
    ...activity,
    finishedDate: activity.finishedDate || "",
    processUrl: activity.processUrl || "",
    deliverableUrl: activity.deliverableUrl || "",
    assigneeIds: activity.assigneeIds || [],
    notes: normalizeNotes(activity.notes),
    reviewMessages: normalizeReviewMessages(activity.reviewMessages),
    tasks: (activity.tasks || []).map((task) =>
      normalizeTask({
        ...task,
        id: task.id,
        activityId: task.activityId || activity.id,
      }),
    ),
  }));
}

/** Migra JSON antiguo { tasks: [{ subtasks }] } → { activities }. */
function migrateLegacyBoard(data: Record<string, unknown>): StoredBoard {
  const bank = normalizeBank(data.bank);

  if (Array.isArray(data.activities)) {
    return {
      members: Array.isArray(data.members)
        ? (data.members as StoredMember[]).map((member) =>
            normalizeStoredMember({
              ...member,
              id: member.id,
              passwordHash:
                member.passwordHash ||
                (member as { password_hash?: string }).password_hash ||
                "",
            }),
          )
        : [],
      activities: normalizeActivities(data.activities as Activity[]),
      bank,
    };
  }

  const legacyTasks = Array.isArray(data.tasks) ? (data.tasks as Array<Record<string, unknown>>) : [];
  const activities: Activity[] = legacyTasks.map((legacy) => {
    const activityId = String(legacy.id || createId("act"));
    const legacySubs = Array.isArray(legacy.subtasks)
      ? (legacy.subtasks as Array<Record<string, unknown>>)
      : [];
    const status = normalizeItemStatus(legacy.status);
    const tasks: Task[] =
      legacySubs.length > 0
        ? legacySubs.map((sub, index) =>
            normalizeTask({
              id: String(sub.id || `${activityId}-task-${index}`),
              activityId,
              title: String(sub.title || ""),
              status: normalizeItemStatus(sub.status, Boolean(sub.done)),
              done: Boolean(sub.done),
              url: String(sub.url || ""),
              subtasks: [],
            }),
          )
        : [
            normalizeTask({
              id: `${activityId}-task`,
              activityId,
              title: String(legacy.title || ""),
              status,
              done: status === "done",
              url: "",
              subtasks: [],
            }),
          ];

    return {
      id: activityId,
      title: String(legacy.title || ""),
      date: String(legacy.date || ""),
      finishedDate: String(legacy.finishedDate || ""),
      processUrl: String(legacy.processUrl || ""),
      deliverableUrl: String(legacy.deliverableUrl || ""),
      status,
      assigneeIds: Array.isArray(legacy.assigneeIds)
        ? legacy.assigneeIds.map(String)
        : [],
      notes: normalizeNotes(legacy.notes),
      reviewMessages: normalizeReviewMessages(legacy.reviewMessages),
      tasks,
      createdAt: String(legacy.createdAt || new Date().toISOString()),
      updatedAt: String(legacy.updatedAt || new Date().toISOString()),
    };
  });

  return {
    members: Array.isArray(data.members)
      ? (data.members as StoredMember[]).map((member) =>
          normalizeStoredMember({
            ...member,
            id: member.id,
            passwordHash:
              member.passwordHash ||
              (member as { password_hash?: string }).password_hash ||
              "",
          }),
        )
      : [],
    activities: normalizeActivities(activities),
    bank,
  };
}

function normalizeStoredBoard(data: unknown): StoredBoard {
  if (!data || typeof data !== "object") {
    return { members: [], activities: [], bank: [] };
  }
  return migrateLegacyBoard(data as Record<string, unknown>);
}

async function readTasksLocalRaw(): Promise<StoredBoard> {
  try {
    const raw = await fs.readFile(TASKS_PATH, "utf8");
    return normalizeStoredBoard(JSON.parse(raw));
  } catch {
    return { members: [], activities: [], bank: [] };
  }
}

async function writeTasksLocalRaw(board: StoredBoard) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TASKS_PATH, JSON.stringify(board, null, 2), "utf8");
}

async function readTasksSupabaseRaw(): Promise<StoredBoard> {
  const supabase = getSupabaseAdmin();

  // Preferir esquema nuevo (activities). Si falla, intentar legado.
  const activitiesProbe = await supabase.from("activities").select("id").limit(1);
  if (activitiesProbe.error) {
    return readLegacyTasksSupabaseRaw();
  }

  const [membersRes, activitiesRes, tasksRes, subtasksRes, bankRes] = await Promise.all([
    supabase.from("team_members").select("*").order("created_at", { ascending: true }),
    supabase.from("activities").select("*").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").order("position", { ascending: true }),
    supabase.from("subtasks").select("*").order("position", { ascending: true }),
    supabase.from("task_bank").select("*").order("created_at", { ascending: false }),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (subtasksRes.error) throw subtasksRes.error;

  const members: StoredMember[] = ((membersRes.data || []) as MemberRow[]).map((row) =>
    normalizeStoredMember({
      id: row.id,
      name: row.name,
      role: row.role || "",
      email: row.email || "",
      photo: row.photo || "",
      phoneCountryCode: row.phone_country_code || "+57",
      phone: row.phone || "",
      createdAt: row.created_at,
      accessRole: normalizeAccessRole(row.access_role),
      canLogin: Boolean(row.can_login),
      passwordHash: row.password_hash || "",
    }),
  );

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const row of (subtasksRes.data || []) as SubtaskRow[]) {
    const list = subtasksByTask.get(row.task_id) || [];
    list.push(
      normalizeSubtask({
        id: row.id,
        title: row.title,
        status: normalizeItemStatus(row.status, row.done),
        done: row.done,
        url: row.url || "",
      }),
    );
    subtasksByTask.set(row.task_id, list);
  }

  const tasksByActivity = new Map<string, Task[]>();
  for (const row of (tasksRes.data || []) as TaskRow[]) {
    // Esquema nuevo: tasks tienen activity_id. Si no, es legado.
    if (!row.activity_id) continue;
    const list = tasksByActivity.get(row.activity_id) || [];
    list.push(
      normalizeTask({
        id: row.id,
        activityId: row.activity_id,
        title: row.title,
        status: normalizeItemStatus(row.status, row.done),
        done: row.done,
        url: row.url || "",
        subtasks: subtasksByTask.get(row.id) || [],
      }),
    );
    tasksByActivity.set(row.activity_id, list);
  }

  const activities: Activity[] = ((activitiesRes.data || []) as ActivityRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    finishedDate: row.finished_date || "",
    processUrl: row.process_url || "",
    deliverableUrl: row.deliverable_url || "",
    status: row.status,
    assigneeIds: row.assignee_ids || [],
    notes: normalizeNotes(row.notes),
    reviewMessages: normalizeReviewMessages(row.review_messages),
    tasks: tasksByActivity.get(row.id) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const bank = bankRes.error
    ? []
    : normalizeBank(
        ((bankRes.data || []) as Array<Record<string, unknown>>).map((row) => ({
          id: row.id,
          title: row.title,
          notes: row.notes,
          ownerId: row.owner_id,
          suggestedAssigneeIds: row.suggested_assignee_ids,
          convertedActivityId: row.converted_activity_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      );

  return { members, activities: normalizeActivities(activities), bank };
}

/** Lectura del esquema antiguo y conversión en memoria. */
async function readLegacyTasksSupabaseRaw(): Promise<StoredBoard> {
  const supabase = getSupabaseAdmin();
  const [membersRes, tasksRes, subtasksRes] = await Promise.all([
    supabase.from("team_members").select("*").order("created_at", { ascending: true }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("subtasks").select("*").order("position", { ascending: true }),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (subtasksRes.error) throw subtasksRes.error;

  const members: StoredMember[] = ((membersRes.data || []) as MemberRow[]).map((row) =>
    normalizeStoredMember({
      id: row.id,
      name: row.name,
      role: row.role || "",
      email: row.email || "",
      photo: row.photo || "",
      phoneCountryCode: row.phone_country_code || "+57",
      phone: row.phone || "",
      createdAt: row.created_at,
      accessRole: normalizeAccessRole(row.access_role),
      canLogin: Boolean(row.can_login),
      passwordHash: row.password_hash || "",
    }),
  );

  type LegacyTaskRow = ActivityRow;
  type LegacySubRow = {
    id: string;
    task_id: string;
    title: string;
    done: boolean;
    status?: string | null;
    url?: string | null;
    position: number;
  };

  const subsByOldTask = new Map<string, LegacySubRow[]>();
  for (const row of (subtasksRes.data || []) as LegacySubRow[]) {
    const list = subsByOldTask.get(row.task_id) || [];
    list.push(row);
    subsByOldTask.set(row.task_id, list);
  }

  const activities: Activity[] = ((tasksRes.data || []) as LegacyTaskRow[]).map((row) => {
    const legacySubs = subsByOldTask.get(row.id) || [];
    const status = normalizeItemStatus(row.status);
    const tasks: Task[] =
      legacySubs.length > 0
        ? legacySubs.map((sub) =>
            normalizeTask({
              id: sub.id,
              activityId: row.id,
              title: sub.title,
              status: normalizeItemStatus(sub.status, sub.done),
              done: sub.done,
              url: sub.url || "",
              subtasks: [],
            }),
          )
        : [
            normalizeTask({
              id: `${row.id}-task`,
              activityId: row.id,
              title: row.title,
              status,
              done: status === "done",
              url: "",
              subtasks: [],
            }),
          ];

    return {
      id: row.id,
      title: row.title,
      date: row.date,
      finishedDate: row.finished_date || "",
      processUrl: row.process_url || "",
      deliverableUrl: row.deliverable_url || "",
      status,
      assigneeIds: row.assignee_ids || [],
      notes: normalizeNotes(row.notes),
      reviewMessages: normalizeReviewMessages(row.review_messages),
      tasks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return { members, activities: normalizeActivities(activities), bank: [] };
}

async function writeTasksSupabaseRaw(board: StoredBoard) {
  const supabase = getSupabaseAdmin();

  const { error: deleteSubtasksError } = await supabase
    .from("subtasks")
    .delete()
    .neq("id", "__never__");
  if (deleteSubtasksError) throw deleteSubtasksError;

  const { error: deleteTasksError } = await supabase.from("tasks").delete().neq("id", "__never__");
  if (deleteTasksError) throw deleteTasksError;

  const { error: deleteActivitiesError } = await supabase
    .from("activities")
    .delete()
    .neq("id", "__never__");
  if (deleteActivitiesError) {
    // Si no existe activities, el SQL de migración no se corrió.
    throw new Error(
      "Falta la tabla activities. Ejecuta supabase/migrate-activities-hierarchy.sql en Supabase.",
    );
  }

  const { error: deleteMembersError } = await supabase
    .from("team_members")
    .delete()
    .neq("id", "__never__");
  if (deleteMembersError) throw deleteMembersError;

  if (board.members.length) {
    const memberRows = board.members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role || "",
      email: member.email || "",
      photo: member.photo || "",
      phone_country_code: member.phoneCountryCode || "+57",
      phone: member.phone || "",
      created_at: member.createdAt || new Date().toISOString(),
    }));

    let { error } = await supabase.from("team_members").insert(memberRows);
    if (error && (error.code === "PGRST204" || String(error.message || "").includes("phone"))) {
      ({ error } = await supabase.from("team_members").insert(
        memberRows.map(({ phone_country_code: _c, phone: _p, ...rest }) => rest),
      ));
    }
    if (error) throw error;
  }

  if (board.activities.length) {
    const activityRows = board.activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      date: activity.date,
      finished_date: activity.finishedDate || null,
      process_url: activity.processUrl || "",
      deliverable_url: activity.deliverableUrl || "",
      status: activity.status,
      assignee_ids: activity.assigneeIds || [],
      notes: activity.notes || [],
      review_messages: activity.reviewMessages || [],
      created_at: activity.createdAt || new Date().toISOString(),
      updated_at: activity.updatedAt || new Date().toISOString(),
    }));

    let { error: activitiesError } = await supabase.from("activities").insert(activityRows);
    if (
      activitiesError &&
      (activitiesError.code === "PGRST204" ||
        String(activitiesError.message || "").includes("review_messages"))
    ) {
      ({ error: activitiesError } = await supabase.from("activities").insert(
        activityRows.map(({ review_messages: _rm, ...rest }) => rest),
      ));
    }
    if (
      activitiesError &&
      (activitiesError.code === "PGRST204" ||
        String(activitiesError.message || "").toLowerCase().includes("notes"))
    ) {
      ({ error: activitiesError } = await supabase.from("activities").insert(
        activityRows.map(({ notes: _n, review_messages: _rm, ...rest }) => rest),
      ));
    }
    if (activitiesError) throw activitiesError;

    const taskRows = board.activities.flatMap((activity) =>
      activity.tasks.map((task, index) => {
        const status = normalizeItemStatus(task.status, task.done);
        return {
          id: task.id,
          activity_id: activity.id,
          title: task.title,
          status,
          done: status === "done",
          url: task.url || "",
          position: index,
        };
      }),
    );

    if (taskRows.length) {
      const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
      if (tasksError) throw tasksError;
    }

    const subtaskRows = board.activities.flatMap((activity) =>
      activity.tasks.flatMap((task) =>
        task.subtasks.map((subtask, index) => {
          const status = normalizeItemStatus(subtask.status, subtask.done);
          return {
            id: subtask.id,
            task_id: task.id,
            title: subtask.title,
            status,
            done: status === "done",
            url: subtask.url || "",
            position: index,
          };
        }),
      ),
    );

    if (subtaskRows.length) {
      const { error: subtasksError } = await supabase.from("subtasks").insert(subtaskRows);
      if (subtasksError) throw subtasksError;
    }
  }

  // Banco de ideas (opcional hasta correr add-task-bank.sql).
  const { error: deleteBankError } = await supabase
    .from("task_bank")
    .delete()
    .neq("id", "__never__");
  if (deleteBankError) {
    console.warn(
      "Tabla task_bank no disponible. Ejecuta supabase/add-task-bank.sql para persistir el banco.",
      deleteBankError.message,
    );
    return;
  }

  if (board.bank.length) {
    const bankRows = board.bank.map((item) => ({
      id: item.id,
      title: item.title,
      notes: item.notes || "",
      owner_id: item.ownerId || "",
      suggested_assignee_ids: item.suggestedAssigneeIds || [],
      converted_activity_id: item.convertedActivityId || null,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString(),
    }));
    const { error: bankError } = await supabase.from("task_bank").insert(bankRows);
    if (bankError) throw bankError;
  }
}

async function readStoredBoard(): Promise<StoredBoard> {
  if (isSupabaseConfigured()) {
    try {
      return await readTasksSupabaseRaw();
    } catch (error) {
      console.error("Supabase tasks read failed, using local fallback:", error);
      return readTasksLocalRaw();
    }
  }
  return readTasksLocalRaw();
}

async function writeStoredBoard(board: StoredBoard) {
  if (isSupabaseConfigured()) {
    await writeTasksSupabaseRaw(board);
    return;
  }
  await writeTasksLocalRaw(board);
}

export async function readTasksBoard(): Promise<TasksBoard> {
  return toPublicBoard(await readStoredBoard());
}

export async function writeTasksBoard(
  board: TasksBoard,
  options?: { allowAuthEdit?: boolean },
) {
  const existing = await readStoredBoard();
  const allowAuthEdit = Boolean(options?.allowAuthEdit);

  const members: StoredMember[] = (board.members || []).map((member) => {
    const prev = existing.members.find((item) => item.id === member.id);
    let passwordHash = prev?.passwordHash || "";

    if (allowAuthEdit && member.newPassword && member.newPassword.trim()) {
      passwordHash = hashPassword(member.newPassword.trim());
    }

    const accessRole = allowAuthEdit
      ? normalizeAccessRole(member.accessRole)
      : normalizeAccessRole(prev?.accessRole ?? member.accessRole);
    const canLogin = allowAuthEdit
      ? Boolean(member.canLogin)
      : Boolean(prev?.canLogin ?? member.canLogin);

    return normalizeStoredMember({
      id: member.id,
      name: member.name,
      role: member.role,
      email: member.email,
      photo: member.photo,
      phoneCountryCode: member.phoneCountryCode,
      phone: member.phone,
      createdAt: member.createdAt || prev?.createdAt || new Date().toISOString(),
      accessRole,
      canLogin,
      passwordHash,
    });
  });

  await writeStoredBoard({
    members,
    activities: normalizeActivities(board.activities || []),
    bank: normalizeBank(board.bank || []),
  });
}

export async function authenticateTeamMember(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const board = await readStoredBoard();
  const member = board.members.find(
    (item) =>
      item.canLogin &&
      item.email === normalizedEmail &&
      item.passwordHash &&
      verifyPassword(password, item.passwordHash),
  );

  if (!member) return null;

  return {
    id: member.id,
    name: member.name,
    email: member.email,
    accessRole: member.accessRole,
  };
}

export { emptyBoard };
