import type { Activity } from "@/lib/tasks/types";

export function activityOverlapsPeriod(
  activity: Pick<Activity, "date" | "finishedDate">,
  periodStart: string,
  periodEnd: string,
): boolean {
  const start = activity.date?.trim();
  if (!start) return false;
  const end = (activity.finishedDate || activity.date || "").trim();
  return start <= periodEnd && end >= periodStart;
}

/** Actividades pendientes del integrante que cruzan el periodo de la cuenta de cobro. */
export function pendingActivitiesForBilling(
  activities: Activity[],
  memberId: string,
  periodStart: string,
  periodEnd: string,
): Activity[] {
  return activities
    .filter((activity) => {
      if (!(activity.assigneeIds || []).includes(memberId)) return false;
      if (activity.status === "done") return false;
      return activityOverlapsPeriod(activity, periodStart, periodEnd);
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.title.localeCompare(b.title, "es");
    });
}

export function activityBillingLabel(activity: Activity) {
  return activity.title.trim();
}
