"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createId,
  deriveTaskStatusFromSubtasks,
  getActivityProgress,
  type Activity,
  type ItemVisibility,
  type Subtask,
  type Task,
  type TaskBankItem,
  type TaskStatus,
  type TeamMember,
} from "@/lib/tasks/types";
import {
  createEmptyPrivateSetup,
  PrivateItemSetupFields,
  validatePrivateSetup,
  type PrivateSetupValues,
} from "@/components/admin/PrivateItemSetupFields";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import { formatAdmin, getTaskStatuses } from "@/lib/i18n/admin";

type Intent = "create" | "update" | "bank";

type Step =
  | "intent"
  | "visibility"
  | "privateSetup"
  | "title"
  | "dates"
  | "assignees"
  | "firstTask"
  | "firstSubtask"
  | "pickBank"
  | "pick"
  | "status"
  | "tasks"
  | "note"
  | "confirm";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type CreateDraft = {
  title: string;
  date: string;
  finishedDate: string;
  assigneeIds: string[];
  firstTask: string;
  firstSubtask: string;
  firstSubtaskUrl: string;
  visibility: ItemVisibility;
};

type UpdateDraft = {
  activityId: string;
  status: TaskStatus | null;
  note: string;
  tasks: Task[];
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  waiting: "bg-[#f3f3f3] text-[color:var(--muted)]",
  in_progress: "bg-[#fff1f4] text-[color:var(--accent)]",
  paused: "bg-[#eff6ff] text-[#2563eb]",
  pending_review: "bg-[#fef9c3] text-[#a16207]",
  done: "bg-[#e9f8ef] text-[#177245]",
};

type Props = {
  open: boolean;
  members: TeamMember[];
  activities: Activity[];
  bank: TaskBankItem[];
  saving?: boolean;
  defaultAssigneeId?: string;
  onClose: () => void;
  onCreate: (activity: Activity, privateSetup?: PrivateSetupValues) => Promise<boolean>;
  onConvertFromBank: (
    bankItemId: string,
    activity: Activity,
    privateSetup?: PrivateSetupValues,
  ) => Promise<boolean>;
  onUpdate: (input: {
    activityId: string;
    status: TaskStatus;
    note: string;
    tasks: Task[];
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

function weekLaterIso(from = todayIso()) {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function emptyCreateDraft(defaultAssigneeId?: string): CreateDraft {
  const date = todayIso();
  return {
    title: "",
    date,
    finishedDate: weekLaterIso(date),
    assigneeIds: defaultAssigneeId ? [defaultAssigneeId] : [],
    firstTask: "",
    firstSubtask: "",
    firstSubtaskUrl: "",
    visibility: "public",
  };
}

function createFlowSteps(visibility: ItemVisibility): Step[] {
  const steps: Step[] = ["visibility"];
  if (visibility === "private") steps.push("privateSetup");
  return [...steps, "title", "dates", "assignees", "firstTask", "firstSubtask", "confirm"];
}

function bankFlowSteps(bankItem: TaskBankItem | null, visibility: ItemVisibility): Step[] {
  const steps: Step[] = ["pickBank"];
  const inheritsPrivate = bankItem?.visibility === "private";
  if (!inheritsPrivate) {
    steps.push("visibility");
    if (visibility === "private") steps.push("privateSetup");
  }
  return [...steps, "dates", "assignees", "confirm"];
}

function emptyUpdateDraft(): UpdateDraft {
  return { activityId: "", status: null, note: "", tasks: [] };
}

function cloneActivityTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
  }));
}

