import type { Activity } from "@/lib/tasks/types";

export function activityAssignedToMember(activity: Activity, memberId: string): boolean {
  if (!memberId) return false;
  if ((activity.assigneeIds || []).includes(memberId)) return true;
  if (activity.createdById === memberId) return true;
  return false;
}

export function activityOverlapsPeriod(
  activity: Pick<Activity, "date" | "finishedDate">,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (!periodStart || !periodEnd) return true;
  const start = activity.date?.trim();
  if (!start) return true;
  const end = (activity.finishedDate || "").trim();
  if (!end) return start <= periodEnd;
  return start <= periodEnd && end >= periodStart;
}

/** Todas las actividades del integrante (cualquier estado). Las del periodo van primero. */
export function activitiesForBilling(
  activities: Activity[],
  memberId: string,
  periodStart: string,
  periodEnd: string,
): Activity[] {
  return activities
    .filter((activity) => activityAssignedToMember(activity, memberId))
    .sort((a, b) => {
      const aInPeriod = activityOverlapsPeriod(a, periodStart, periodEnd);
      const bInPeriod = activityOverlapsPeriod(b, periodStart, periodEnd);
      if (aInPeriod !== bInPeriod) return aInPeriod ? -1 : 1;
      const byDate = (b.date || "").localeCompare(a.date || "");
      if (byDate !== 0) return byDate;
      return a.title.localeCompare(b.title, "es");
    });
}

export function activityBillingLabel(activity: Activity) {
  const title = activity.title.trim();
  return title || "Actividad sin título";
}
