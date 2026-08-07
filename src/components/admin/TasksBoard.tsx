"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TASK_STATUSES,
  createId,
  emptyBoard,
  getTaskProgress,
  normalizeSubtaskStatus,
  type Subtask,
  type Task,
  type TaskStatus,
  type TasksBoard,
  type TeamMember,
} from "@/lib/tasks/types";
import { TasksGantt } from "@/components/admin/TasksGantt";
import { TasksReports } from "@/components/admin/TasksReports";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { TaskSemaphore } from "@/components/admin/AdminAlarms";
import { getTaskAlarmLevel, TASK_ALARM_COLORS } from "@/lib/alarms";

const STATUS_STYLES: Record<TaskStatus, string> = {
  waiting: "bg-[#f3f3f3] text-[color:var(--muted)]",
  in_progress: "bg-[#fff1f4] text-[color:var(--accent)]",
  paused: "bg-[#eff6ff] text-[#2563eb]",
  pending_review: "bg-[#eef4ff] text-[#2456b5]",
  done: "bg-[#e9f8ef] text-[#177245]",
};

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeMember(member: Partial<TeamMember> & { id: string }): TeamMember {
  return {
    id: member.id,
    name: member.name || "",
    role: member.role || "",
    email: member.email || "",
    photo: member.photo || "",
    createdAt: member.createdAt || "",
    accessRole: member.accessRole === "admin" ? "admin" : "member",
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.hasPassword),
  };
}