function memberNames(ids: string[], members: TeamMember[]) {
  return ids
    .map((id) => members.find((member) => member.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

const CREATE_STEPS_PUBLIC = 8;
const CREATE_STEPS_PRIVATE = 9;
const UPDATE_STEPS = 6;
const BANK_STEPS_INHERITED_PRIVATE = 5;
const BANK_STEPS_PUBLIC = 6;
const BANK_STEPS_PRIVATE = 7;

export function TasksAssistant({
  open,
  members,
  activities,
  bank,
  saving = false,
  defaultAssigneeId,
  onClose,
  onCreate,
  onConvertFromBank,
  onUpdate,
}: Props) {
  const { t } = useAdminLanguage();
  const a = t.assistant;
  const taskStatuses = useMemo(() => getTaskStatuses(t), [t]);
  const statusLabel = (status: TaskStatus) =>
    taskStatuses.find((item) => item.value === status)?.label || status;

  const [intent, setIntent] = useState<Intent | null>(null);
  const [step, setStep] = useState<Step>("intent");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(() =>
    emptyCreateDraft(defaultAssigneeId),
  );
  const [updateDraft, setUpdateDraft] = useState<UpdateDraft>(emptyUpdateDraft);
  const [bankItemId, setBankItemId] = useState<string | null>(null);
  const [privateSetup, setPrivateSetup] = useState(() => createEmptyPrivateSetup());
  const [textInput, setTextInput] = useState("");
  const [dateStart, setDateStart] = useState(todayIso());
  const [dateEnd, setDateEnd] = useState(weekLaterIso());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const openActivities = useMemo(
    () =>
      activities
        .filter(
          (activity) =>
            activity.status !== "done" && getActivityProgress(activity) < 100,
        )
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [activities],
  );

  const selectedActivity =
    activities.find((item) => item.id === updateDraft.activityId) || null;

  const pendingBankItems = useMemo(
    () =>
      (bank || [])
        .filter((item) => !item.convertedActivityId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [bank],
  );

  const selectedBankItem =
    bankItemId ? pendingBankItems.find((item) => item.id === bankItemId) || null : null;

  const totalSteps =
    intent === "create"
      ? createDraft.visibility === "private"
        ? CREATE_STEPS_PRIVATE
        : CREATE_STEPS_PUBLIC
      : intent === "update"
        ? UPDATE_STEPS
        : intent === "bank"
          ? selectedBankItem?.visibility === "private"
            ? BANK_STEPS_INHERITED_PRIVATE
            : createDraft.visibility === "private"
              ? BANK_STEPS_PRIVATE
              : BANK_STEPS_PUBLIC
          : 1;

  const stepNumber = useMemo(() => {
    if (step === "intent") return 1;
    if (intent === "create") {
      const order = createFlowSteps(createDraft.visibility);
      const idx = order.indexOf(step);
      return idx >= 0 ? idx + 2 : 2;
    }
    if (intent === "bank") {
      const order = bankFlowSteps(selectedBankItem, createDraft.visibility);
      const idx = order.indexOf(step);
      return idx >= 0 ? idx + 2 : 2;
    }
    if (step === "pick") return 2;
    if (step === "status") return 3;
    if (step === "tasks") return 4;
    if (step === "note") return 5;
    return 6;
  }, [step, intent, createDraft.visibility, selectedBankItem]);

  useEffect(() => {
    if (!open) return;
    setIntent(null);
    setStep("intent");
    setCreateDraft(emptyCreateDraft(defaultAssigneeId));
    setUpdateDraft(emptyUpdateDraft());
    setBankItemId(null);
    setPrivateSetup(createEmptyPrivateSetup());
    setTextInput("");
    setDateStart(todayIso());
    setDateEnd(weekLaterIso());
    setMessages([msg("assistant", a.greeting)]);
  }, [open, defaultAssigneeId, a.greeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, msg(role, text)]);
  }

  function chooseIntent(next: Intent) {
    setIntent(next);
    if (next === "create") {
      push("user", a.createActivity);
      setStep("visibility");
      push("assistant", a.visibilityQuestion);
      return;
    }
    if (next === "bank") {
      push("user", a.reviewBank);
      setStep("pickBank");
      push(
        "assistant",
        pendingBankItems.length ? a.bankPick : a.noBankItems,
      );
      return;
    }
    push("user", a.updateProgress);
    setStep("pick");
    push(
      "assistant",
      openActivities.length ? a.pickActivity : a.noOpenActivities,
    );
  }

  function chooseVisibility(visibility: ItemVisibility) {
    setCreateDraft((prev) => ({ ...prev, visibility }));
    push("user", visibility === "private" ? a.private : a.public);
    if (visibility === "private") {
      setPrivateSetup(createEmptyPrivateSetup());
      setStep("privateSetup");
      push("assistant", a.privateSetup);
      return;
    }
    if (intent === "bank") {
      setStep("dates");
      push("assistant", a.datesQuestion);
      return;
    }
    setStep("title");
    push("assistant", a.titleQuestion);
    setTextInput("");
  }

  function submitPrivateSetup() {
    const validation = validatePrivateSetup(privateSetup, t.private);
    if (validation) {
      push("assistant", validation);
      return;
    }
    push("user", a.privateSetupDone);
    if (intent === "bank") {
      const start = dateStart || todayIso();
      const end = dateEnd || weekLaterIso(start);
      setCreateDraft((prev) => ({
        ...prev,
        date: start,
        finishedDate: end,
      }));
      setStep("dates");
      push("assistant", a.datesQuestion);
      return;
    }
    setStep("title");
    push("assistant", a.titleQuestion);
    setTextInput("");
  }

  function pickBankItem(item: TaskBankItem) {
    const start = todayIso();
    const end = weekLaterIso(start);
    const inheritsPrivate = item.visibility === "private";
    setBankItemId(item.id);
    setCreateDraft({
      title: item.title,
      date: start,
      finishedDate: end,
      assigneeIds: item.suggestedAssigneeIds.length
        ? [...item.suggestedAssigneeIds]
        : item.ownerId
          ? [item.ownerId]
          : defaultAssigneeId
            ? [defaultAssigneeId]
            : [],
      firstTask: "",
      firstSubtask: "",
      firstSubtaskUrl: "",
      visibility: inheritsPrivate ? "private" : "public",
    });
    setDateStart(start);
    setDateEnd(end);
    push("user", item.title.trim() || a.privateBankIdea);
    if (inheritsPrivate) {
      setStep("dates");
      push("assistant", a.privateBankConvert);
      return;
    }
    setStep("visibility");
    push("assistant", a.visibilityQuestion);
  }

  function submitTitle() {
    const title = textInput.trim();
    if (!title) return;
    setCreateDraft((prev) => ({ ...prev, title }));
    push("user", title);
    setTextInput("");
    setStep("dates");
    push("assistant", a.datesQuestion);
  }

  function submitDates() {
    if (!dateStart || !dateEnd) return;
    if (dateEnd < dateStart) {
      push("assistant", a.datesInvalid);
      return;
    }
    setCreateDraft((prev) => ({
      ...prev,
      date: dateStart,
      finishedDate: dateEnd,
    }));
    push("user", `${formatDate(dateStart)} → ${formatDate(dateEnd)}`);
    setStep("assignees");
    push("assistant", a.assigneesQuestion);
  }

  function toggleAssignee(memberId: string) {
    setCreateDraft((prev) => {
      const exists = prev.assigneeIds.includes(memberId);
      return {
        ...prev,
        assigneeIds: exists
          ? prev.assigneeIds.filter((id) => id !== memberId)
          : [...prev.assigneeIds, memberId],
      };
    });
  }

  function submitAssignees() {
    if (!createDraft.assigneeIds.length) return;
    const names = memberNames(createDraft.assigneeIds, members) || "—";
    push("user", names);
    if (intent === "bank") {
      setStep("confirm");
      push("assistant", a.confirmConvert);
      return;
    }
    setStep("firstTask");
    push("assistant", a.firstTaskQuestion);
    setTextInput("");
  }

  function submitFirstTask(skip = false) {
    const value = skip ? "" : textInput.trim();
    if (!skip && !value) return;
    setCreateDraft((prev) => ({ ...prev, firstTask: value }));
    push("user", skip ? a.noInitialTask : value);
    setTextInput("");
    if (!value) {
      setStep("confirm");
      push("assistant", a.confirmCreate);
      return;
    }
    setStep("firstSubtask");
    push("assistant", a.firstSubtaskQuestion);
  }

  function submitFirstSubtask(skip = false) {
    const value = skip ? "" : textInput.trim();
    setCreateDraft((prev) => ({
      ...prev,
      firstSubtask: value,
      firstSubtaskUrl: skip ? "" : prev.firstSubtaskUrl,
    }));
    push("user", skip ? t.tasks.noSubtasks : value || t.tasks.noSubtasks);
    setTextInput("");
    setStep("confirm");
    push("assistant", a.confirmCreate);
  }

  function pickActivity(activity: Activity) {
    setUpdateDraft({
      activityId: activity.id,
      status: null,
      note: "",
      tasks: cloneActivityTasks(activity.tasks),
    });
    push("user", activity.title);
    setStep("status");
    push("assistant", a.statusQuestion);
  }

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    setUpdateDraft((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status, done: status === "done" }
          : task,
      ),
    }));
  }

  function updateSubtaskStatus(
    taskId: string,
    subtaskId: string,
    status: TaskStatus,
  ) {
    setUpdateDraft((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const subtasks = task.subtasks.map((subtask) =>
          subtask.id === subtaskId
            ? { ...subtask, status, done: status === "done" }
            : subtask,
        );
        const derived =
          subtasks.length === 1
            ? status
            : deriveTaskStatusFromSubtasks(subtasks);
        const nextStatus = derived || task.status;
        return {
          ...task,
          subtasks,
          status: nextStatus,
          done: nextStatus === "done",
        };
      }),
    }));
  }

  function submitStatus(status: TaskStatus) {
    setUpdateDraft((prev) => ({ ...prev, status }));
    push("user", statusLabel(status));
    setStep("tasks");
    push(
      "assistant",
      updateDraft.tasks.length ? a.tasksReview : a.noTasksInActivity,
    );
  }

  function submitTasks() {
    push("user", a.tasksReviewed);
    setStep("note");
    push("assistant", a.noteQuestion);
    setTextInput("");
  }

  function submitNote(skip = false) {
    const value = skip ? "" : textInput.trim();
    setUpdateDraft((prev) => ({ ...prev, note: value }));
    push("user", skip ? a.noNote : value || a.noNote);
    setTextInput("");
    setStep("confirm");
    push("assistant", a.confirmUpdate);
  }

  function buildActivityFromCreateDraft(): Activity | null {
    if (!createDraft.title.trim() || !createDraft.assigneeIds.length) return null;
    if (createDraft.finishedDate < createDraft.date) return null;

    const now = new Date().toISOString();
    const activityId = createId("activity");
    const tasks: Task[] = [];

    if (createDraft.firstTask.trim()) {
      const taskId = createId("task");
      const subtasks: Subtask[] = createDraft.firstSubtask.trim()
        ? [
            {
              id: createId("sub"),
              title: createDraft.firstSubtask.trim(),
              status: "waiting",
              done: false,
              url: createDraft.firstSubtaskUrl.trim(),
            },
          ]
        : [];
      tasks.push({
        id: taskId,
        activityId,
        title: createDraft.firstTask.trim(),
        status: "waiting",
        done: false,
        url: "",
        subtasks,
      });
    }

    return {
      id: activityId,
      title: createDraft.title.trim(),
      date: createDraft.date,
      finishedDate: createDraft.finishedDate,
      processUrl: "",
      deliverableUrl: "",
      status: "waiting",
      assigneeIds: [...createDraft.assigneeIds],
      tasks,
      notes: [],
      reviewMessages: [],
      createdAt: now,
      updatedAt: now,
      visibility: createDraft.visibility,
      createdById: defaultAssigneeId || createDraft.assigneeIds[0] || "",
    };
  }

  function needsPrivateSetupOnSave() {
    if (createDraft.visibility !== "private") return false;
    if (intent === "bank" && selectedBankItem?.visibility === "private") return false;
    return true;
  }

  async function confirmSave() {
    if (intent === "create" || intent === "bank") {
      const activity = buildActivityFromCreateDraft();
      if (!activity) return;

      let setup: PrivateSetupValues | undefined;
      if (needsPrivateSetupOnSave()) {
        const validation = validatePrivateSetup(privateSetup, t.private);
        if (validation) {
          push("assistant", validation);
          return;
        }
        setup = privateSetup;
      }

      const ok =
        intent === "bank" && bankItemId
          ? await onConvertFromBank(bankItemId, activity, setup)
          : await onCreate(activity, setup);
      if (ok) onClose();
      return;
    }

    if (!updateDraft.activityId || !updateDraft.status) return;
    const ok = await onUpdate({
      activityId: updateDraft.activityId,
      status: updateDraft.status,
      note: updateDraft.note.trim(),
      tasks: updateDraft.tasks,
    });
    if (ok) onClose();
  }

  if (!open) return null;

  const progressPct = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]">
              {a.title}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {formatAdmin(a.stepOf, { step: stepNumber, total: totalSteps })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
          >
            {a.close}
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

          {step === "confirm" && (intent === "create" || intent === "bank") ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              {intent === "bank" ? (
                <p className="text-xs font-semibold uppercase text-[color:var(--accent)]">
                  {a.fromBank}
                </p>
              ) : null}
              <p className="font-semibold text-[color:var(--ink)]">{createDraft.title}</p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {a.visibilityLabel}:{" "}
                {createDraft.visibility === "private" ? a.private : a.public}
              </p>
              {intent === "bank" && selectedBankItem?.notes ? (
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {selectedBankItem.notes}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {formatDate(createDraft.date)} → {formatDate(createDraft.finishedDate)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {a.assignedTo}: {memberNames(createDraft.assigneeIds, members) || "—"}
              </p>
              {intent === "create" ? (
                createDraft.firstTask ? (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {createDraft.firstTask}
                    {createDraft.firstSubtask
                      ? ` · ${createDraft.firstSubtask}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{a.noInitialTask}</p>
                )
              ) : (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {a.willMarkConverted}
                </p>
              )}
            </div>
          ) : null}

          {step === "tasks" && intent === "update" ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-[color:var(--ink)]">
                {a.activityTo} {updateDraft.status ? statusLabel(updateDraft.status) : "—"}
              </p>
              {updateDraft.tasks.length === 0 ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {a.noTasks}
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs text-[color:var(--muted)]">
                  {updateDraft.tasks.map((task) => (
                    <li key={task.id}>
                      <span className="font-semibold text-[color:var(--ink)]">
                        {task.title || a.taskUntitled}
                      </span>
                      <span
                        className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          STATUS_STYLES[task.status] || STATUS_STYLES.waiting
                        }`}
                      >
                        {statusLabel(task.status)}
                      </span>
                      {task.subtasks.length ? (
                        <ul className="mt-1 space-y-1 border-l-2 border-[color:var(--line)] pl-3">
                          {task.subtasks.map((subtask) => (
                            <li key={subtask.id}>
                              {subtask.title || a.subtaskUntitled}
                              <span
                                className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  STATUS_STYLES[subtask.status] ||
                                  STATUS_STYLES.waiting
                                }`}
                              >
                                {statusLabel(subtask.status)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {step === "confirm" && intent === "update" && selectedActivity ? (
            <div className="border border-[color:var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-[color:var(--ink)]">
                {selectedActivity.title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {t.common.status}: {statusLabel(selectedActivity.status)} →{" "}
                <strong>
                  {updateDraft.status ? statusLabel(updateDraft.status) : "—"}
                </strong>
              </p>
              {updateDraft.tasks.length > 0 ? (
                <ul className="mt-2 space-y-2 text-xs text-[color:var(--muted)]">
                  {updateDraft.tasks.map((task) => {
                    const original = selectedActivity.tasks.find(
                      (item) => item.id === task.id,
                    );
                    const taskChanged = original?.status !== task.status;
                    return (
                      <li key={task.id}>
                        <span className="font-semibold text-[color:var(--ink)]">
                          {task.title || a.taskUntitled}
                        </span>
                        {taskChanged && original ? (
                          <span>
                            {" "}
                            · {statusLabel(original.status)} →{" "}
                            <strong>{statusLabel(task.status)}</strong>
                          </span>
                        ) : (
                          <span> · {statusLabel(task.status)}</span>
                        )}
                        {task.subtasks.length ? (
                          <ul className="mt-1 space-y-0.5 border-l-2 border-[color:var(--line)] pl-3">
                            {task.subtasks.map((subtask) => {
                              const originalSub = original?.subtasks.find(
                                (item) => item.id === subtask.id,
                              );
                              const subChanged =
                                originalSub?.status !== subtask.status;
                              return (
                                <li key={subtask.id}>
                                  {subtask.title || a.subtaskUntitled}
                                  {subChanged && originalSub ? (
                                    <span>
                                      {" "}
                                      · {statusLabel(originalSub.status)} →{" "}
                                      <strong>{statusLabel(subtask.status)}</strong>
                                    </span>
                                  ) : (
                                    <span> · {statusLabel(subtask.status)}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {updateDraft.note ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {t.common.notes}: {updateDraft.note}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--muted)]">{a.noNote}</p>
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
                {a.createActivityBtn}
              </button>
              <button
                type="button"
                onClick={() => chooseIntent("update")}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {a.updateActivityBtn}
              </button>
              <button
                type="button"
                onClick={() => chooseIntent("bank")}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {a.reviewBankBtn}
              </button>
            </div>
          ) : null}

          {step === "pickBank" ? (
            pendingBankItems.length === 0 ? (
              <button
                type="button"
                onClick={() => chooseIntent("create")}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.createNew}
              </button>
            ) : (
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {pendingBankItems.map((item) => {
                  const owner = members.find((member) => member.id === item.ownerId);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pickBankItem(item)}
                        className="w-full border border-[color:var(--line)] px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
                      >
                        <span className="font-semibold text-[color:var(--ink)]">
                          {item.title}
                        </span>
                        {item.notes ? (
                          <span className="mt-0.5 block text-xs text-[color:var(--muted)] line-clamp-2">
                            {item.notes}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                          {owner
                            ? `${t.tasks.bankFor}: ${owner.name}`
                            : t.tasks.bankNoOwner}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {step === "visibility" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseVisibility("public")}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {a.public}
              </button>
              <button
                type="button"
                onClick={() => chooseVisibility("private")}
                className="border border-[color:var(--accent)] bg-[#fff1f4] px-3 py-2 text-xs font-semibold text-[color:var(--accent)]"
              >
                {a.private}
              </button>
            </div>
          ) : null}

          {step === "privateSetup" ? (
            <div className="space-y-3">
              <PrivateItemSetupFields
                values={privateSetup}
                onChange={setPrivateSetup}
                questionKeys={privateSetup.questionKeys}
              />
              <button
                type="button"
                onClick={submitPrivateSetup}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "title" ? (
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitTitle();
                  }
                }}
                placeholder={a.titlePlaceholder}
                className="flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={submitTitle}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "dates" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-[color:var(--muted)]">
                  {a.startLabel}
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(event) => setDateStart(event.target.value)}
                    className="mt-1 w-full border border-[color:var(--line)] px-2 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="text-xs text-[color:var(--muted)]">
                  {a.endLabel}
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(event) => setDateEnd(event.target.value)}
                    className="mt-1 w-full border border-[color:var(--line)] px-2 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={submitDates}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "assignees" ? (
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">
                  {a.noMembers}
                </p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {members.map((member) => {
                    const checked = createDraft.assigneeIds.includes(member.id);
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => toggleAssignee(member.id)}
                          className={`w-full border px-3 py-2 text-left text-sm ${
                            checked
                              ? "border-[color:var(--accent)] bg-[#fff1f4]"
                              : "border-[color:var(--line)]"
                          }`}
                        >
                          {member.name}
                          {member.role ? (
                            <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                              {member.role}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={submitAssignees}
                disabled={!createDraft.assigneeIds.length}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "firstTask" ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitFirstTask(false);
                  }
                }}
                placeholder={a.firstTaskPlaceholder}
                className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => submitFirstTask(true)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {a.skip}
              </button>
              <button
                type="button"
                onClick={() => submitFirstTask(false)}
                disabled={!textInput.trim()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "firstSubtask" ? (
            <div className="space-y-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitFirstSubtask(false);
                  }
                }}
                placeholder={a.subtaskPlaceholder}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <input
                value={createDraft.firstSubtaskUrl}
                onChange={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    firstSubtaskUrl: event.target.value,
                  }))
                }
                placeholder={t.common.urlOptional}
                className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submitFirstSubtask(true)}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
                >
                  {a.skip}
                </button>
                <button
                  type="button"
                  onClick={() => submitFirstSubtask(false)}
                  className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                >
                  {a.next}
                </button>
              </div>
            </div>
          ) : null}

          {step === "pick" ? (
            openActivities.length === 0 ? (
              <button
                type="button"
                onClick={() => chooseIntent("create")}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.createActivityBtn}
              </button>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {openActivities.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      onClick={() => pickActivity(activity)}
                      className="w-full border border-[color:var(--line)] px-3 py-2 text-left text-sm hover:border-[color:var(--accent)]"
                    >
                      <span className="font-semibold text-[color:var(--ink)]">
                        {activity.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {formatDate(activity.date)} · {statusLabel(activity.status)}
                        {activity.assigneeIds?.length
                          ? ` · ${memberNames(activity.assigneeIds, members)}`
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {step === "status" ? (
            <div className="flex flex-wrap gap-2">
              {taskStatuses.map((item) => (
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

          {step === "tasks" ? (
            <div className="space-y-3">
              {updateDraft.tasks.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">
                  {a.noTasksInActivity}
                </p>
              ) : (
                <ul className="max-h-52 space-y-3 overflow-y-auto">
                  {updateDraft.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="border border-[color:var(--line)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--ink)]">
                          {task.title || a.taskUntitled}
                        </p>
                        <select
                          value={task.status}
                          onChange={(event) =>
                            updateTaskStatus(
                              task.id,
                              event.target.value as TaskStatus,
                            )
                          }
                          className={`border border-[color:var(--line)] px-2 py-1 text-xs font-semibold outline-none focus:border-[color:var(--accent)] ${
                            STATUS_STYLES[task.status] || STATUS_STYLES.waiting
                          }`}
                        >
                          {taskStatuses.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {task.subtasks.length ? (
                        <ul className="mt-2 space-y-2 border-t border-[color:var(--line)] pt-2">
                          {task.subtasks.map((subtask) => (
                            <li
                              key={subtask.id}
                              className="flex flex-wrap items-center justify-between gap-2 pl-2"
                            >
                              <p className="text-xs text-[color:var(--ink)]">
                                {subtask.title || a.subtaskUntitled}
                              </p>
                              <select
                                value={subtask.status}
                                onChange={(event) =>
                                  updateSubtaskStatus(
                                    task.id,
                                    subtask.id,
                                    event.target.value as TaskStatus,
                                  )
                                }
                                className={`border border-[color:var(--line)] px-2 py-1 text-[11px] font-semibold outline-none focus:border-[color:var(--accent)] ${
                                  STATUS_STYLES[subtask.status] ||
                                  STATUS_STYLES.waiting
                                }`}
                              >
                                {taskStatuses.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] text-[color:var(--muted)]">
                          {t.tasks.noSubtasks}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={submitTasks}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.next}
              </button>
            </div>
          ) : null}

          {step === "note" ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitNote(false);
                  }
                }}
                placeholder={a.notePlaceholder}
                className="min-w-[12rem] flex-1 border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="button"
                onClick={() => submitNote(true)}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {a.skip}
              </button>
              <button
                type="button"
                onClick={() => submitNote(false)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {a.next}
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
                {a.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSave()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? a.saving
                  : intent === "create"
                    ? a.confirmCreateBtn
                    : intent === "bank"
                      ? a.confirmConvertBtn
                      : a.confirmSaveBtn}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
