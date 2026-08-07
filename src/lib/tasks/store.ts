import { promises as fs } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  emptyBoard,
  normalizeSubtaskStatus,
  type AccessRole,
  type Task,
  type TasksBoard,
  type TeamMember,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");

type TaskRow = {
  id: string;
  title: string;
  date: string;
  finished_date: string | null;
  process_url: string;
  deliverable_url: string;
  status: Task["status"];
  assignee_ids: string[] | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  access_role?: string | null;
  can_login?: boolean | null;
  password_hash?: string | null;
};

type StoredMember = TeamMember & { passwordHash: string };

type StoredBoard = {
  members: StoredMember[];
  tasks: Task[];
};

function normalizeAccessRole(value: unknown): AccessRole {
  return value === "admin" ? "admin" : "member";
}

function toPublicMember(member: StoredMember): TeamMember {
  return {
    id: member.id,
    name: member.name,
    role: member.role || "",
    email: member.email || "",
    photo: member.photo || "",
    createdAt: member.createdAt,
    accessRole: normalizeAccessRole(member.accessRole),
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.passwordHash),
  };
}

function toPublicBoard(board: StoredBoard): TasksBoard {
  return {
    members: board.members.map(toPublicMember),
    tasks: board.tasks,
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
    createdAt: member.createdAt || new Date().toISOString(),
    accessRole: normalizeAccessRole(member.accessRole),
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.passwordHash),
    passwordHash: member.passwordHash || "",
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  return (tasks || []).map((task) => ({
    ...task,
    finishedDate: task.finishedDate || "",
    processUrl: task.processUrl || "",
    deliverableUrl: task.deliverableUrl || "",
    assigneeIds: task.assigneeIds || [],
    subtasks: (task.subtasks || []).map((subtask) => {
      const status = normalizeSubtaskStatus(subtask.status, subtask.done);
      return {
        id: subtask.id,
        title: subtask.title || "",
        status,
        done: status === "done",
        url: subtask.url || "",
      };
    }),
  }));
}

function normalizeStoredBoard(data: Partial<StoredBoard> | null): StoredBoard {
  return {
    members: Array.isArray(data?.members)
      ? data.members.map((member) =>
          normalizeStoredMember({
            ...member,
            id: member.id,
            passwordHash:
              (member as StoredMember).passwordHash ||
              (member as { password_hash?: string }).password_hash ||
              "",
          }),
        )
      : [],
    tasks: normalizeTasks(Array.isArray(data?.tasks) ? data.tasks : []),
  };
}

async function readTasksLocalRaw(): Promise<StoredBoard> {
  try {
    const raw = await fs.readFile(TASKS_PATH, "utf8");
    return normalizeStoredBoard(JSON.parse(raw) as StoredBoard);
  } catch {
    return { members: [], tasks: [] };
  }
}

async function writeTasksLocalRaw(board: StoredBoard) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TASKS_PATH, JSON.stringify(board, null, 2), "utf8");
}

async function readTasksSupabaseRaw(): Promise<StoredBoard> {
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
      createdAt: row.created_at,
      accessRole: normalizeAccessRole(row.access_role),
      canLogin: Boolean(row.can_login),
      passwordHash: row.password_hash || "",
    }),
  );

  const subtasksByTask = new Map<string, Task["subtasks"]>();
  for (const row of (subtasksRes.data || []) as SubtaskRow[]) {
    const list = subtasksByTask.get(row.task_id) || [];
    const status = normalizeSubtaskStatus(row.status, row.done);
    list.push({
      id: row.id,
      title: row.title,
      status,
      done: status === "done",
      url: row.url || "",
    });
    subtasksByTask.set(row.task_id, list);
  }

  const tasks: Task[] = ((tasksRes.data || []) as TaskRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    finishedDate: row.finished_date || "",
    processUrl: row.process_url || "",
    deliverableUrl: row.deliverable_url || "",
    status: row.status,
    assigneeIds: row.assignee_ids || [],
    subtasks: subtasksByTask.get(row.id) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { members, tasks };
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

  const { error: deleteMembersError } = await supabase
    .from("team_members")
    .delete()
    .neq("id", "__never__");
  if (deleteMembersError) throw deleteMembersError;

  if (board.members.length) {
    const { error } = await supabase.from("team_members").insert(
      board.members.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role || "",
        email: member.email || "",
        photo: member.photo || "",
        created_at: member.createdAt || new Date().toISOString(),
        access_role: member.accessRole || "member",
        can_login: Boolean(member.canLogin),
        password_hash: member.passwordHash || "",
      })),
    );
    if (error) throw error;
  }

  if (board.tasks.length) {
    const { error } = await supabase.from("tasks").insert(
      board.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        date: task.date,
        finished_date: task.finishedDate || null,
        process_url: task.processUrl || "",
        deliverable_url: task.deliverableUrl || "",
        status: task.status,
        assignee_ids: task.assigneeIds || [],
        created_at: task.createdAt || new Date().toISOString(),
        updated_at: task.updatedAt || new Date().toISOString(),
      })),
    );
    if (error) throw error;

    const subtaskRows = board.tasks.flatMap((task) =>
      task.subtasks.map((subtask, index) => {
        const status = normalizeSubtaskStatus(subtask.status, subtask.done);
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
    );

    if (subtaskRows.length) {
      const { error: subtasksError } = await supabase.from("subtasks").insert(subtaskRows);
      if (subtasksError) throw subtasksError;
    }
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
      createdAt: member.createdAt || prev?.createdAt || new Date().toISOString(),
      accessRole,
      canLogin,
      passwordHash,
    });
  });

  await writeStoredBoard({
    members,
    tasks: normalizeTasks(board.tasks || []),
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
