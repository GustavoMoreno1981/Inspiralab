import type { TaskStatus } from "@/lib/tasks/types";
import type { AdminDictionary } from "./types";

export function formatAdmin(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}

export function getTaskStatuses(t: AdminDictionary) {
  return [
    { value: "waiting" as TaskStatus, label: t.tasks.status.waiting },
    { value: "in_progress" as TaskStatus, label: t.tasks.status.in_progress },
    { value: "paused" as TaskStatus, label: t.tasks.status.paused },
    { value: "pending_review" as TaskStatus, label: t.tasks.status.pending_review },
    { value: "done" as TaskStatus, label: t.tasks.status.done },
  ];
}

export function getTaskStatusColors(t: AdminDictionary) {
  const s = t.tasks.status;
  return {
    waiting: { bg: "#94a3b8", text: "#fff", label: s.waiting },
    in_progress: { bg: "#e00d45", text: "#fff", label: s.in_progress },
    paused: { bg: "#2563eb", text: "#fff", label: s.paused },
    pending_review: { bg: "#ca8a04", text: "#fff", label: s.pending_review },
    done: { bg: "#16a34a", text: "#fff", label: s.done },
  } as const;
}
