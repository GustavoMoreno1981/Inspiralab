/** Texto para mostrar coaches (soporta datos legacy con `coach`). */
export function workshopCoachesLabel(
  workshop: { coaches?: string[]; coach?: string },
  separator = " · ",
): string {
  const coaches = Array.isArray(workshop.coaches)
    ? workshop.coaches.map((coach) => coach.trim()).filter(Boolean)
    : [];
  if (coaches.length) return coaches.join(separator);
  const legacy = typeof workshop.coach === "string" ? workshop.coach.trim() : "";
  return legacy;
}