function MemberAvatar({
  name,
  photo,
  size = "sm",
}: {
  name: string;
  photo?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16" : size === "md" ? "h-12 w-12" : "h-8 w-8";
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name} className={`${sizeClass} shrink-0 object-cover`} />
    );
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center bg-[color:var(--mist)] text-sm font-semibold text-[color:var(--muted)]`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const emptyMemberForm = {
  name: "",
  role: "",
  email: "",
  photo: "",
};

export function TasksBoard() {
  const router = useRouter();
  const [board, setBoard] = useState<TasksBoard>(emptyBoard());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"tasks" | "team">("tasks");
  const [viewMode, setViewMode] = useState<"list" | "gantt" | "reports">("list");
  const [selectedMemberId, setSelectedMemberId] = useState<string | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);

  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newFirstSubtask, setNewFirstSubtask] = useState("");
  const [newFirstSubtaskUrl, setNewFirstSubtaskUrl] = useState("");
  const [newSubtask, setNewSubtask] = useState<Record<string, { title: string; url: string }>>(
    {},
  );

  const load = useCallback(async () => {
    const [tasksRes, meRes] = await Promise.all([
      fetch("/api/tasks", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);
    if (meRes.ok) {
      const me = (await meRes.json()) as { role?: string };
      setIsAdmin(me.role === "admin");
    }
    if (tasksRes.ok) {
      const data = (await tasksRes.json()) as TasksBoard;
      setBoard({
        members: (data.members || []).map((member) => normalizeMember(member)),
        tasks: (data.tasks || []).map((task) => ({
          ...task,
          title: task.title || "",
          date: task.date || "",
          finishedDate: task.finishedDate || "",
          processUrl: task.processUrl || "",
          deliverableUrl: task.deliverableUrl || "",
          status: task.status || "waiting",
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
          createdAt: task.createdAt || "",
          updatedAt: task.updatedAt || "",
        })),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTasks = useMemo(() => {
    if (selectedMemberId === "all") return board.tasks;
    return board.tasks.filter((task) => (task.assigneeIds || []).includes(selectedMemberId));
  }, [board.tasks, selectedMemberId]);

  const selectedMember =
    selectedMemberId === "all"
      ? null
      : board.members.find((member) => member.id === selectedMemberId) || null;

  async function persist(next: TasksBoard) {
    setSaving(true);
    setStatusMsg("");
    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (res.ok) {
      await load();
      setStatusMsg("Guardado");
      window.setTimeout(() => setStatusMsg(""), 1800);
      return true;
    }
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setStatusMsg(payload?.error || "Error al guardar");
    return false;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function uploadMemberPhoto(file: File) {
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        alert("Error al subir la foto");
        return;
      }
      const data = (await res.json()) as { url: string };
      setMemberForm((p) => ({ ...emptyMemberForm, ...p, photo: data.url }));
    } finally {
      setUploadingPhoto(false);
    }
  }

  function addMember(event: FormEvent) {
    event.preventDefault();
    if (!memberForm.name.trim()) return;
    if (!memberForm.photo) {
      alert("Sube la foto del integrante");
      return;
    }
    const member: TeamMember = {
      id: createId("member"),
      name: memberForm.name.trim(),
      role: memberForm.role.trim(),
      email: memberForm.email.trim().toLowerCase(),
      photo: memberForm.photo,
      createdAt: new Date().toISOString(),
      accessRole: "member",
      canLogin: false,
      hasPassword: false,
    };
    void persist({ ...board, members: [...board.members, member] });
    setMemberForm(emptyMemberForm);
  }

  function removeMember(id: string) {
    if (!window.confirm("¿Eliminar este integrante?")) return;
    void persist({
      members: board.members.filter((m) => m.id !== id),
      tasks: board.tasks.map((task) => ({
        ...task,
        assigneeIds: task.assigneeIds.filter((assigneeId) => assigneeId !== id),
      })),
    });
    if (selectedMemberId === id) setSelectedMemberId("all");
  }

  function openCreateModal() {
    const defaultAssignee =
      selectedMemberId !== "all"
        ? selectedMemberId
        : board.members[0]?.id || "";
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    setNewAssigneeId(defaultAssignee);
    setNewTitle("");
    setNewDate(start);
    setNewEndDate(end.toISOString().slice(0, 10));
    setNewFirstSubtask("");
    setNewFirstSubtaskUrl("");
    setShowCreateModal(true);
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    if (!newAssigneeId) {
      alert("Selecciona un integrante");
      return;
    }
    if (!newEndDate) {
      alert("Indica la fecha de fin");
      return;
    }
    if (newEndDate < newDate) {
      alert("La fecha de fin no puede ser anterior al inicio");
      return;
    }

    const now = new Date().toISOString();
    const subtasks: Subtask[] = newFirstSubtask.trim()
      ? [
          {
            id: createId("sub"),
            title: newFirstSubtask.trim(),
            status: "waiting",
            done: false,
            url: newFirstSubtaskUrl.trim(),
          },
        ]
      : [];

    const task: Task = {
      id: createId("task"),
      title: newTitle.trim(),
      date: newDate,
      finishedDate: newEndDate,
      processUrl: "",
      deliverableUrl: "",
      status: "waiting",
      assigneeIds: [newAssigneeId],
      subtasks,
      createdAt: now,
      updatedAt: now,
    };

    const ok = await persist({ ...board, tasks: [task, ...board.tasks] });
    if (ok) {
      setShowCreateModal(false);
      setSelectedMemberId(newAssigneeId);
      if (task.subtasks.length) setExpandedId(task.id);
    }
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    void persist({
      ...board,
      tasks: board.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task,
      ),
    });
  }

  function removeTask(taskId: string) {
    if (!window.confirm("¿Eliminar esta tarea?")) return;
    void persist({
      ...board,
      tasks: board.tasks.filter((task) => task.id !== taskId),
    });
  }

  function addSubtask(taskId: string) {
    const draft = newSubtask[taskId] || { title: "", url: "" };
    const title = draft.title.trim();
    if (!title) return;
    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: [
        ...task.subtasks,
        {
          id: createId("sub"),
          title,
          status: "waiting",
          done: false,
          url: draft.url.trim(),
        },
      ],
    });
    setNewSubtask((prev) => ({ ...prev, [taskId]: { title: "", url: "" } }));
  }

  function updateSubtask(taskId: string, subtaskId: string, patch: Partial<Subtask>) {
    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: task.subtasks.map((item) => {
        if (item.id !== subtaskId) return item;
        const next = { ...item, ...patch };
        if (patch.status) {
          next.status = patch.status;
          next.done = patch.status === "done";
        }
        return next;
      }),
    });
  }

  function setTaskStatus(taskId: string, status: TaskStatus) {
    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, { status });
    // URLs de entrega solo cuando el estado es Terminada
    if (status === "done") {
      window.setTimeout(() => {
        setExpandedId(null);
        setCompleteTaskId(taskId);
      }, 0);
    }
  }

  function openDeliveryModal(task: Task) {
    if (task.status !== "done") return;
    setExpandedId(null);
    setCompleteTaskId(task.id);
  }

  function saveDeliveryUrls(taskId: string) {
    updateTask(taskId, { status: "done" });
    setCompleteTaskId(null);
  }

  function removeSubtask(taskId: string, subtaskId: string) {
    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: task.subtasks.filter((item) => item.id !== subtaskId),
    });
  }

  if (loading) {
    return <div className="p-10 text-sm text-[color:var(--muted)]">Cargando tareas...</div>;
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              Seguimiento de tareas
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              {saving ? "Guardando..." : statusMsg || "Equipo y avance"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin" className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold">
              Panel
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-12 md:px-8">
        <div className="mb-6 flex gap-2 border border-[color:var(--line)] bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("tasks")}
            className={`px-4 py-2 text-sm font-semibold ${
              tab === "tasks" ? "bg-[color:var(--accent)] text-white" : ""
            }`}
          >
            Tareas
          </button>
          <button
            type="button"
            onClick={() => setTab("team")}
            className={`px-4 py-2 text-sm font-semibold ${
              tab === "team" ? "bg-[color:var(--accent)] text-white" : ""
            }`}
          >
            Equipo
          </button>
        </div>

        {tab === "team" ? (
          <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <form onSubmit={addMember} className="h-fit space-y-3 border border-[color:var(--line)] bg-white p-5">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                Nuevo integrante
              </h2>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadMemberPhoto(file);
                  e.target.value = "";
                }}
                className="block w-full text-xs"
              />
              {memberForm.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={memberForm.photo} alt="" className="h-24 w-24 object-cover" />
              ) : null}
              <input
                required
                placeholder="Nombre"
                value={str(memberForm.name)}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...emptyMemberForm, ...p, name: e.target.value }))
                }
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              <input
                placeholder="Cargo / rol"
                value={str(memberForm.role)}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...emptyMemberForm, ...p, role: e.target.value }))
                }
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={str(memberForm.email)}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...emptyMemberForm, ...p, email: e.target.value }))
                }
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
              />
              {isAdmin && (
                <p className="border border-[color:var(--line)] bg-[color:var(--mist)] p-3 text-xs text-[color:var(--muted)]">
                  El acceso al panel usa contraseñas compartidas por rol. El administrador puede
                  cambiarlas en el panel principal.
                </p>
              )}
              <button
                type="submit"
                disabled={uploadingPhoto}
                className="w-full bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Agregar integrante
              </button>
            </form>

            <div className="border border-[color:var(--line)] bg-white">
              {board.members.length === 0 ? (
                <p className="p-6 text-sm text-[color:var(--muted)]">Aún no hay integrantes.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {board.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={member.name} photo={member.photo} size="md" />
                        <div>
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-sm text-[color:var(--muted)]">
                            {member.role || "Sin cargo"}
                            {member.email ? ` · ${member.email}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="text-xs font-semibold text-[color:var(--accent)]"
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)]">
                  Visualizar tareas del equipo
                </h1>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Lista, Gantt o Reportes por integrante.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex border border-[color:var(--line)] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      viewMode === "list" ? "bg-[color:var(--accent)] text-white" : ""
                    }`}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("gantt")}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      viewMode === "gantt" ? "bg-[color:var(--accent)] text-white" : ""
                    }`}
                  >
                    Gantt
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("reports")}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      viewMode === "reports" ? "bg-[color:var(--accent)] text-white" : ""
                    }`}
                  >
                    Reportes
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={board.members.length === 0}
                  className="bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  + Nueva tarea
                </button>
              </div>
            </div>

            {board.members.length === 0 ? (
              <div className="border border-[color:var(--line)] bg-white p-8 text-center">
                <p className="text-[color:var(--muted)]">
                  Primero crea integrantes en la pestaña Equipo.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("team")}
                  className="mt-4 text-sm font-semibold text-[color:var(--accent)]"
                >
                  Ir a Equipo
                </button>
              </div>
            ) : viewMode === "reports" ? (
              <TasksReports members={board.members} tasks={board.tasks} />
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMemberId("all")}
                    className={`shrink-0 border px-4 py-3 text-left transition-colors ${
                      selectedMemberId === "all"
                        ? "border-[color:var(--accent)] bg-[#fff1f4]"
                        : "border-[color:var(--line)] bg-white"
                    }`}
                  >
                    <p className="font-[family-name:var(--font-display)] text-sm font-bold">
                      Todo el equipo
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {board.tasks.length} tareas
                    </p>
                  </button>

                  {board.members.map((member) => {
                    const count = board.tasks.filter((task) =>
                      (task.assigneeIds || []).includes(member.id),
                    ).length;
                    const active = selectedMemberId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`flex shrink-0 items-center gap-3 border px-4 py-3 text-left transition-colors ${
                          active
                            ? "border-[color:var(--accent)] bg-[#fff1f4]"
                            : "border-[color:var(--line)] bg-white"
                        }`}
                      >
                        <MemberAvatar name={member.name} photo={member.photo} size="md" />
                        <div>
                          <p className="font-[family-name:var(--font-display)] text-sm font-bold">
                            {member.name}
                          </p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {count} {count === 1 ? "tarea" : "tareas"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedMember && (
                  <p className="text-sm text-[color:var(--muted)]">
                    Mostrando tareas de{" "}
                    <span className="font-semibold text-[color:var(--ink)]">
                      {selectedMember.name}
                    </span>
                  </p>
                )}

                {viewMode === "gantt" ? (
                  <TasksGantt
                    members={
                      selectedMemberId === "all"
                        ? board.members
                        : board.members.filter((m) => m.id === selectedMemberId)
                    }
                    tasks={filteredTasks}
                  />
                ) : (
                <div className="grid gap-3">
                  {filteredTasks.length === 0 ? (
                    <div className="border border-[color:var(--line)] bg-white p-8 text-center">
                      <p className="text-[color:var(--muted)]">No hay tareas en esta vista.</p>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="mt-3 text-sm font-semibold text-[color:var(--accent)]"
                      >
                        Crear una tarea
                      </button>
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const progress = getTaskProgress(task);
                      const expanded = expandedId === task.id;
                      const canComplete = task.status === "done";
                      const alarmLevel = getTaskAlarmLevel(task);
                      const assignees = (task.assigneeIds || [])
                        .map((id) => board.members.find((m) => m.id === id))
                        .filter(Boolean) as TeamMember[];

                      return (
                        <article
                          key={task.id}
                          className="border border-[color:var(--line)] bg-white"
                        >
                          <div className="p-4 md:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <TaskSemaphore level={alarmLevel} />
                                  <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
                                    {task.title}
                                  </h3>
                                  {alarmLevel !== "none" && (
                                    <span
                                      className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                      style={{
                                        backgroundColor: TASK_ALARM_COLORS[alarmLevel].bg,
                                      }}
                                    >
                                      {TASK_ALARM_COLORS[alarmLevel].label}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-4">
                                  <label className="space-y-1 text-sm text-[color:var(--muted)]">
                                    <span className="block text-[10px] font-semibold uppercase">
                                      Estado de la tarea
                                    </span>
                                    <select
                                      value={str(task.status) || "waiting"}
                                      onChange={(e) =>
                                        setTaskStatus(task.id, e.target.value as TaskStatus)
                                      }
                                      className={`border border-[color:var(--line)] px-2 py-1.5 text-sm font-semibold ${
                                        STATUS_STYLES[task.status] || STATUS_STYLES.waiting
                                      }`}
                                    >
                                      {TASK_STATUSES.map((item) => (
                                        <option key={item.value} value={item.value}>
                                          {item.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-sm text-[color:var(--muted)]">
                                    <span className="block text-[10px] font-semibold uppercase">
                                      Inicio
                                    </span>
                                    <input
                                      type="date"
                                      value={str(task.date)}
                                      onChange={(e) =>
                                        updateTask(task.id, { date: e.target.value })
                                      }
                                      className="border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
                                    />
                                  </label>
                                  <label className="space-y-1 text-sm text-[color:var(--muted)]">
                                    <span className="block text-[10px] font-semibold uppercase">
                                      Fin
                                    </span>
                                    <input
                                      type="date"
                                      value={str(task.finishedDate)}
                                      onChange={(e) =>
                                        updateTask(task.id, { finishedDate: e.target.value })
                                      }
                                      className="border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
                                    />
                                  </label>
                                </div>

                                <div>
                                  <div className="mb-1 flex justify-between text-xs font-semibold">
                                    <span className="text-[color:var(--muted)]">Progreso</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className="h-2 bg-[color:var(--mist)]">
                                    <div
                                      className="h-full bg-[color:var(--accent)] transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  {!task.subtasks.length ? (
                                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                                      Sin subtareas: el avance sigue el estado de la tarea.
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {assignees.map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center gap-2 bg-[color:var(--mist)] px-2 py-1"
                                    >
                                      <MemberAvatar
                                        name={member.name}
                                        photo={member.photo}
                                      />
                                      <span className="text-xs font-semibold">{member.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={!canComplete}
                                  title={
                                    canComplete
                                      ? "Agregar URLs de entrega"
                                      : "Cambia el estado a Terminada para activar"
                                  }
                                  onClick={() => openDeliveryModal(task)}
                                  className={`px-3 py-1.5 text-xs font-semibold ${
                                    canComplete
                                      ? "bg-[color:var(--accent)] text-white"
                                      : "cursor-not-allowed border border-[color:var(--line)] text-[color:var(--muted)] opacity-50"
                                  }`}
                                >
                                  URLs de entrega
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(expanded ? null : task.id)}
                                  className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                >
                                  {task.subtasks.length
                                    ? `Subtareas (${task.subtasks.length})`
                                    : "Agregar subtareas"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeTask(task.id)}
                                  className="text-xs font-semibold text-[color:var(--accent)]"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>

                          {expanded && (
                            <div className="border-t border-[color:var(--line)] p-4">
                              <h4 className="text-sm font-bold">Subtareas (opcional)</h4>
                              <p className="mt-1 text-xs text-[color:var(--muted)]">
                                Puedes agregarlas después. Cada una puede llevar su URL.
                              </p>
                              <ul className="mt-3 space-y-2">
                                {task.subtasks.map((subtask) => (
                                  <li
                                    key={subtask.id}
                                    className="space-y-2 border border-[color:var(--line)] px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p
                                        className={`min-w-0 flex-1 text-sm font-semibold ${
                                          subtask.status === "done"
                                            ? "text-[color:var(--muted)] line-through"
                                            : ""
                                        }`}
                                      >
                                        {subtask.title}
                                      </p>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <select
                                          aria-label="Estado de la subtarea"
                                          value={str(subtask.status) || "waiting"}
                                          onChange={(e) =>
                                            updateSubtask(task.id, subtask.id, {
                                              status: e.target.value as TaskStatus,
                                            })
                                          }
                                          className={`min-w-[10.5rem] border border-[color:var(--line)] px-2 py-1.5 text-xs font-semibold ${
                                            STATUS_STYLES[subtask.status] ||
                                            STATUS_STYLES.waiting
                                          }`}
                                        >
                                          {TASK_STATUSES.map((item) => (
                                            <option key={item.value} value={item.value}>
                                              {item.label}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => removeSubtask(task.id, subtask.id)}
                                          className="text-xs font-semibold text-[color:var(--accent)]"
                                        >
                                          Quitar
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="url"
                                      placeholder="URL de la subtarea (opcional)"
                                      value={str(subtask.url)}
                                      onChange={(e) =>
                                        updateSubtask(task.id, subtask.id, {
                                          url: e.target.value,
                                        })
                                      }
                                      className="w-full border border-[color:var(--line)] px-2 py-1.5 text-xs"
                                    />
                                    {subtask.url ? (
                                      <a
                                        href={subtask.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-block text-xs font-semibold text-[color:var(--accent)]"
                                      >
                                        Abrir URL
                                      </a>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <input
                                  value={str(newSubtask[task.id]?.title)}
                                  onChange={(e) =>
                                    setNewSubtask((prev) => ({
                                      ...prev,
                                      [task.id]: {
                                        title: e.target.value,
                                        url: prev[task.id]?.url || "",
                                      },
                                    }))
                                  }
                                  placeholder="Nueva subtarea..."
                                  className="border border-[color:var(--line)] px-3 py-2 text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addSubtask(task.id);
                                    }
                                  }}
                                />
                                <input
                                  type="url"
                                  value={str(newSubtask[task.id]?.url)}
                                  onChange={(e) =>
                                    setNewSubtask((prev) => ({
                                      ...prev,
                                      [task.id]: {
                                        title: prev[task.id]?.title || "",
                                        url: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="URL (opcional)"
                                  className="border border-[color:var(--line)] px-3 py-2 text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addSubtask(task.id);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => addSubtask(task.id)}
                                  className="bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                                >
                                  Agregar
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <AdminFooter />

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void createTask(e)}
            className="w-full max-w-md space-y-4 border border-[color:var(--line)] bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  Nueva tarea
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Incluye inicio y fin para el Gantt. El estado se gestiona en la tarjeta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-sm font-semibold text-[color:var(--muted)]"
              >
                Cerrar
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                ¿Qué hay que hacer?
              </span>
              <input
                required
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Crear el programa"
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                ¿Quién la hace?
              </span>
              <div className="grid grid-cols-2 gap-2">
                {board.members.map((member) => {
                  const active = newAssigneeId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setNewAssigneeId(member.id)}
                      className={`flex items-center gap-2 border px-3 py-2 text-left ${
                        active
                          ? "border-[color:var(--accent)] bg-[#fff1f4]"
                          : "border-[color:var(--line)]"
                      }`}
                    >
                      <MemberAvatar name={member.name} photo={member.photo} />
                      <span className="text-sm font-semibold">{member.name}</span>
                    </button>
                  );
                })}
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                Fecha de inicio
              </span>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => {
                  const start = e.target.value;
                  setNewDate(start);
                  if (newEndDate < start) setNewEndDate(start);
                }}
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                Fecha de fin
              </span>
              <input
                type="date"
                required
                value={newEndDate}
                min={newDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                Primera subtarea (opcional)
              </span>
              <input
                value={newFirstSubtask}
                onChange={(e) => setNewFirstSubtask(e.target.value)}
                placeholder="Déjalo vacío si no necesitas subtareas"
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm"
              />
              <span className="block text-[11px] text-[color:var(--muted)]">
                Puedes crear la tarea sin subtareas y gestionarla solo con su estado.
              </span>
            </label>

            {newFirstSubtask.trim() ? (
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                  URL de la subtarea (opcional)
                </span>
                <input
                  type="url"
                  value={newFirstSubtaskUrl}
                  onChange={(e) => setNewFirstSubtaskUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm"
                />
              </label>
            ) : null}

            <button
              type="submit"
              className="w-full bg-[color:var(--accent)] py-3 text-sm font-semibold text-white"
            >
              Crear tarea
            </button>
          </form>
        </div>
      )}

      {completeTaskId &&
        (() => {
          const task = board.tasks.find((item) => item.id === completeTaskId);
          if (!task) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <div className="w-full max-w-md space-y-4 border border-[color:var(--line)] bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                      URLs de entrega
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{task.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompleteTaskId(null)}
                    className="text-sm font-semibold text-[color:var(--muted)]"
                  >
                    Cerrar
                  </button>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    URL del proceso
                  </span>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={str(task.processUrl)}
                    onChange={(e) => updateTask(task.id, { processUrl: e.target.value })}
                    className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    URL del entregable
                  </span>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={str(task.deliverableUrl)}
                    onChange={(e) => updateTask(task.id, { deliverableUrl: e.target.value })}
                    className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>

                <p className="text-xs text-[color:var(--muted)]">
                  Al guardar, el estado de la tarea queda en <strong>Terminada</strong>.
                </p>

                <button
                  type="button"
                  onClick={() => saveDeliveryUrls(task.id)}
                  className="w-full bg-[color:var(--accent)] py-3 text-sm font-semibold text-white"
                >
                  Guardar y cerrar
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
