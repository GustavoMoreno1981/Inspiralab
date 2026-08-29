"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TASK_STATUSES,
  TASK_STATUS_COLORS,
  PHONE_COUNTRY_CODES,
  createId,
  emptyBoard,
  deriveActivityStatusFromTasks,
  deriveTaskStatusFromSubtasks,
  formatMemberPhone,
  getActivityProgress,
  isActivityFullyComplete,
  normalizeItemStatus,
  normalizeVisibility,
  type Activity,
  type Task,
  type Subtask,
  type TaskBankItem,
  type TaskNote,
  type ReviewMessage,
  type ReviewResponseValue,
  type TaskStatus,
  type TasksBoard,
  type TeamMember,
  type ItemVisibility,
} from "@/lib/tasks/types";
import {
  latestReviewResponse,
  reviewResponseLabel,
} from "@/lib/tasks/review-message";
import { TasksGantt } from "@/components/admin/TasksGantt";
import { TasksHistory } from "@/components/admin/TasksHistory";
import { TasksReports } from "@/components/admin/TasksReports";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { TaskSemaphore } from "@/components/admin/AdminAlarms";
import { ReviewMessageModal } from "@/components/admin/ReviewMessageModal";
import { ReviewResponsePanel } from "@/components/admin/ReviewResponsePanel";
import { TasksAssistant } from "@/components/admin/TasksAssistant";
import { DeliveryUrlsModal } from "@/components/admin/DeliveryUrlsModal";
import {
  EMPTY_PRIVATE_SETUP,
  PrivateItemSetupFields,
  validatePrivateSetup,
  type PrivateSetupValues,
} from "@/components/admin/PrivateItemSetupFields";
import { PrivateItemUnlockModal, type PrivateUnlockPayload } from "@/components/admin/PrivateItemUnlockModal";
import { PrivateLockedCard } from "@/components/admin/PrivateLockedCard";
import { usePrivateUnlock } from "@/hooks/usePrivateUnlock";
import type { PrivateItemType } from "@/lib/tasks/private-auth";
import { useToast } from "@/components/admin/AdminToast";

