"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/admin/MemberAvatar";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import {
  activitiesForBilling,
  activityBillingLabel,
  activityOverlapsPeriod,
} from "@/lib/billing/task-suggestions";
import type { BillingSubmission } from "@/lib/billing/types";
import { getTaskStatuses } from "@/lib/i18n/admin";
import type { Activity, TeamMember } from "@/lib/tasks/types";

type Step =
  | "greeting"
  | "member"
  | "period"
  | "upload"
  | "uploadThanks"
  | "activities"
  | "done";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type Draft = {
  memberId: string;
  periodStart: string;
  periodEnd: string;
  fileUrl: string;
  fileName: string;
  activities: string[];
};

type Props = {
  open: boolean;
  members: TeamMember[];
  taskActivities: Activity[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    memberId: string;
    periodStart: string;
    periodEnd: string;
    fileUrl: string;
    fileName: string;
    activities: string[];
  }) => Promise<BillingSubmission | null>;
};

function msg(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function quincenaPresets(base = new Date()) {
  const year = base.getFullYear();
  const month = base.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const m = pad(month);
  return {
    first: {
      label: `1ª quincena (${formatDate(`${year}-${m}-01`)} – ${formatDate(`${year}-${m}-15`)})`,
      start: `${year}-${m}-01`,
      end: `${year}-${m}-15`,
    },
    second: {
      label: `2ª quincena (${formatDate(`${year}-${m}-16`)} – ${formatDate(`${year}-${m}-${pad(lastDay)}`)})`,
      start: `${year}-${m}-16`,
      end: `${year}-${m}-${pad(lastDay)}`,
    },
  };
}

const STEP_ORDER: Step[] = [
  "greeting",
  "member",
  "period",
  "upload",
  "uploadThanks",
  "activities",
  "done",
];

function emptyDraft(): Draft {
  const presets = quincenaPresets();
  return {
    memberId: "",
    periodStart: presets.first.start,
    periodEnd: presets.first.end,
    fileUrl: "",
    fileName: "",
    activities: [],
  };
}

export function BillingAssistant({
  open,
  members,
  taskActivities,
  saving = false,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useAdminLanguage();
  const p = t.billing;
  const taskStatuses = useMemo(() => getTaskStatuses(t), [t]);
  const [step, setStep] = useState<Step>("greeting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [extraActivitiesInput, setExtraActivitiesInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<BillingSubmission | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => quincenaPresets(), []);

  const suggestedActivities = useMemo(
    () =>
      activitiesForBilling(
        taskActivities,
        draft.memberId,
        draft.periodStart,
        draft.periodEnd,
      ),
    [taskActivities, draft.memberId, draft.periodStart, draft.periodEnd],
  );

  const mergedActivities = useMemo(() => {
    const fromTasks = suggestedActivities
      .filter((activity) => selectedTaskIds.has(activity.id))
      .map(activityBillingLabel)
      .filter(Boolean);
    const extras = draft.activities.filter((line) => !fromTasks.includes(line));
    return [...fromTasks, ...extras];
  }, [suggestedActivities, selectedTaskIds, draft.activities]);

  const statusLabel = (status: Activity["status"]) =>
    taskStatuses.find((item) => item.value === status)?.label || status;

  useEffect(() => {
    if (!open) return;
    setStep("greeting");
    setMessages([msg("assistant", p.greeting)]);
    const initial = emptyDraft();
    setDraft(initial);
    setPeriodStart(initial.periodStart);
    setPeriodEnd(initial.periodEnd);
    setExtraActivitiesInput("");
    setUploadError("");
    setSelectedTaskIds(new Set());
    setReceipt(null);
  }, [open, p.greeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, msg(role, text)]);
  }

  function startFlow() {
    push("user", p.startButton);
    push("assistant", p.pickMember);
    setStep("member");
  }

  function pickMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    setDraft((prev) => ({ ...prev, memberId }));
    push("user", member.name);
    push("assistant", p.pickPeriod);
    setStep("period");
  }

  function confirmPeriod(start: string, end: string) {
    if (!start || !end || end < start) return;
    setDraft((prev) => ({ ...prev, periodStart: start, periodEnd: end }));
    push("user", `${formatDate(start)} – ${formatDate(end)}`);
    push("assistant", p.uploadPrompt);
    setStep("upload");
  }

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || p.uploadError);
      }
      const data = (await res.json()) as { url: string; name: string };
      setDraft((prev) => ({
        ...prev,
        fileUrl: data.url,
        fileName: data.name || file.name,
      }));
      push("user", file.name);
      push("assistant", p.uploadThanks);
      setStep("uploadThanks");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : p.uploadError);
    } finally {
      setUploading(false);
    }
  }

  function continueAfterUpload() {
    push("user", p.continueButton);
    push("assistant", p.activitiesPrompt);
    setDraft((prev) => ({ ...prev, activities: [] }));
    setSelectedTaskIds(new Set());
    setExtraActivitiesInput("");
    setStep("activities");
  }

  function addExtraActivities() {
    const lines = extraActivitiesInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setDraft((prev) => {
      const merged = [...prev.activities];
      for (const line of lines) {
        if (!merged.includes(line)) merged.push(line);
      }
      return { ...prev, activities: merged };
    });
    setExtraActivitiesInput("");
  }

  const canAddExtras = Boolean(extraActivitiesInput.trim());

  function removeActivity(line: string) {
    const linked = suggestedActivities.find(
      (activity) =>
        selectedTaskIds.has(activity.id) && activityBillingLabel(activity) === line,
    );
    if (linked) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(linked.id);
        return next;
      });
      return;
    }
    setDraft((prev) => ({
      ...prev,
      activities: prev.activities.filter((item) => item !== line),
    }));
  }

  function toggleSuggestedTask(activityId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function selectAllSuggested() {
    setSelectedTaskIds(new Set(suggestedActivities.map((activity) => activity.id)));
  }

  function clearSuggested() {
    setSelectedTaskIds(new Set());
  }

  async function finishActivities() {
    if (mergedActivities.length === 0) return;
    const submission = await onSubmit({
      memberId: draft.memberId,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      fileUrl: draft.fileUrl,
      fileName: draft.fileName,
      activities: mergedActivities,
    });
    if (!submission) return;
    setReceipt(submission);
    push("user", p.finishButton);
    push("assistant", p.doneMessage);
    setStep("done");
  }

  const receiptMemberName = receipt
    ? members.find((item) => item.id === receipt.memberId)?.name || p.unknownMember
    : "";

  if (!open) return null;

  const stepNumber = STEP_ORDER.indexOf(step) + 1;
  const totalSteps = STEP_ORDER.length;
  const progressPct = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90svh] min-h-0 w-full max-w-lg flex-col overflow-hidden border border-[color:var(--line)] bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--ink)]">
              {p.assistantTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {step === "done"
                ? p.complete
                : `${p.stepLabel} ${stepNumber} ${p.stepOf} ${totalSteps}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2 py-1 text-xs font-semibold"
          >
            {t.common.close}
          </button>
        </div>

        <div className="h-1.5 shrink-0 bg-[color:var(--mist)]">
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

          {step === "greeting" ? (
            <button
              type="button"
              onClick={startFlow}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              {p.startButton}
            </button>
          ) : null}

          {step === "member" ? (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => pickMember(member.id)}
                    className="flex w-full items-center gap-3 border border-[color:var(--line)] px-3 py-2 text-left hover:border-[color:var(--accent)]"
                  >
                    <MemberAvatar name={member.name} photo={member.photo} size="md" />
                    <span>
                      <span className="block text-sm font-semibold text-[color:var(--ink)]">
                        {member.name}
                      </span>
                      {member.role ? (
                        <span className="block text-xs text-[color:var(--muted)]">
                          {member.role}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {step === "period" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodStart(presets.first.start);
                    setPeriodEnd(presets.first.end);
                  }}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold hover:border-[color:var(--accent)]"
                >
                  {presets.first.label}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodStart(presets.second.start);
                    setPeriodEnd(presets.second.end);
                  }}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold hover:border-[color:var(--accent)]"
                >
                  {presets.second.label}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-[color:var(--muted)]">{t.common.start}</span>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                    className="w-full border border-[color:var(--line)] px-2 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-[color:var(--muted)]">{t.common.end}</span>
                  <input
                    type="date"
                    value={periodEnd}
                    min={periodStart || undefined}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                    className="w-full border border-[color:var(--line)] px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => confirmPeriod(periodStart, periodEnd)}
                disabled={!periodStart || !periodEnd || periodEnd < periodStart}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t.common.confirm}
              </button>
            </div>
          ) : null}

          {step === "upload" ? (
            <div className="space-y-2">
              <label className="block">
                <span className="sr-only">{p.uploadPrompt}</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="block w-full text-xs"
                />
              </label>
              <p className="text-xs text-[color:var(--muted)]">{p.uploadFormats}</p>
              {uploadError ? (
                <p className="text-xs font-semibold text-red-700">{uploadError}</p>
              ) : null}
              {uploading ? (
                <p className="text-xs text-[color:var(--muted)]">{t.common.saving}</p>
              ) : null}
            </div>
          ) : null}

          {step === "uploadThanks" ? (
            <button
              type="button"
              onClick={continueAfterUpload}
              className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
            >
              {p.continueButton}
            </button>
          ) : null}

          {step === "activities" ? (
            <div className="space-y-4">
              <div className="space-y-2 border border-[color:var(--line)] bg-[color:var(--mist)]/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[color:var(--ink)]">
                    {p.suggestedActivities}
                  </p>
                  {suggestedActivities.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllSuggested}
                        className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                      >
                        {p.selectAllSuggested}
                      </button>
                      <button
                        type="button"
                        onClick={clearSuggested}
                        className="border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                      >
                        {p.clearSuggested}
                      </button>
                    </div>
                  ) : null}
                </div>
                {suggestedActivities.length === 0 ? (
                  <p className="text-xs text-[color:var(--muted)]">{p.suggestedActivitiesEmpty}</p>
                ) : (
                  <ul className="max-h-44 space-y-2 overflow-y-auto">
                    {suggestedActivities.map((activity) => {
                      const checked = selectedTaskIds.has(activity.id);
                      const label = activityBillingLabel(activity);
                      return (
                        <li key={activity.id}>
                          <label className="flex cursor-pointer items-start gap-2 border border-[color:var(--line)] bg-white px-2 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSuggestedTask(activity.id)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold text-[color:var(--ink)]">
                                {label}
                                {activityOverlapsPeriod(
                                  activity,
                                  draft.periodStart,
                                  draft.periodEnd,
                                ) ? (
                                  <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                                    · {p.inPeriodBadge}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-[color:var(--muted)]">
                                {formatDate(activity.date)}
                                {activity.finishedDate
                                  ? ` – ${formatDate(activity.finishedDate)}`
                                  : ""}
                                {" · "}
                                {statusLabel(activity.status)}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-[color:var(--muted)]">
                  {p.extraActivities}
                </p>
                <textarea
                  rows={3}
                  value={extraActivitiesInput}
                  onChange={(event) => setExtraActivitiesInput(event.target.value)}
                  placeholder={p.activityPlaceholder}
                  className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addExtraActivities}
                  disabled={!canAddExtras}
                  className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {t.common.add}
                </button>
              </div>

              {mergedActivities.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-[color:var(--ink)]">
                  {mergedActivities.map((line, index) => (
                    <li key={`${line}-${index}`} className="flex items-start justify-between gap-2">
                      <span>{line}</span>
                      <button
                        type="button"
                        onClick={() => removeActivity(line)}
                        className="shrink-0 text-[10px] font-semibold text-red-700"
                      >
                        {t.common.remove}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-[color:var(--muted)]">{p.noActivitiesYet}</p>
              )}
              <button
                type="button"
                disabled={saving || mergedActivities.length === 0}
                onClick={() => void finishActivities()}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? t.common.saving : p.finishButton}
              </button>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="space-y-3">
              {receipt ? (
                <div className="border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                    {p.receiptTitle}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
                    {p.receiptMember.replace("{name}", receiptMemberName)}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--ink)]">
                    <span className="font-semibold">{p.receiptPeriod}: </span>
                    {formatDate(receipt.periodStart)} – {formatDate(receipt.periodEnd)}
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {p.submittedOn}{" "}
                    {formatDate(receipt.submittedAt.slice(0, 10))}
                  </p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      {p.activitiesTitle}
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-[color:var(--ink)]">
                      {receipt.activities.map((line, index) => (
                        <li key={`${receipt.id}-${index}`}>{line}</li>
                      ))}
                    </ol>
                  </div>
                  <a
                    href={receipt.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block border border-[color:var(--line)] bg-white px-2 py-1 text-[10px] font-semibold"
                  >
                    {p.viewInvoice}
                  </a>
                </div>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
              >
                {t.common.close}
              </button>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
