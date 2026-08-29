import type { TaskAlarmLevel, TaskAlarmReason } from "@/lib/alarms";
import type { TeamMember } from "@/lib/tasks/types";
import type { AdminDictionary } from "./types";
import { formatAdmin } from "./helpers";

export function getTaskAlarmLevelLabels(t: AdminDictionary) {
  const levels = t.alarms.levels;
  return {
    green: { label: levels.done },
    yellow: { label: levels.dueSoonReview },
    red: { label: levels.overdue },
    blue: { label: levels.paused },
    gray: { label: levels.onTrack },
  } satisfies Record<TaskAlarmLevel, { label: string }>;
}

export function getTaskAlarmReasonLabel(
  t: AdminDictionary,
  reason: TaskAlarmReason,
): string {
  const map: Record<TaskAlarmReason, string> = {
    pending_review: t.alarms.reasons.pending_review,
    due_soon: t.alarms.reasons.due_soon,
    overdue: t.alarms.reasons.overdue,
    paused: t.alarms.reasons.paused,
    done: t.alarms.reasons.done,
    on_track: t.alarms.reasons.on_track,
  };
  return map[reason];
}

export function formatAlarmAssignees(assignees: TeamMember[], t: AdminDictionary) {
  if (assignees.length === 0) return t.alarms.unassigned;
  return assignees.map((member) => member.name).join(", ");
}

export function buildTaskAlarmMessage(
  t: AdminDictionary,
  params: {
    title: string;
    reason: TaskAlarmReason;
    assignees: TeamMember[];
    days: number | null;
    finishedDate: string;
  },
): string {
  const who = formatAlarmAssignees(params.assignees, t);
  const plural = params.assignees.length !== 1;
  const days = params.days ?? 0;
  const msgs = t.alarms.messages;

  switch (params.reason) {
    case "overdue":
      return formatAdmin(plural ? msgs.overdueMany : msgs.overdueOne, {
        who,
        title: params.title,
        days: Math.abs(days),
        date: params.finishedDate,
      });
    case "pending_review":
      return formatAdmin(plural ? msgs.pendingReviewMany : msgs.pendingReviewOne, {
        who,
        title: params.title,
      });
    case "due_soon":
      return formatAdmin(plural ? msgs.dueSoonMany : msgs.dueSoonOne, {
        who,
        title: params.title,
        days,
        date: params.finishedDate,
      });
    case "paused":
      return formatAdmin(msgs.paused, { title: params.title, who });
    case "done":
      return formatAdmin(msgs.done, { title: params.title, who });
    default:
      return formatAdmin(msgs.onTrack, { title: params.title, who });
  }
}