const STATUS_STYLES: Record<TaskStatus, string> = {
  waiting: "bg-[#f3f3f3] text-[color:var(--muted)]",
  in_progress: "bg-[#fff1f4] text-[color:var(--accent)]",
  paused: "bg-[#eff6ff] text-[#2563eb]",
  pending_review: "bg-[#fef9c3] text-[#a16207]",
  done: "bg-[#e9f8ef] text-[#177245]",
};

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatNoteDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeMember(member: Partial<TeamMember> & { id: string }): TeamMember {
  return {
    id: member.id,
    name: member.name || "",
    role: member.role || "",
    email: member.email || "",
    photo: member.photo || "",
    phoneCountryCode: member.phoneCountryCode || "+57",
    phone: (member.phone || "").replace(/\D/g, ""),
    createdAt: member.createdAt || "",
    accessRole: member.accessRole === "admin" ? "admin" : "member",
    canLogin: Boolean(member.canLogin),
    hasPassword: Boolean(member.hasPassword),
  };
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

function normalizeTask(
  task: Partial<Task> & { id: string },
  activityId: string,
): Task {
  const status = normalizeItemStatus(task.status, task.done);
  return {
    id: task.id,
    activityId: task.activityId || activityId,
    title: task.title || "",
    status,
    done: status === "done",
    url: task.url || "",
    subtasks: (task.subtasks || []).map((subtask) =>
      normalizeSubtask({ ...subtask, id: subtask.id || createId("sub") }),
    ),
  };
}

function normalizeActivity(activity: Partial<Activity> & { id: string }): Activity {
  const status = normalizeItemStatus(activity.status);
  return {
    id: activity.id,
    title: activity.title || "",
    date: activity.date || "",
    finishedDate: activity.finishedDate || "",
    processUrl: activity.processUrl || "",
    deliverableUrl: activity.deliverableUrl || "",
    status,
    assigneeIds: activity.assigneeIds || [],
    tasks: (activity.tasks || []).map((task) =>
      normalizeTask({ ...task, id: task.id || createId("task") }, activity.id),
    ),
    notes: Array.isArray(activity.notes)
      ? activity.notes.map((note) => ({
          id: note.id,
          text: note.text || "",
          createdAt: note.createdAt || "",
        }))
      : [],
    reviewMessages: Array.isArray(activity.reviewMessages)
      ? activity.reviewMessages.map((message) => ({
          id: message.id,
          recipientIds: message.recipientIds || [],
          recipientNames: message.recipientNames || [],
          body: message.body || "",
          url: message.url || "",
          fullText: message.fullText || "",
          createdAt: message.createdAt || "",
          channel: message.channel === "copied" ? "copied" : "whatsapp",
          response:
            message.response === "yes" ||
            message.response === "no" ||
            message.response === "pending" ||
            message.response === "call"
              ? message.response
              : null,
          responseAt: message.responseAt || "",
          responseBy: message.responseBy || "",
        }))
      : [],
    createdAt: activity.createdAt || "",
    updatedAt: activity.updatedAt || "",
    visibility: normalizeVisibility(activity.visibility),
    createdById: activity.createdById || "",
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
  const [broken, setBroken] = useState(false);
  const src = (photo || "").trim();
  const showImage = Boolean(src) && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-[color:var(--mist)] text-sm font-semibold text-[color:var(--muted)]`}
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
  phoneCountryCode: "+57",
  phone: "",
};

export function TasksBoard() {
  const router = useRouter();
  const toast = useToast();
  const [board, setBoard] = useState<TasksBoard>(emptyBoard());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionMemberId, setSessionMemberId] = useState("");
  const [tab, setTab] = useState<"tasks" | "team">("tasks");
  const [viewMode, setViewMode] = useState<
    "list" | "gantt" | "reports" | "bank" | "history"
  >("list");
  const [selectedMemberId, setSelectedMemberId] = useState<string | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [bankTitle, setBankTitle] = useState("");
  const [bankNotes, setBankNotes] = useState("");
  const [bankOwnerId, setBankOwnerId] = useState("");
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankTitle, setEditingBankTitle] = useState("");
  const [editingBankNotes, setEditingBankNotes] = useState("");
  const [viewingBankId, setViewingBankId] = useState<string | null>(null);
  const [convertingBankId, setConvertingBankId] = useState<string | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingAssigneesActivityId, setEditingAssigneesActivityId] = useState<string | null>(
    null,
  );
  const [completeActivityId, setCompleteActivityId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  const [reviewModalActivityId, setReviewModalActivityId] = useState<string | null>(null);
  const [reviewHistoryOpenId, setReviewHistoryOpenId] = useState<string | null>(null);
  const [reviewRevert, setReviewRevert] = useState<{
    activityId: string;
    status: TaskStatus;
    tasks: Task[];
  } | null>(null);

  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEndDate, setNewEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newFirstTask, setNewFirstTask] = useState("");
  const [newFirstSubtask, setNewFirstSubtask] = useState("");
  const [newFirstSubtaskUrl, setNewFirstSubtaskUrl] = useState("");
  const [newTaskDraft, setNewTaskDraft] = useState<Record<string, { title: string; url: string }>>(
    {},
  );
  const [newSubtaskDraft, setNewSubtaskDraft] = useState<
    Record<string, { title: string; url: string }>
  >({});
  const [newVisibility, setNewVisibility] = useState<ItemVisibility>("public");
  const [newPrivateSetup, setNewPrivateSetup] = useState<PrivateSetupValues>(EMPTY_PRIVATE_SETUP);
  const [bankVisibility, setBankVisibility] = useState<ItemVisibility>("public");
  const [bankPrivateSetup, setBankPrivateSetup] = useState<PrivateSetupValues>(EMPTY_PRIVATE_SETUP);
  const [unlockTarget, setUnlockTarget] = useState<{
    itemType: PrivateItemType;
    itemId: string;
  } | null>(null);
  const { isUnlocked, markUnlocked } = usePrivateUnlock();

  function isPrivateContentVisible(
    itemType: PrivateItemType,
    itemId: string,
    hasContent: boolean,
  ) {
    return isUnlocked(itemType, itemId) && hasContent;
  }

  function applyPrivateReveal(payload: PrivateUnlockPayload) {
    markUnlocked(payload.itemType, payload.itemId);
    setBoard((prev) => {
      if (payload.itemType === "activity" && payload.activity) {
        return {
          ...prev,
          activities: prev.activities.map((activity) =>
            activity.id === payload.itemId ? payload.activity! : activity,
          ),
        };
      }
      if (payload.itemType === "bank" && payload.bankItem) {
        return {
          ...prev,
          bank: (prev.bank || []).map((item) =>
            item.id === payload.itemId ? payload.bankItem! : item,
          ),
        };
      }
      return prev;
    });
  }

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    let viewer = "";
    if (meRes.ok) {
      const me = (await meRes.json()) as {
        role?: string;
        name?: string | null;
        memberId?: string | null;
      };
      setIsAdmin(me.role === "admin");
      setSessionName((me.name || "").trim());
      viewer = (me.memberId || "").trim();
      setSessionMemberId(viewer);
    }
    if (!viewer && selectedMemberId !== "all") {
      viewer = selectedMemberId;
    }
    const tasksUrl = viewer
      ? `/api/tasks?viewer=${encodeURIComponent(viewer)}`
      : "/api/tasks";
    const tasksRes = await fetch(tasksUrl, { cache: "no-store" });
    if (tasksRes.ok) {
      const data = (await tasksRes.json()) as TasksBoard;
      setBoard({
        members: (data.members || []).map((member) => normalizeMember(member)),
        activities: (data.activities || []).map((activity) =>
          normalizeActivity({ ...activity, id: activity.id }),
        ),
        bank: Array.isArray(data.bank)
          ? data.bank.map((item) => ({
              ...item,
              visibility: normalizeVisibility(item.visibility),
              createdById: item.createdById || item.ownerId || "",
            }))
          : [],
      });
    }
    setLoading(false);
  }, [selectedMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedActivities = useMemo(
    () => board.activities.filter((activity) => isActivityFullyComplete(activity)),
    [board.activities],
  );

  const activeActivities = useMemo(
    () => board.activities.filter((activity) => !isActivityFullyComplete(activity)),
    [board.activities],
  );

  const filteredActivities = useMemo(() => {
    return activeActivities.filter((activity) => {
      const matchesMember =
        selectedMemberId === "all" ||
        (activity.assigneeIds || []).includes(selectedMemberId);
      const matchesStatus =
        selectedStatus === "all" || activity.status === selectedStatus;
      return matchesMember && matchesStatus;
    });
  }, [activeActivities, selectedMemberId, selectedStatus]);

  const selectedMember =
    selectedMemberId === "all"
      ? null
      : board.members.find((member) => member.id === selectedMemberId) || null;

  const selectedStatusLabel =
    selectedStatus === "all"
      ? null
      : TASK_STATUSES.find((item) => item.value === selectedStatus)?.label ||
        selectedStatus;

  const filteredBank = useMemo(() => {
    const items = board.bank || [];
    if (selectedMemberId === "all") return items;
    return items.filter((item) => item.ownerId === selectedMemberId);
  }, [board.bank, selectedMemberId]);

  const pendingBank = useMemo(
    () => filteredBank.filter((item) => !item.convertedActivityId),
    [filteredBank],
  );
  const convertedBank = useMemo(
    () => filteredBank.filter((item) => Boolean(item.convertedActivityId)),
    [filteredBank],
  );
  /** Ideas pendientes del banco por integrante (para las tarjetas). */
  const pendingBankCountByMember = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of board.bank || []) {
      if (item.convertedActivityId) continue;
      counts[item.ownerId] = (counts[item.ownerId] || 0) + 1;
    }
    return counts;
  }, [board.bank]);
  const pendingBankTotal = useMemo(
    () =>
      Object.values(pendingBankCountByMember).reduce((sum, n) => sum + n, 0),
    [pendingBankCountByMember],
  );
  /** Actividades abiertas (no al 100 %) por integrante — para las tarjetas. */
  const activeActivityCountByMember = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const activity of activeActivities) {
      for (const id of activity.assigneeIds || []) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }, [activeActivities]);

  async function persist(next: TasksBoard, successMessage?: string) {
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
      if (successMessage) {
        toast.success(successMessage);
      } else {
        setStatusMsg("Guardado");
        window.setTimeout(() => setStatusMsg(""), 1800);
      }
      return true;
    }
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    const errorMsg = payload?.error || "Error al guardar";
    setStatusMsg(errorMsg);
    toast.error(errorMsg);
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
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error || "Error al subir la foto");
        return;
      }
      const data = (await res.json()) as { url: string };
      setMemberForm((p) => ({ ...emptyMemberForm, ...p, photo: data.url }));
      toast.success("Foto lista para el nuevo integrante");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function updateMemberPhoto(memberId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error || "Error al subir la foto");
      return;
    }
    const data = (await res.json()) as { url: string };
    const members = board.members.map((member) =>
      member.id === memberId ? { ...member, photo: data.url } : member,
    );
    const ok = await persist({ ...board, members }, "Foto del integrante actualizada");
    if (ok && editingMemberId === memberId) {
      setMemberForm((prev) => ({ ...prev, photo: data.url }));
    }
  }

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!memberForm.name.trim()) {
      toast.error("Escribe el nombre del integrante");
      return;
    }
    if (!memberForm.photo) {
      toast.error("Sube la foto del integrante");
      return;
    }

    if (editingMemberId) {
      const members = board.members.map((member) =>
        member.id === editingMemberId
          ? {
              ...member,
              name: memberForm.name.trim(),
              role: memberForm.role.trim(),
              email: memberForm.email.trim().toLowerCase(),
              photo: memberForm.photo,
              phoneCountryCode: memberForm.phoneCountryCode || "+57",
              phone: memberForm.phone.replace(/\D/g, ""),
            }
          : member,
      );
      const ok = await persist(
        { ...board, members },
        `Integrante “${memberForm.name.trim()}” actualizado`,
      );
      if (ok) {
        setMemberForm(emptyMemberForm);
        setEditingMemberId(null);
      }
      return;
    }

    const member: TeamMember = {
      id: createId("member"),
      name: memberForm.name.trim(),
      role: memberForm.role.trim(),
      email: memberForm.email.trim().toLowerCase(),
      photo: memberForm.photo,
      phoneCountryCode: memberForm.phoneCountryCode || "+57",
      phone: memberForm.phone.replace(/\D/g, ""),
      createdAt: new Date().toISOString(),
      accessRole: "member",
      canLogin: false,
      hasPassword: false,
    };
    const ok = await persist(
      { ...board, members: [...board.members, member] },
      `Integrante “${member.name}” agregado`,
    );
    if (ok) setMemberForm(emptyMemberForm);
  }

  function startEditMember(member: TeamMember) {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name || "",
      role: member.role || "",
      email: member.email || "",
      photo: member.photo || "",
      phoneCountryCode: member.phoneCountryCode || "+57",
      phone: member.phone || "",
    });
  }

  function cancelEditMember() {
    setEditingMemberId(null);
    setMemberForm(emptyMemberForm);
  }

  async function removeMember(id: string) {
    if (!window.confirm("¿Eliminar este integrante?")) return;
    const member = board.members.find((item) => item.id === id);
    const ok = await persist(
      {
        members: board.members.filter((m) => m.id !== id),
        activities: board.activities.map((activity) => ({
          ...activity,
          assigneeIds: activity.assigneeIds.filter((assigneeId) => assigneeId !== id),
        })),
        bank: (board.bank || [])
          .filter((item) => item.ownerId !== id)
          .map((item) => ({
            ...item,
            suggestedAssigneeIds: (item.suggestedAssigneeIds || []).filter(
              (assigneeId) => assigneeId !== id,
            ),
          })),
      },
      member ? `Integrante “${member.name}” eliminado` : "Integrante eliminado",
    );
    if (ok) {
      if (selectedMemberId === id) setSelectedMemberId("all");
      if (editingMemberId === id) cancelEditMember();
    }
  }

  function openCreateModal() {
    const defaultAssignee =
      selectedMemberId !== "all" ? selectedMemberId : board.members[0]?.id || "";
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    setConvertingBankId(null);
    setNewAssigneeIds(defaultAssignee ? [defaultAssignee] : []);
    setNewTitle("");
    setNewDate(start);
    setNewEndDate(end.toISOString().slice(0, 10));
    setNewFirstTask("");
    setNewFirstSubtask("");
    setNewFirstSubtaskUrl("");
    resetNewPrivateForm();
    setShowCreateModal(true);
  }

  function toggleNewAssignee(memberId: string) {
    setNewAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }

  function toggleActivityAssignee(activityId: string, memberId: string) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const current = activity.assigneeIds || [];
    const next = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId];
    if (!next.length) {
      toast.error("La actividad debe tener al menos una persona asignada");
      return;
    }
    updateActivity(activityId, { assigneeIds: next }, "Asignación actualizada");
  }

  function resolveCreatorId(fallbackId: string) {
    return sessionMemberId || fallbackId;
  }

  function resetNewPrivateForm() {
    setNewVisibility("public");
    setNewPrivateSetup(EMPTY_PRIVATE_SETUP);
  }

  function resetBankPrivateForm() {
    setBankVisibility("public");
    setBankPrivateSetup(EMPTY_PRIVATE_SETUP);
  }

  async function setupPrivateItem(
    itemType: PrivateItemType,
    itemId: string,
    values: PrivateSetupValues,
  ) {
    const res = await fetch("/api/tasks/private/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType,
        itemId,
        pin: values.pin,
        motherName: values.motherName,
        petName: values.petName,
        birthYear: values.birthYear,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error || "No se pudo guardar la clave privada");
    }
  }

  async function copyPrivateItemAuth(
    fromType: PrivateItemType,
    fromId: string,
    toType: PrivateItemType,
    toId: string,
  ) {
    const res = await fetch("/api/tasks/private/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromType, fromId, toType, toId }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error || "No se pudo copiar la clave privada");
    }
  }

  async function createActivity(event: FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Escribe el título de la actividad");
      return;
    }
    if (!newAssigneeIds.length) {
      toast.error("Selecciona al menos una persona o un grupo");
      return;
    }
    if (!newEndDate) {
      toast.error("Indica la fecha de fin");
      return;
    }
    if (newEndDate < newDate) {
      toast.error("La fecha de fin no puede ser anterior al inicio");
      return;
    }

    const sourceBankItem = convertingBankId
      ? (board.bank || []).find((item) => item.id === convertingBankId)
      : null;
    const sourceBankPrivate = sourceBankItem?.visibility === "private";

    if (newVisibility === "private" && !sourceBankPrivate) {
      const validation = validatePrivateSetup(newPrivateSetup);
      if (validation) {
        toast.error(validation);
        return;
      }
    }

    const now = new Date().toISOString();
    const activityId = createId("activity");
    const tasks: Task[] = [];

    if (newFirstTask.trim()) {
      const taskId = createId("task");
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
      tasks.push({
        id: taskId,
        activityId,
        title: newFirstTask.trim(),
        status: "waiting",
        done: false,
        url: "",
        subtasks,
      });
    }

    const activity: Activity = {
      id: activityId,
      title: newTitle.trim(),
      date: newDate,
      finishedDate: newEndDate,
      processUrl: "",
      deliverableUrl: "",
      status: "waiting",
      assigneeIds: [...newAssigneeIds],
      tasks,
      notes: [],
      reviewMessages: [],
      createdAt: now,
      updatedAt: now,
      visibility: newVisibility,
      createdById: resolveCreatorId(newAssigneeIds[0] || ""),
    };

    const nextBank =
      convertingBankId
        ? (board.bank || []).map((item) =>
            item.id === convertingBankId
              ? {
                  ...item,
                  convertedActivityId: activityId,
                  updatedAt: now,
                }
              : item,
          )
        : board.bank || [];

    const ok = await persist(
      {
        ...board,
        activities: [activity, ...board.activities],
        bank: nextBank,
      },
      convertingBankId
        ? `Actividad “${activity.title}” creada desde el banco`
        : `Actividad “${activity.title}” creada`,
    );
    if (ok) {
      if (activity.visibility === "private") {
        try {
          if (convertingBankId && sourceBankPrivate) {
            await copyPrivateItemAuth("bank", convertingBankId, "activity", activityId);
          } else {
            await setupPrivateItem("activity", activityId, newPrivateSetup);
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo configurar la clave privada",
          );
        }
      }
      resetNewPrivateForm();
      setShowCreateModal(false);
      setConvertingBankId(null);
      if (newAssigneeIds.length === 1) {
        setSelectedMemberId(newAssigneeIds[0]);
      }
      if (activity.tasks.length) setExpandedActivityId(activity.id);
    }
  }

  async function addBankItem(event: FormEvent) {
    event.preventDefault();
    const ownerId =
      selectedMemberId !== "all" ? selectedMemberId : bankOwnerId;
    if (!ownerId) {
      toast.error("Selecciona un integrante para el banco de tareas");
      return;
    }
    if (!bankTitle.trim()) {
      toast.error("Escribe qué hay que hacer / la actividad propuesta");
      return;
    }
    if (bankVisibility === "private") {
      const validation = validatePrivateSetup(bankPrivateSetup);
      if (validation) {
        toast.error(validation);
        return;
      }
    }
    const now = new Date().toISOString();
    const item: TaskBankItem = {
      id: createId("bank"),
      title: bankTitle.trim(),
      notes: bankNotes.trim(),
      ownerId,
      suggestedAssigneeIds: [ownerId],
      convertedActivityId: null,
      createdAt: now,
      updatedAt: now,
      visibility: bankVisibility,
      createdById: resolveCreatorId(ownerId),
    };
    const ok = await persist(
      { ...board, bank: [item, ...(board.bank || [])] },
      "Idea agregada al banco",
    );
    if (ok) {
      if (item.visibility === "private") {
        try {
          await setupPrivateItem("bank", item.id, bankPrivateSetup);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo configurar la clave privada",
          );
        }
      }
      resetBankPrivateForm();
      setBankTitle("");
      setBankNotes("");
    }
  }

  function startEditBankItem(item: TaskBankItem) {
    setViewingBankId(null);
    setEditingBankId(item.id);
    setEditingBankTitle(item.title);
    setEditingBankNotes(item.notes);
  }

  function cancelEditBankItem() {
    setEditingBankId(null);
    setEditingBankTitle("");
    setEditingBankNotes("");
  }

  async function saveBankItemEdit(id: string) {
    if (!editingBankTitle.trim()) {
      toast.error("Escribe un título para la idea");
      return;
    }
    const now = new Date().toISOString();
    const ok = await persist(
      {
        ...board,
        bank: (board.bank || []).map((item) =>
          item.id === id
            ? {
                ...item,
                title: editingBankTitle.trim(),
                notes: editingBankNotes.trim(),
                updatedAt: now,
              }
            : item,
        ),
      },
      "Idea actualizada en el banco",
    );
    if (ok) cancelEditBankItem();
  }

  async function removeBankItem(id: string) {
    if (!window.confirm("¿Eliminar esta idea del banco?")) return;
    await persist(
      { ...board, bank: (board.bank || []).filter((item) => item.id !== id) },
      "Idea eliminada del banco",
    );
  }

  function startConvertBankItem(item: TaskBankItem) {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    setConvertingBankId(item.id);
    setNewTitle(item.title);
    setNewAssigneeIds(
      item.suggestedAssigneeIds.length
        ? item.suggestedAssigneeIds
        : item.ownerId
          ? [item.ownerId]
          : [],
    );
    setNewDate(start);
    setNewEndDate(end.toISOString().slice(0, 10));
    setNewFirstTask("");
    setNewFirstSubtask("");
    setNewFirstSubtaskUrl("");
    setNewVisibility(item.visibility === "private" ? "private" : "public");
    setNewPrivateSetup(EMPTY_PRIVATE_SETUP);
    setShowCreateModal(true);
  }

  function updateActivity(
    activityId: string,
    patch: Partial<Activity>,
    successMessage?: string,
  ) {
    const nextBoard: TasksBoard = {
      ...board,
      activities: board.activities.map((activity) =>
        activity.id === activityId
          ? { ...activity, ...patch, updatedAt: new Date().toISOString() }
          : activity,
      ),
    };
    // Actualiza la UI de inmediato (progreso / estado) y luego persiste.
    setBoard(nextBoard);
    void persist(nextBoard, successMessage);
  }

  function removeActivity(activityId: string) {
    if (!window.confirm("¿Eliminar esta actividad?")) return;
    const activity = board.activities.find((item) => item.id === activityId);
    void persist(
      {
        ...board,
        activities: board.activities.filter((item) => item.id !== activityId),
      },
      activity ? `Actividad “${activity.title}” eliminada` : "Actividad eliminada",
    );
  }

  function addNote(activityId: string) {
    const text = (noteDrafts[activityId] || "").trim();
    if (!text) {
      toast.error("Escribe la nota");
      return;
    }
    const note: TaskNote = {
      id: createId("note"),
      text,
      createdAt: new Date().toISOString(),
    };
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    updateActivity(activityId, { notes: [note, ...(activity.notes || [])] }, "Nota agregada");
    setNoteDrafts((prev) => ({ ...prev, [activityId]: "" }));
    setNotesOpenId(activityId);
  }

  function removeNote(activityId: string, noteId: string) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    updateActivity(
      activityId,
      { notes: (activity.notes || []).filter((note) => note.id !== noteId) },
      "Nota eliminada",
    );
  }

  function addTask(activityId: string) {
    const draft = newTaskDraft[activityId] || { title: "", url: "" };
    const title = draft.title.trim();
    if (!title) {
      toast.error("Escribe el título de la tarea");
      return;
    }
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    updateActivity(
      activityId,
      {
        tasks: [
          ...activity.tasks,
          {
            id: createId("task"),
            activityId,
            title,
            status: "waiting",
            done: false,
            url: draft.url.trim(),
            subtasks: [],
          },
        ],
      },
      "Tarea agregada",
    );
    setNewTaskDraft((prev) => ({ ...prev, [activityId]: { title: "", url: "" } }));
    setExpandedActivityId(activityId);
  }

  function removeTask(activityId: string, taskId: string) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const nextTasks = activity.tasks.filter((item) => item.id !== taskId);
    const derived = deriveActivityStatusFromTasks(nextTasks);
    updateActivity(
      activityId,
      {
        tasks: nextTasks,
        ...(derived && derived !== activity.status ? { status: derived } : {}),
      },
      "Tarea eliminada",
    );
    if (expandedTaskId === taskId) setExpandedTaskId(null);
  }

  function updateTaskFields(
    activityId: string,
    taskId: string,
    patch: Partial<Task>,
    successMessage?: string,
  ) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const nextTasks = activity.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const next = { ...task, ...patch };
      if (patch.status) {
        next.status = patch.status;
        next.done = patch.status === "done";
      }
      return next;
    });
    updateActivity(activityId, { tasks: nextTasks }, successMessage);
  }

  function beginPendingReview(
    activity: Activity,
    nextTasks: Task[],
    nextStatus: TaskStatus = "pending_review",
  ) {
    setReviewRevert({
      activityId: activity.id,
      status: activity.status,
      tasks: activity.tasks.map((task) => ({
        ...task,
        subtasks: task.subtasks.map((sub) => ({ ...sub })),
      })),
    });
    setBoard((prev) => ({
      ...prev,
      activities: prev.activities.map((item) =>
        item.id === activity.id
          ? {
              ...item,
              status: nextStatus,
              tasks: nextTasks,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    }));
    toast.info("Confirma el aviso de revisión o cierra para cancelar");
    window.setTimeout(() => setReviewModalActivityId(activity.id), 0);
  }

  function maybeOpenDoneModal(activityId: string, previousStatus: TaskStatus, nextStatus: TaskStatus | null) {
    if (nextStatus === "done" && previousStatus !== "done") {
      window.setTimeout(() => {
        setExpandedActivityId(null);
        setCompleteActivityId(activityId);
      }, 0);
    }
  }

  function setTaskStatus(activityId: string, taskId: string, status: TaskStatus) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const task = activity.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const label = TASK_STATUSES.find((item) => item.value === status)?.label || status;
    const nextTasks = activity.tasks.map((item) => {
      if (item.id !== taskId) return item;
      const nextSubtasks =
        status === "done" && item.subtasks.length
          ? item.subtasks.map((sub) => ({
              ...sub,
              status: "done" as TaskStatus,
              done: true,
            }))
          : item.subtasks;
      return {
        ...item,
        status,
        done: status === "done",
        subtasks: nextSubtasks,
      };
    });
    const derivedActivity = deriveActivityStatusFromTasks(nextTasks);

    if (
      derivedActivity === "pending_review" &&
      activity.status !== "pending_review"
    ) {
      beginPendingReview(activity, nextTasks, "pending_review");
      return;
    }

    const activityLabel = derivedActivity
      ? TASK_STATUSES.find((item) => item.value === derivedActivity)?.label
      : null;
    const message =
      activityLabel && derivedActivity && derivedActivity !== activity.status
        ? `Tarea: ${label} · Actividad: ${activityLabel}`
        : `Tarea: ${label}`;

    updateActivity(
      activityId,
      {
        tasks: nextTasks,
        ...(derivedActivity ? { status: derivedActivity } : {}),
      },
      message,
    );
    maybeOpenDoneModal(activityId, activity.status, derivedActivity);
  }

  function updateSubtask(
    activityId: string,
    taskId: string,
    subtaskId: string,
    patch: Partial<Subtask>,
    successMessage?: string,
  ) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const task = activity.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const statusLabel = patch.status
      ? TASK_STATUSES.find((item) => item.value === patch.status)?.label
      : null;

    const nextSubtasks = task.subtasks.map((item) => {
      if (item.id !== subtaskId) return item;
      const next = { ...item, ...patch };
      if (patch.status) {
        next.status = patch.status;
        next.done = patch.status === "done";
      }
      return next;
    });

    const derivedTaskStatus = patch.status
      ? deriveTaskStatusFromSubtasks(nextSubtasks)
      : null;

    const nextTasks = activity.tasks.map((item) => {
      if (item.id !== taskId) return item;
      return {
        ...item,
        subtasks: nextSubtasks,
        ...(derivedTaskStatus
          ? { status: derivedTaskStatus, done: derivedTaskStatus === "done" }
          : {}),
      };
    });

    const derivedActivityStatus = deriveActivityStatusFromTasks(nextTasks);

    if (
      derivedActivityStatus === "pending_review" &&
      activity.status !== "pending_review"
    ) {
      beginPendingReview(activity, nextTasks, "pending_review");
      return;
    }

    const taskStatusLabel = derivedTaskStatus
      ? TASK_STATUSES.find((item) => item.value === derivedTaskStatus)?.label
      : null;
    const activityStatusLabel = derivedActivityStatus
      ? TASK_STATUSES.find((item) => item.value === derivedActivityStatus)?.label
      : null;

    let message: string | undefined = successMessage;
    if (!message && statusLabel) {
      const parts = [`Subtarea: ${statusLabel}`];
      if (taskStatusLabel && derivedTaskStatus && derivedTaskStatus !== task.status) {
        parts.push(`Tarea: ${taskStatusLabel}`);
      }
      if (
        activityStatusLabel &&
        derivedActivityStatus &&
        derivedActivityStatus !== activity.status
      ) {
        parts.push(`Actividad: ${activityStatusLabel}`);
      }
      message = parts.join(" · ");
    }

    updateActivity(
      activityId,
      {
        tasks: nextTasks,
        ...(derivedActivityStatus ? { status: derivedActivityStatus } : {}),
      },
      message,
    );
    maybeOpenDoneModal(activityId, activity.status, derivedActivityStatus);
  }

  function addSubtask(activityId: string, taskId: string) {
    const draft = newSubtaskDraft[taskId] || { title: "", url: "" };
    const title = draft.title.trim();
    if (!title) {
      toast.error("Escribe el título de la subtarea");
      return;
    }
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const task = activity.tasks.find((item) => item.id === taskId);
    if (!task) return;

    updateTaskFields(
      activityId,
      taskId,
      {
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
      },
      "Subtarea agregada",
    );
    setNewSubtaskDraft((prev) => ({ ...prev, [taskId]: { title: "", url: "" } }));
    setExpandedTaskId(taskId);
  }

  function removeSubtask(activityId: string, taskId: string, subtaskId: string) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const task = activity.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const nextSubtasks = task.subtasks.filter((item) => item.id !== subtaskId);
    const derivedTask = deriveTaskStatusFromSubtasks(nextSubtasks);
    const nextTasks = activity.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            subtasks: nextSubtasks,
            ...(derivedTask ? { status: derivedTask, done: derivedTask === "done" } : {}),
          }
        : item,
    );
    const derivedActivity = deriveActivityStatusFromTasks(nextTasks);
    updateActivity(
      activityId,
      {
        tasks: nextTasks,
        ...(derivedActivity && derivedActivity !== activity.status
          ? { status: derivedActivity }
          : {}),
      },
      "Subtarea eliminada",
    );
  }

  function setActivityStatus(activityId: string, status: TaskStatus) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const label = TASK_STATUSES.find((item) => item.value === status)?.label || status;

    if (status === "pending_review" && activity.status !== "pending_review") {
      beginPendingReview(activity, activity.tasks, "pending_review");
      return;
    }

    setReviewRevert(null);
    updateActivity(activityId, { status }, `Estado: ${label}`);
    if (status === "done") {
      window.setTimeout(() => {
        setExpandedActivityId(null);
        setCompleteActivityId(activityId);
      }, 0);
    }
  }

  async function handleAssistantCreate(
    activity: Activity,
    privateSetup?: PrivateSetupValues,
  ) {
    const ok = await persist(
      {
        ...board,
        activities: [activity, ...board.activities],
      },
      `Actividad “${activity.title}” creada`,
    );
    if (ok) {
      if (activity.visibility === "private" && privateSetup) {
        try {
          await setupPrivateItem("activity", activity.id, privateSetup);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo configurar la clave privada",
          );
        }
      }
      setTab("tasks");
      setViewMode("list");
      if (activity.assigneeIds.length === 1) {
        setSelectedMemberId(activity.assigneeIds[0]);
      }
      if (activity.tasks.length) setExpandedActivityId(activity.id);
    }
    return ok;
  }

  async function handleAssistantConvertFromBank(
    bankItemId: string,
    activity: Activity,
    privateSetup?: PrivateSetupValues,
  ) {
    const sourceBankItem = (board.bank || []).find((item) => item.id === bankItemId);
    const now = new Date().toISOString();
    const nextBank = (board.bank || []).map((item) =>
      item.id === bankItemId
        ? {
            ...item,
            convertedActivityId: activity.id,
            updatedAt: now,
          }
        : item,
    );
    const ok = await persist(
      {
        ...board,
        activities: [activity, ...board.activities],
        bank: nextBank,
      },
      `Actividad “${activity.title}” creada desde el banco`,
    );
    if (ok) {
      if (activity.visibility === "private") {
        try {
          if (sourceBankItem?.visibility === "private") {
            await copyPrivateItemAuth("bank", bankItemId, "activity", activity.id);
          } else if (privateSetup) {
            await setupPrivateItem("activity", activity.id, privateSetup);
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo configurar la clave privada",
          );
        }
      }
      setTab("tasks");
      setViewMode("list");
      if (activity.assigneeIds.length === 1) {
        setSelectedMemberId(activity.assigneeIds[0]);
      }
      if (activity.tasks.length) setExpandedActivityId(activity.id);
    }
    return ok;
  }

  async function handleAssistantUpdate(input: {
    activityId: string;
    status: TaskStatus;
    note: string;
    tasks: Task[];
  }) {
    const activity = board.activities.find((item) => item.id === input.activityId);
    if (!activity) return false;

    const normalizedTasks = input.tasks.map((task) =>
      normalizeTask({ ...task, activityId: input.activityId }, input.activityId),
    );

    const notes =
      input.note.trim().length > 0
        ? [
            {
              id: createId("note"),
              text: input.note.trim(),
              createdAt: new Date().toISOString(),
            } satisfies TaskNote,
            ...(activity.notes || []),
          ]
        : activity.notes || [];

    if (input.status === "pending_review" && activity.status !== "pending_review") {
      if (input.note.trim()) {
        const okNotes = await persist({
          ...board,
          activities: board.activities.map((item) =>
            item.id === activity.id
              ? {
                  ...item,
                  tasks: normalizedTasks,
                  notes,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        });
        if (!okNotes) return false;
      }
      beginPendingReview(
        { ...activity, notes, tasks: normalizedTasks },
        normalizedTasks,
        "pending_review",
      );
      return true;
    }

    const label =
      TASK_STATUSES.find((item) => item.value === input.status)?.label || input.status;
    const ok = await persist(
      {
        ...board,
        activities: board.activities.map((item) =>
          item.id === activity.id
            ? {
                ...item,
                status: input.status,
                tasks: normalizedTasks,
                notes,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      },
      input.note.trim()
        ? `Avance guardado · ${label} · nota agregada`
        : `Avance guardado · ${label}`,
    );
    if (ok) {
      setExpandedActivityId(activity.id);
    }
    if (ok && input.status === "done") {
      window.setTimeout(() => {
        setExpandedActivityId(null);
        setCompleteActivityId(activity.id);
      }, 0);
    }
    return ok;
  }

  function closeReviewModal() {
    if (reviewRevert && reviewRevert.activityId === reviewModalActivityId) {
      const previousLabel =
        TASK_STATUSES.find((item) => item.value === reviewRevert.status)?.label ||
        reviewRevert.status;
      setBoard((prev) => ({
        ...prev,
        activities: prev.activities.map((activity) =>
          activity.id === reviewRevert.activityId
            ? {
                ...activity,
                status: reviewRevert.status,
                tasks: reviewRevert.tasks,
                updatedAt: new Date().toISOString(),
              }
            : activity,
        ),
      }));
      toast.info(`Revisión cancelada · vuelve a ${previousLabel}`);
    }
    setReviewRevert(null);
    setReviewModalActivityId(null);
  }

  function saveReviewMessage(activityId: string, message: ReviewMessage) {
    const snapshot = board.activities.find((activity) => activity.id === activityId);
    setReviewRevert(null);
    setReviewModalActivityId(null);
    setBoard((prev) => {
      const next: TasksBoard = {
        ...prev,
        activities: prev.activities.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                status: "pending_review",
                tasks: snapshot?.tasks || activity.tasks,
                reviewMessages: [message, ...(activity.reviewMessages || [])],
                updatedAt: new Date().toISOString(),
              }
            : activity,
        ),
      };
      void persist(next, "Mensaje de revisión guardado");
      return next;
    });
    setReviewHistoryOpenId(activityId);
  }

  function recordReviewResponse(activityId: string, value: ReviewResponseValue) {
    const activity = board.activities.find((item) => item.id === activityId);
    if (!activity) return;

    const respondedBy = sessionName.trim() || "Equipo";
    const now = new Date().toISOString();
    const label = reviewResponseLabel(value);
    let messages = [...(activity.reviewMessages || [])];

    if (!messages.length) {
      const assigneeNames = (activity.assigneeIds || [])
        .map((id) => board.members.find((member) => member.id === id)?.name)
        .filter(Boolean) as string[];
      messages = [
        {
          id: createId("review"),
          recipientIds: [...(activity.assigneeIds || [])],
          recipientNames: assigneeNames,
          body: "",
          url: activity.processUrl || activity.deliverableUrl || "",
          fullText: "Respuesta registrada en el panel (sin mensaje WhatsApp previo).",
          createdAt: now,
          channel: "copied",
          response: value,
          responseAt: now,
          responseBy: respondedBy,
        },
      ];
    } else {
      messages = messages.map((message, index) =>
        index === 0
          ? {
              ...message,
              response: value,
              responseAt: now,
              responseBy: respondedBy,
            }
          : message,
      );
    }

    updateActivity(
      activityId,
      { reviewMessages: messages },
      `Respuesta de revisión: ${label}`,
    );
    setReviewHistoryOpenId(activityId);
  }

  function openDeliveryModal(activity: Activity) {
    if (activity.status !== "done") return;
    setExpandedActivityId(null);
    setCompleteActivityId(activity.id);
  }

  function saveDeliveryUrls(urls: { processUrl: string; deliverableUrl: string }) {
    if (!completeActivityId) return;
    const activityId = completeActivityId;
    void persist(
      {
        ...board,
        activities: board.activities.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                processUrl: urls.processUrl,
                deliverableUrl: urls.deliverableUrl,
                status: "done",
                updatedAt: new Date().toISOString(),
              }
            : activity,
        ),
      },
      "Entrega guardada",
    ).then((ok) => {
      if (ok) setCompleteActivityId(null);
    });
  }

  function shareCompletedActivityOnWhatsApp(activity: Activity) {
    const people = (activity.assigneeIds || [])
      .map((id) => board.members.find((m) => m.id === id)?.name)
      .filter(Boolean) as string[];
    const who =
      people.length === 0
        ? "el equipo"
        : people.length === 1
          ? people[0]
          : people.slice(0, -1).join(", ") + " y " + people[people.length - 1];

    const lines = [
      "¡Hola equipo! 🎉",
      "",
      `${who} terminó la actividad:`,
      `“${activity.title}”`,
      "",
    ];

    if (activity.processUrl) {
      lines.push(`🔗 URL del proceso:`, activity.processUrl, "");
    }
    if (activity.deliverableUrl) {
      lines.push(`📦 URL del entregable:`, activity.deliverableUrl, "");
    }
    if (!activity.processUrl && !activity.deliverableUrl) {
      lines.push("(Aún no hay links de proceso ni entregable.)", "");
    }

    lines.push("¡Gran trabajo! ✨", "", "— Inspiralab");

    const text = lines.join("\n");
    const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    toast.success("Mensaje listo para compartir por WhatsApp");
  }

  function renderActivityCards(activities: Activity[]) {
    return activities.map((activity) => {
                        if (
                          activity.visibility === "private" &&
                          !isPrivateContentVisible(
                            "activity",
                            activity.id,
                            Boolean(activity.title.trim()),
                          )
                        ) {
                          return (
                            <PrivateLockedCard
                              key={activity.id}
                              kind="actividad"
                              onUnlock={() =>
                                setUnlockTarget({
                                  itemType: "activity",
                                  itemId: activity.id,
                                })
                              }
                            />
                          );
                        }

                        const progress = getActivityProgress(activity);
                        const reviewState = latestReviewResponse(activity.reviewMessages);
                        const expanded = expandedActivityId === activity.id;
                        const canComplete = activity.status === "done";
                        const statusColor =
                          TASK_STATUS_COLORS[activity.status] || TASK_STATUS_COLORS.waiting;
                        const assignees = (activity.assigneeIds || [])
                          .map((id) => board.members.find((m) => m.id === id))
                          .filter(Boolean) as TeamMember[];

                        return (
                          <article
                            key={activity.id}
                            className="border border-[color:var(--line)] bg-white"
                          >
                            <div className="p-4 md:p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <TaskSemaphore color={statusColor.bg} />
                                    <input
                                      aria-label="Título de la actividad"
                                      defaultValue={str(activity.title)}
                                      key={`activity-title-${activity.id}-${activity.updatedAt}`}
                                      onBlur={(e) => {
                                        const title = e.target.value.trim();
                                        if (!title) {
                                          e.target.value = activity.title;
                                          toast.error("El título de la actividad no puede quedar vacío");
                                          return;
                                        }
                                        if (title !== activity.title) {
                                          updateActivity(
                                            activity.id,
                                            { title },
                                            "Actividad actualizada",
                                          );
                                        }
                                      }}
                                      className="min-w-0 flex-1 border border-transparent bg-transparent px-1 font-[family-name:var(--font-display)] text-lg font-bold outline-none hover:border-[color:var(--line)] focus:border-[color:var(--accent)]"
                                    />
                                    <span
                                      className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                      style={{
                                        backgroundColor: statusColor.bg,
                                        color: statusColor.text,
                                      }}
                                    >
                                      {statusColor.label}
                                    </span>
                                    {activity.visibility === "private" ? (
                                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#1e293b] text-white">
                                        Privada
                                      </span>
                                    ) : null}
                                    {assignees.length > 0 ? (
                                      <div
                                        className="flex items-center gap-2"
                                        title={assignees.map((m) => m.name).join(", ")}
                                      >
                                        {assignees.slice(0, 4).map((member) => (
                                          <MemberAvatar
                                            key={member.id}
                                            name={member.name}
                                            photo={member.photo}
                                          />
                                        ))}
                                        {assignees.length > 4 ? (
                                          <span className="text-[10px] font-semibold text-[color:var(--muted)]">
                                            +{assignees.length - 4}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-4">
                                    <label className="space-y-1 text-sm text-[color:var(--muted)]">
                                      <span className="block text-[10px] font-semibold uppercase">
                                        Estado de la actividad
                                      </span>
                                      <select
                                        value={str(activity.status) || "waiting"}
                                        onChange={(e) =>
                                          setActivityStatus(
                                            activity.id,
                                            e.target.value as TaskStatus,
                                          )
                                        }
                                        className={`border border-[color:var(--line)] px-2 py-1.5 text-sm font-semibold ${
                                          STATUS_STYLES[activity.status] || STATUS_STYLES.waiting
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
                                        value={str(activity.date)}
                                        onChange={(e) =>
                                          updateActivity(activity.id, { date: e.target.value })
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
                                        value={str(activity.finishedDate)}
                                        onChange={(e) =>
                                          updateActivity(activity.id, {
                                            finishedDate: e.target.value,
                                          })
                                        }
                                        className="border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
                                      />
                                    </label>
                                    <div className="space-y-1 text-sm text-[color:var(--muted)] md:col-span-2">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="block text-[10px] font-semibold uppercase">
                                          Quién la hace
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingAssigneesActivityId((prev) =>
                                              prev === activity.id ? null : activity.id,
                                            )
                                          }
                                          className="text-[11px] font-semibold text-[color:var(--accent)]"
                                        >
                                          {editingAssigneesActivityId === activity.id
                                            ? "Listo"
                                            : "Agregar o quitar"}
                                        </button>
                                      </div>
                                      {assignees.length === 0 ? (
                                        <p className="text-xs text-[color:var(--muted)]">
                                          Sin personas asignadas
                                        </p>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {assignees.map((member) => (
                                            <div
                                              key={member.id}
                                              className="flex items-center gap-2 border border-[color:var(--line)] bg-white px-2 py-1.5"
                                            >
                                              <MemberAvatar
                                                name={member.name}
                                                photo={member.photo}
                                              />
                                              <span className="text-xs font-semibold text-[color:var(--ink)]">
                                                {member.name}
                                              </span>
                                              {editingAssigneesActivityId === activity.id ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    toggleActivityAssignee(
                                                      activity.id,
                                                      member.id,
                                                    )
                                                  }
                                                  className="text-[11px] font-semibold text-[color:var(--accent)]"
                                                  title="Quitar de la actividad"
                                                >
                                                  Quitar
                                                </button>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {editingAssigneesActivityId === activity.id ? (
                                        <div className="mt-2 space-y-2 border border-dashed border-[color:var(--line)] p-3">
                                          <p className="text-[11px] text-[color:var(--muted)]">
                                            Toca para agregar a alguien del equipo:
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            {board.members
                                              .filter(
                                                (member) =>
                                                  !(activity.assigneeIds || []).includes(
                                                    member.id,
                                                  ),
                                              )
                                              .map((member) => (
                                                <button
                                                  key={member.id}
                                                  type="button"
                                                  onClick={() =>
                                                    toggleActivityAssignee(
                                                      activity.id,
                                                      member.id,
                                                    )
                                                  }
                                                  className="flex items-center gap-2 border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-left hover:border-[color:var(--accent)]"
                                                >
                                                  <MemberAvatar
                                                    name={member.name}
                                                    photo={member.photo}
                                                  />
                                                  <span className="text-xs font-semibold text-[color:var(--ink)]">
                                                    {member.name}
                                                  </span>
                                                  <span className="text-[11px] font-semibold text-[color:var(--accent)]">
                                                    +
                                                  </span>
                                                </button>
                                              ))}
                                            {board.members.every((member) =>
                                              (activity.assigneeIds || []).includes(member.id),
                                            ) ? (
                                              <p className="text-xs text-[color:var(--muted)]">
                                                Todo el equipo ya está en esta actividad.
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="mb-1 flex justify-between text-xs font-semibold">
                                      <span className="text-[color:var(--muted)]">Progreso</span>
                                      <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 bg-[color:var(--mist)]">
                                      <div
                                        className="h-full bg-[color:var(--accent)] transition-all"
                                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                      />
                                    </div>
                                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                                      {!activity.tasks.length
                                        ? "Sin tareas: el avance sigue el estado de la actividad."
                                        : "Cada tarea y subtarea Terminada suma al porcentaje."}
                                    </p>
                                  </div>

                                  {activity.status === "pending_review" && (
                                    <ReviewResponsePanel
                                      currentResponse={reviewState?.value}
                                      respondedBy={reviewState?.by}
                                      respondedAt={reviewState?.at}
                                      disabled={saving}
                                      onRecord={(value) =>
                                        recordReviewResponse(activity.id, value)
                                      }
                                    />
                                  )}

                                  {activity.status === "done" && (
                                    <div className="space-y-2 border border-[color:var(--line)] bg-[color:var(--mist)] px-3 py-2.5">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                                        Entrega terminada
                                      </p>
                                      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-4">
                                        {activity.processUrl ? (
                                          <a
                                            href={activity.processUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                                          >
                                            URL del proceso
                                          </a>
                                        ) : (
                                          <span className="text-sm text-[color:var(--muted)]">
                                            Sin URL del proceso
                                          </span>
                                        )}
                                        {activity.deliverableUrl ? (
                                          <a
                                            href={activity.deliverableUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                                          >
                                            URL del entregable
                                          </a>
                                        ) : (
                                          <span className="text-sm text-[color:var(--muted)]">
                                            Sin URL del entregable
                                          </span>
                                        )}
                                      </div>
                                      {(!activity.processUrl || !activity.deliverableUrl) && (
                                        <button
                                          type="button"
                                          onClick={() => openDeliveryModal(activity)}
                                          className="text-xs font-semibold text-[color:var(--accent)]"
                                        >
                                          Completar URLs de entrega
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          shareCompletedActivityOnWhatsApp(activity)
                                        }
                                        className="inline-flex items-center gap-1.5 bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"
                                      >
                                        Compartir por WhatsApp
                                      </button>
                                    </div>
                                  )}
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
                                    onClick={() => openDeliveryModal(activity)}
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
                                    onClick={() =>
                                      setNotesOpenId(
                                        notesOpenId === activity.id ? null : activity.id,
                                      )
                                    }
                                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                  >
                                    Notas ({(activity.notes || []).length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (activity.status !== "pending_review") {
                                        setActivityStatus(activity.id, "pending_review");
                                      } else {
                                        setReviewModalActivityId(activity.id);
                                      }
                                    }}
                                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                  >
                                    Avisar revisión
                                  </button>
                                  {(activity.reviewMessages || []).length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReviewHistoryOpenId(
                                          reviewHistoryOpenId === activity.id
                                            ? null
                                            : activity.id,
                                        )
                                      }
                                      className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                    >
                                      Historial ({(activity.reviewMessages || []).length})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedActivityId(expanded ? null : activity.id)
                                    }
                                    className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                  >
                                    {activity.tasks.length
                                      ? `Tareas (${activity.tasks.length})`
                                      : "Agregar tareas"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeActivity(activity.id)}
                                    className="text-xs font-semibold text-[color:var(--accent)]"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            </div>

                            {notesOpenId === activity.id && (
                              <div className="border-t border-[color:var(--line)] p-4">
                                <h4 className="text-sm font-bold">Notas de la actividad</h4>
                                <p className="mt-1 text-xs text-[color:var(--muted)]">
                                  Registra pendientes u observaciones. Cada nota guarda la fecha
                                  en que se escribió.
                                </p>

                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <textarea
                                    rows={2}
                                    placeholder="Escribe una nota..."
                                    value={noteDrafts[activity.id] || ""}
                                    onChange={(e) =>
                                      setNoteDrafts((prev) => ({
                                        ...prev,
                                        [activity.id]: e.target.value,
                                      }))
                                    }
                                    className="min-w-0 flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addNote(activity.id)}
                                    className="shrink-0 bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
                                  >
                                    Agregar nota
                                  </button>
                                </div>

                                {(activity.notes || []).length === 0 ? (
                                  <p className="mt-4 text-sm text-[color:var(--muted)]">
                                    Aún no hay notas en esta actividad.
                                  </p>
                                ) : (
                                  <ul className="mt-4 space-y-2">
                                    {(activity.notes || []).map((note) => (
                                      <li
                                        key={note.id}
                                        className="border border-[color:var(--line)] bg-[color:var(--mist)] px-3 py-2"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                                              {formatNoteDate(note.createdAt)}
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--ink)]">
                                              {note.text}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => removeNote(activity.id, note.id)}
                                            className="shrink-0 text-xs font-semibold text-[color:var(--accent)]"
                                          >
                                            Quitar
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            {reviewHistoryOpenId === activity.id && (
                              <div className="border-t border-[color:var(--line)] p-4">
                                <h4 className="text-sm font-bold">Historial de revisión</h4>
                                <p className="mt-1 text-xs text-[color:var(--muted)]">
                                  Mensajes enviados o copiados para pedir revisión al equipo.
                                </p>
                                <ul className="mt-3 space-y-3">
                                  {(activity.reviewMessages || []).map((message) => (
                                    <li
                                      key={message.id}
                                      className="border border-[color:var(--line)] bg-[color:var(--mist)] px-3 py-2"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                                          {formatNoteDate(message.createdAt)} ·{" "}
                                          {message.channel === "whatsapp"
                                            ? "WhatsApp"
                                            : "Texto copiado"}
                                        </p>
                                        <p className="text-xs text-[color:var(--muted)]">
                                          Para:{" "}
                                          {message.recipientNames.join(", ") ||
                                            "Sin destinatarios"}
                                        </p>
                                      </div>
                                      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-[color:var(--ink)]">
                                        {message.fullText}
                                      </pre>
                                      {message.response ? (
                                        <p className="mt-2 text-xs font-semibold text-[color:var(--accent)]">
                                          Respuesta: {reviewResponseLabel(message.response)}
                                          {message.responseBy
                                            ? ` · ${message.responseBy}`
                                            : ""}
                                          {message.responseAt
                                            ? ` · ${formatNoteDate(message.responseAt)}`
                                            : ""}
                                        </p>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {expanded && (
                              <div className="border-t border-[color:var(--line)] p-4">
                                <h4 className="text-sm font-bold">Tareas</h4>
                                <p className="mt-1 text-xs text-[color:var(--muted)]">
                                  Cada tarea puede tener subtareas con su propio estado y
                                  URL.
                                </p>
                                <ul className="mt-3 space-y-3">
                                  {activity.tasks.map((task) => {
                                    const taskExpanded = expandedTaskId === task.id;
                                    return (
                                      <li
                                        key={task.id}
                                        className="border border-[color:var(--line)] bg-[color:var(--mist)]"
                                      >
                                        <div className="space-y-2 p-3">
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <input
                                              aria-label="Título de la tarea"
                                              defaultValue={str(task.title)}
                                              key={`task-title-${task.id}-${task.status}-${task.url}`}
                                              onBlur={(e) => {
                                                const title = e.target.value.trim();
                                                if (!title) {
                                                  e.target.value = task.title;
                                                  toast.error(
                                                    "El título de la tarea no puede quedar vacío",
                                                  );
                                                  return;
                                                }
                                                if (title !== task.title) {
                                                  updateTaskFields(
                                                    activity.id,
                                                    task.id,
                                                    { title },
                                                    "Tarea actualizada",
                                                  );
                                                }
                                              }}
                                              className={`min-w-0 flex-1 border border-transparent bg-transparent px-1 text-sm font-semibold outline-none hover:border-[color:var(--line)] focus:border-[color:var(--accent)] ${
                                                task.status === "done"
                                                  ? "text-[color:var(--muted)] line-through"
                                                  : ""
                                              }`}
                                            />
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                              <select
                                                aria-label="Estado de la tarea"
                                                value={str(task.status) || "waiting"}
                                                onChange={(e) =>
                                                  setTaskStatus(
                                                    activity.id,
                                                    task.id,
                                                    e.target.value as TaskStatus,
                                                  )
                                                }
                                                className={`min-w-[10.5rem] border border-[color:var(--line)] px-2 py-1.5 text-xs font-semibold ${
                                                  STATUS_STYLES[task.status] ||
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
                                                onClick={() =>
                                                  setExpandedTaskId(
                                                    taskExpanded ? null : task.id,
                                                  )
                                                }
                                                className="border border-[color:var(--line)] bg-white px-2 py-1.5 text-xs font-semibold"
                                              >
                                                {task.subtasks.length
                                                  ? `Subtareas (${task.subtasks.length})`
                                                  : "Subtareas"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeTask(activity.id, task.id)
                                                }
                                                className="text-xs font-semibold text-[color:var(--accent)]"
                                              >
                                                Quitar
                                              </button>
                                            </div>
                                          </div>
                                          <input
                                            type="url"
                                            placeholder="URL de la tarea (opcional)"
                                            value={str(task.url)}
                                            onChange={(e) =>
                                              updateTaskFields(activity.id, task.id, {
                                                url: e.target.value,
                                              })
                                            }
                                            className="w-full border border-[color:var(--line)] bg-white px-2 py-1.5 text-xs"
                                          />
                                          {task.url ? (
                                            <a
                                              href={task.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-block text-xs font-semibold text-[color:var(--accent)]"
                                            >
                                              Abrir URL
                                            </a>
                                          ) : null}
                                        </div>

                                        {taskExpanded && (
                                          <div className="border-t border-[color:var(--line)] bg-white p-3">
                                            <h5 className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
                                              Subtareas
                                            </h5>
                                            <ul className="mt-2 space-y-2">
                                              {task.subtasks.map((subtask) => (
                                                <li
                                                  key={subtask.id}
                                                  className="space-y-2 border border-[color:var(--line)] px-3 py-2"
                                                >
                                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <input
                                                      aria-label="Título de la subtarea"
                                                      defaultValue={str(subtask.title)}
                                                      key={`sub-title-${subtask.id}-${subtask.status}-${subtask.url}`}
                                                      onBlur={(e) => {
                                                        const title = e.target.value.trim();
                                                        if (!title) {
                                                          e.target.value = subtask.title;
                                                          toast.error(
                                                            "El título de la subtarea no puede quedar vacío",
                                                          );
                                                          return;
                                                        }
                                                        if (title !== subtask.title) {
                                                          updateSubtask(
                                                            activity.id,
                                                            task.id,
                                                            subtask.id,
                                                            { title },
                                                            "Subtarea actualizada",
                                                          );
                                                        }
                                                      }}
                                                      className={`min-w-0 flex-1 border border-transparent bg-transparent px-1 text-sm font-semibold outline-none hover:border-[color:var(--line)] focus:border-[color:var(--accent)] ${
                                                        subtask.status === "done"
                                                          ? "text-[color:var(--muted)] line-through"
                                                          : ""
                                                      }`}
                                                    />
                                                    <div className="flex shrink-0 items-center gap-2">
                                                      <select
                                                        aria-label="Estado de la subtarea"
                                                        value={str(subtask.status) || "waiting"}
                                                        onChange={(e) =>
                                                          updateSubtask(
                                                            activity.id,
                                                            task.id,
                                                            subtask.id,
                                                            {
                                                              status: e.target
                                                                .value as TaskStatus,
                                                            },
                                                          )
                                                        }
                                                        className={`min-w-[10.5rem] border border-[color:var(--line)] px-2 py-1.5 text-xs font-semibold ${
                                                          STATUS_STYLES[subtask.status] ||
                                                          STATUS_STYLES.waiting
                                                        }`}
                                                      >
                                                        {TASK_STATUSES.map((item) => (
                                                          <option
                                                            key={item.value}
                                                            value={item.value}
                                                          >
                                                            {item.label}
                                                          </option>
                                                        ))}
                                                      </select>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          removeSubtask(
                                                            activity.id,
                                                            task.id,
                                                            subtask.id,
                                                          )
                                                        }
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
                                                      updateSubtask(
                                                        activity.id,
                                                        task.id,
                                                        subtask.id,
                                                        { url: e.target.value },
                                                      )
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
                                                value={str(newSubtaskDraft[task.id]?.title)}
                                                onChange={(e) =>
                                                  setNewSubtaskDraft((prev) => ({
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
                                                    addSubtask(activity.id, task.id);
                                                  }
                                                }}
                                              />
                                              <input
                                                type="url"
                                                value={str(newSubtaskDraft[task.id]?.url)}
                                                onChange={(e) =>
                                                  setNewSubtaskDraft((prev) => ({
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
                                                    addSubtask(activity.id, task.id);
                                                  }
                                                }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  addSubtask(activity.id, task.id)
                                                }
                                                className="bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                                              >
                                                Agregar
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                  <input
                                    value={str(newTaskDraft[activity.id]?.title)}
                                    onChange={(e) =>
                                      setNewTaskDraft((prev) => ({
                                        ...prev,
                                        [activity.id]: {
                                          title: e.target.value,
                                          url: prev[activity.id]?.url || "",
                                        },
                                      }))
                                    }
                                    placeholder="Nueva tarea..."
                                    className="border border-[color:var(--line)] px-3 py-2 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTask(activity.id);
                                      }
                                    }}
                                  />
                                  <input
                                    type="url"
                                    value={str(newTaskDraft[activity.id]?.url)}
                                    onChange={(e) =>
                                      setNewTaskDraft((prev) => ({
                                        ...prev,
                                        [activity.id]: {
                                          title: prev[activity.id]?.title || "",
                                          url: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="URL (opcional)"
                                    className="border border-[color:var(--line)] px-3 py-2 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTask(activity.id);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTask(activity.id)}
                                    className="bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                                  >
                                    Agregar
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
    });
  }

  if (loading) {
    return <div className="p-10 text-sm text-[color:var(--muted)]">Cargando actividades...</div>;
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              Seguimiento de actividades
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
              onClick={() => setAssistantOpen(true)}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              Asistente guiado
            </button>
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
            Actividades
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
            <form onSubmit={(e) => void saveMember(e)} className="h-fit space-y-3 border border-[color:var(--line)] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  {editingMemberId ? "Editar integrante" : "Nuevo integrante"}
                </h2>
                {editingMemberId && (
                  <button
                    type="button"
                    onClick={cancelEditMember}
                    className="text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadMemberPhoto(file);
                  e.target.value = "";
                }}
                className="block w-full text-xs"
              />
              <p className="text-[11px] text-[color:var(--muted)]">
                Formatos: JPG, PNG, WEBP o GIF (máx. 10MB).
              </p>
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
              <div className="grid grid-cols-[9.5rem_1fr] gap-2">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Indicativo
                  </span>
                  <select
                    value={memberForm.phoneCountryCode || "+57"}
                    onChange={(e) =>
                      setMemberForm((p) => ({
                        ...emptyMemberForm,
                        ...p,
                        phoneCountryCode: e.target.value,
                      }))
                    }
                    className="w-full border border-[color:var(--line)] px-2 py-2 text-sm"
                  >
                    {PHONE_COUNTRY_CODES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    WhatsApp / celular
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="3001234567"
                    value={str(memberForm.phone)}
                    onChange={(e) =>
                      setMemberForm((p) => ({
                        ...emptyMemberForm,
                        ...p,
                        phone: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[color:var(--muted)]">
                Se usará para recordatorios diarios de tareas pendientes por WhatsApp.
              </p>
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
                {editingMemberId ? "Guardar cambios" : "Agregar integrante"}
              </button>
            </form>

            <div className="border border-[color:var(--line)] bg-white">
              {board.members.length === 0 ? (
                <p className="p-6 text-sm text-[color:var(--muted)]">Aún no hay integrantes.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {board.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar name={member.name} photo={member.photo} size="md" />
                        <div className="min-w-0">
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-sm text-[color:var(--muted)]">
                            {member.role || "Sin cargo"}
                            {member.email ? ` · ${member.email}` : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                            {formatMemberPhone(member)
                              ? `WhatsApp: ${formatMemberPhone(member)}`
                              : "Sin teléfono registrado"}
                          </p>
                          <label className="mt-2 inline-flex cursor-pointer text-xs font-semibold text-[color:var(--accent)]">
                            {member.photo ? "Cambiar foto" : "Subir foto"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void updateMemberPhoto(member.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => startEditMember(member)}
                          className="text-xs font-semibold text-[color:var(--ink)]"
                        >
                          {editingMemberId === member.id ? "Editando…" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeMember(member.id)}
                          className="text-xs font-semibold text-[color:var(--accent)]"
                        >
                          Eliminar
                        </button>
                      </div>
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
                  Visualizar actividades del equipo
                </h1>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Lista, Gantt, Reportes, Banco o Historial de terminadas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap border border-[color:var(--line)] bg-white p-1">
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
                  <button
                    type="button"
                    onClick={() => setViewMode("bank")}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      viewMode === "bank" ? "bg-[color:var(--accent)] text-white" : ""
                    }`}
                  >
                    Banco
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("history")}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      viewMode === "history" ? "bg-[color:var(--accent)] text-white" : ""
                    }`}
                  >
                    Historial
                    {completedActivities.length > 0 ? (
                      <span className="ml-1 opacity-80">({completedActivities.length})</span>
                    ) : null}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={board.members.length === 0}
                  className="bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  + Nueva actividad
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
              <TasksReports members={board.members} activities={activeActivities} />
            ) : viewMode === "history" ? (
              <TasksHistory
                members={board.members}
                activities={completedActivities}
                selectedMemberId={selectedMemberId}
              >
                {(filtered) => (
                  <div className="grid gap-3">{renderActivityCards(filtered)}</div>
                )}
              </TasksHistory>
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
                    <div className="space-y-0.5 text-xs text-[color:var(--muted)]">
                      <p>
                        {activeActivities.length}{" "}
                        {activeActivities.length === 1
                          ? "actividad activa"
                          : "actividades activas"}
                      </p>
                      <p>
                        {pendingBankTotal}{" "}
                        {pendingBankTotal === 1
                          ? "actividad en el banco"
                          : "actividades en el banco"}
                      </p>
                    </div>
                  </button>

                  {board.members.map((member) => {
                    const activeCount = activeActivityCountByMember[member.id] || 0;
                    const bankCount = pendingBankCountByMember[member.id] || 0;
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
                          <div className="space-y-0.5 text-xs text-[color:var(--muted)]">
                            <p>
                              {activeCount}{" "}
                              {activeCount === 1
                                ? "actividad activa"
                                : "actividades activas"}
                            </p>
                            <p>
                              {bankCount}{" "}
                              {bankCount === 1
                                ? "actividad en el banco"
                                : "actividades en el banco"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {viewMode !== "bank" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Estado
                    </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("all")}
                    className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedStatus === "all"
                        ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                        : "border-[color:var(--line)] bg-white text-[color:var(--ink)]"
                    }`}
                  >
                    Todos
                  </button>
                  {TASK_STATUSES.map(({ value: status, label }) => {
                    const active = selectedStatus === status;
                    const count = board.activities.filter((a) => {
                      const matchesMember =
                        selectedMemberId === "all" ||
                        (a.assigneeIds || []).includes(selectedMemberId);
                      return matchesMember && a.status === status;
                    }).length;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setSelectedStatus(status)}
                        className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "border-transparent text-white"
                            : "border-[color:var(--line)] bg-white text-[color:var(--ink)]"
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: TASK_STATUS_COLORS[status].bg,
                              }
                            : undefined
                        }
                      >
                        {label}
                        <span
                          className={`ml-1.5 ${active ? "opacity-80" : "text-[color:var(--muted)]"}`}
                        >
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
                ) : null}

                {viewMode === "bank" ? (
                  <div className="space-y-5">
                    <div className="border border-[color:var(--line)] bg-white p-5 md:p-6">
                      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                        Banco de tareas
                      </h2>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        Anota todo lo que hay que convertir en actividades formales.
                        {selectedMember
                          ? ` Banco de ${selectedMember.name}.`
                          : " Puedes agregar ideas para cualquier integrante."}
                      </p>

                      <form onSubmit={(e) => void addBankItem(e)} className="mt-5 grid gap-3">
                        {selectedMemberId === "all" ? (
                          <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                              Integrante
                            </span>
                            <select
                              value={bankOwnerId}
                              onChange={(e) => setBankOwnerId(e.target.value)}
                              className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
                            >
                              <option value="">Selecciona integrante…</option>
                              {board.members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                            ¿Qué actividad hay que crear?
                          </span>
                          <input
                            value={bankTitle}
                            onChange={(e) => setBankTitle(e.target.value)}
                            placeholder="Ej: Preparar lanzamiento del programa"
                            className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                            Notas / detalles (opcional)
                          </span>
                          <textarea
                            value={bankNotes}
                            onChange={(e) => setBankNotes(e.target.value)}
                            rows={3}
                            placeholder="Qué implica, materiales, dependencias…"
                            className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
                          />
                        </label>
                        <div className="space-y-2">
                          <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                            Visibilidad
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setBankVisibility("public")}
                              className={`border px-3 py-2 text-xs font-semibold ${
                                bankVisibility === "public"
                                  ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                                  : "border-[color:var(--line)]"
                              }`}
                            >
                              Pública
                            </button>
                            <button
                              type="button"
                              onClick={() => setBankVisibility("private")}
                              className={`border px-3 py-2 text-xs font-semibold ${
                                bankVisibility === "private"
                                  ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                                  : "border-[color:var(--line)]"
                              }`}
                            >
                              Privada
                            </button>
                          </div>
                          {bankVisibility === "private" ? (
                            <PrivateItemSetupFields
                              values={bankPrivateSetup}
                              onChange={setBankPrivateSetup}
                            />
                          ) : null}
                        </div>
                        <button
                          type="submit"
                          disabled={saving}
                          className="justify-self-start bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          + Agregar al banco
                        </button>
                      </form>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-[color:var(--ink)]">
                        Pendientes ({pendingBank.length})
                      </h3>
                      {pendingBank.length === 0 ? (
                        <div className="border border-dashed border-[color:var(--line)] bg-white p-6 text-sm text-[color:var(--muted)]">
                          No hay ideas pendientes
                          {selectedMember ? ` para ${selectedMember.name}` : ""}.
                        </div>
                      ) : (
                        pendingBank.map((item) => {
                          if (
                            item.visibility === "private" &&
                            !isPrivateContentVisible(
                              "bank",
                              item.id,
                              Boolean(item.title.trim() || item.notes.trim()),
                            )
                          ) {
                            return (
                              <PrivateLockedCard
                                key={item.id}
                                kind="idea"
                                onUnlock={() =>
                                  setUnlockTarget({
                                    itemType: "bank",
                                    itemId: item.id,
                                  })
                                }
                              />
                            );
                          }

                          const owner = board.members.find((m) => m.id === item.ownerId);
                          const isEditing = editingBankId === item.id;
                          const isViewing = viewingBankId === item.id;
                          return (
                            <article
                              key={item.id}
                              className="border border-[color:var(--line)] bg-white p-4 md:p-5"
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  <label className="block space-y-1">
                                    <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                                      Título
                                    </span>
                                    <input
                                      value={editingBankTitle}
                                      onChange={(e) => setEditingBankTitle(e.target.value)}
                                      className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                                      Notas
                                    </span>
                                    <textarea
                                      value={editingBankNotes}
                                      onChange={(e) => setEditingBankNotes(e.target.value)}
                                      rows={3}
                                      className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                                    />
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveBankItemEdit(item.id)}
                                      disabled={saving}
                                      className="bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditBankItem}
                                      className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--ink)]">
                                        {item.title}
                                      </p>
                                      {item.visibility === "private" ? (
                                        <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#1e293b] text-white">
                                          Privada
                                        </span>
                                      ) : null}
                                      {!isViewing && item.notes ? (
                                        <p className="mt-1 text-sm text-[color:var(--muted)] line-clamp-2">
                                          {item.notes}
                                        </p>
                                      ) : null}
                                      <p className="mt-2 text-xs text-[color:var(--muted)]">
                                        {owner ? `Para: ${owner.name}` : "Sin dueño"}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingBankId(null);
                                          setViewingBankId(isViewing ? null : item.id);
                                        }}
                                        className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                      >
                                        {isViewing ? "Ocultar" : "Ver"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditBankItem(item)}
                                        className="border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startConvertBankItem(item)}
                                        className="bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                                      >
                                        Crear actividad
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void removeBankItem(item.id)}
                                        className="border border-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)]"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                  {isViewing ? (
                                    <div className="mt-4 border-t border-[color:var(--line)] pt-4 text-sm">
                                      {item.notes ? (
                                        <p className="whitespace-pre-wrap text-[color:var(--ink)]">
                                          {item.notes}
                                        </p>
                                      ) : (
                                        <p className="text-[color:var(--muted)]">
                                          Sin notas adicionales.
                                        </p>
                                      )}
                                      <p className="mt-3 text-xs text-[color:var(--muted)]">
                                        Creada:{" "}
                                        {new Date(item.createdAt).toLocaleDateString("es-CO")}
                                        {item.updatedAt !== item.createdAt
                                          ? ` · Actualizada: ${new Date(item.updatedAt).toLocaleDateString("es-CO")}`
                                          : ""}
                                      </p>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>

                    {convertedBank.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-[color:var(--ink)]">
                          Ya convertidas ({convertedBank.length})
                        </h3>
                        {convertedBank.map((item) =>
                          item.visibility === "private" &&
                          !isPrivateContentVisible(
                            "bank",
                            item.id,
                            Boolean(item.title.trim() || item.notes.trim()),
                          ) ? (
                            <PrivateLockedCard
                              key={item.id}
                              kind="idea"
                              onUnlock={() =>
                                setUnlockTarget({
                                  itemType: "bank",
                                  itemId: item.id,
                                })
                              }
                            />
                          ) : (
                          <article
                            key={item.id}
                            className="border border-[color:var(--line)] bg-[color:var(--mist)] px-4 py-3"
                          >
                            <p className="text-sm font-semibold text-[color:var(--ink)] line-through opacity-70">
                              {item.title || "Idea privada"}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              Convertida en actividad
                            </p>
                          </article>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                {(selectedMember || selectedStatusLabel) && (
                  <p className="text-sm text-[color:var(--muted)]">
                    Mostrando{" "}
                    {selectedStatusLabel ? (
                      <>
                        actividades en{" "}
                        <span className="font-semibold text-[color:var(--ink)]">
                          {selectedStatusLabel}
                        </span>
                      </>
                    ) : (
                      "actividades"
                    )}
                    {selectedMember ? (
                      <>
                        {" "}
                        de{" "}
                        <span className="font-semibold text-[color:var(--ink)]">
                          {selectedMember.name}
                        </span>
                      </>
                    ) : null}
                    {" · "}
                    {filteredActivities.length}{" "}
                    {filteredActivities.length === 1 ? "resultado" : "resultados"}
                  </p>
                )}

                {viewMode === "gantt" ? (
                  <TasksGantt
                    members={
                      selectedMemberId === "all"
                        ? board.members
                        : board.members.filter((m) => m.id === selectedMemberId)
                    }
                    activities={filteredActivities}
                  />
                ) : (
                  <div className="grid gap-3">
                    {filteredActivities.length === 0 ? (
                      <div className="border border-[color:var(--line)] bg-white p-8 text-center">
                        <p className="text-[color:var(--muted)]">
                          No hay actividades abiertas en esta vista.
                        </p>
                        {completedActivities.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setViewMode("history")}
                            className="mt-3 text-sm font-semibold text-[color:var(--accent)]"
                          >
                            Ver historial ({completedActivities.length} terminadas)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="mt-3 text-sm font-semibold text-[color:var(--accent)]"
                          >
                            Crear una actividad
                          </button>
                        )}
                      </div>
                    ) : (
                      renderActivityCards(filteredActivities)
                    )}
                  </div>
                )}
                  </>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <AdminFooter />

      <TasksAssistant
        open={assistantOpen}
        members={board.members}
        activities={board.activities}
        bank={board.bank || []}
        saving={saving}
        defaultAssigneeId={
          selectedMemberId !== "all" ? selectedMemberId : sessionMemberId || undefined
        }
        onClose={() => setAssistantOpen(false)}
        onCreate={handleAssistantCreate}
        onConvertFromBank={handleAssistantConvertFromBank}
        onUpdate={handleAssistantUpdate}
      />

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void createActivity(e)}
            className="w-full max-w-md space-y-4 border border-[color:var(--line)] bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                  {convertingBankId ? "Crear actividad desde el banco" : "Nueva actividad"}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {convertingBankId
                    ? "Confirma fechas y quién la hace para convertir la idea en actividad."
                    : "Incluye inicio y fin para el Gantt. Puedes agregar la primera tarea y subtarea."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConvertingBankId(null);
                  setShowCreateModal(false);
                }}
                className="text-sm font-semibold text-[color:var(--muted)]"
              >
                Cerrar
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                ¿Qué hay que lograr?
              </span>
              <input
                required
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Lanzar el programa"
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                Visibilidad
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewVisibility("public")}
                  className={`border px-3 py-2 text-xs font-semibold ${
                    newVisibility === "public"
                      ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                      : "border-[color:var(--line)]"
                  }`}
                >
                  Pública
                </button>
                <button
                  type="button"
                  onClick={() => setNewVisibility("private")}
                  className={`border px-3 py-2 text-xs font-semibold ${
                    newVisibility === "private"
                      ? "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]"
                      : "border-[color:var(--line)]"
                  }`}
                >
                  Privada
                </button>
              </div>
              {newVisibility === "private" ? (
                convertingBankId &&
                (board.bank || []).find((item) => item.id === convertingBankId)?.visibility ===
                  "private" ? (
                  <p className="text-xs text-[color:var(--muted)]">
                    Se conservará la misma clave privada de la idea del banco.
                  </p>
                ) : (
                  <PrivateItemSetupFields
                    values={newPrivateSetup}
                    onChange={setNewPrivateSetup}
                  />
                )
              ) : null}
            </div>

            <div className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                ¿Quién la hace?
              </span>
              <p className="text-xs text-[color:var(--muted)]">
                Elige una persona o varias para formar un grupo.
                {newAssigneeIds.length > 0
                  ? ` · ${newAssigneeIds.length} seleccionad${newAssigneeIds.length === 1 ? "a" : "as"}`
                  : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {board.members.map((member) => {
                  const active = newAssigneeIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleNewAssignee(member.id)}
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
            </div>

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
                Primera tarea (opcional)
              </span>
              <input
                value={newFirstTask}
                onChange={(e) => setNewFirstTask(e.target.value)}
                placeholder="Déjalo vacío si solo quieres la actividad"
                className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm"
              />
            </label>

            {newFirstTask.trim() ? (
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-[color:var(--muted)]">
                    Primera subtarea (opcional)
                  </span>
                  <input
                    value={newFirstSubtask}
                    onChange={(e) => setNewFirstSubtask(e.target.value)}
                    placeholder="Una subtarea concreta dentro de la tarea"
                    className="w-full border border-[color:var(--line)] px-3 py-2.5 text-sm"
                  />
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
              </>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[color:var(--accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Crear actividad
            </button>
          </form>
        </div>
      )}

      <DeliveryUrlsModal
        key={completeActivityId || "delivery-closed"}
        open={Boolean(completeActivityId)}
        title={
          board.activities.find((item) => item.id === completeActivityId)?.title ||
          "Actividad"
        }
        initialProcessUrl={
          board.activities.find((item) => item.id === completeActivityId)
            ?.processUrl || ""
        }
        initialDeliverableUrl={
          board.activities.find((item) => item.id === completeActivityId)
            ?.deliverableUrl || ""
        }
        saving={saving}
        onClose={() => setCompleteActivityId(null)}
        onSave={saveDeliveryUrls}
      />

      <ReviewMessageModal
        open={Boolean(reviewModalActivityId)}
        activity={
          reviewModalActivityId
            ? board.activities.find((item) => item.id === reviewModalActivityId) || null
            : null
        }
        members={board.members}
        sessionMemberId={sessionMemberId}
        sessionName={sessionName}
        onClose={closeReviewModal}
        onSent={(message) => {
          if (reviewModalActivityId) saveReviewMessage(reviewModalActivityId, message);
        }}
      />

      <PrivateItemUnlockModal
        open={Boolean(unlockTarget)}
        itemType={unlockTarget?.itemType || "activity"}
        itemId={unlockTarget?.itemId || ""}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={applyPrivateReveal}
      />
    </div>
  );
}
