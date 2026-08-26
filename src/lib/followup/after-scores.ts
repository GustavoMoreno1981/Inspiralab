import type { EvaluationFields } from "./types";

/** Preguntas calificadas de 1 a 5; el promedio se guarda en averageScore. */
export const AFTER_SCORE_KEYS = [
  "objectivesMet",
  "punctualArrival",
  "materialsComplete",
  "startedOnTime",
  "messageAppropriate",
] as const satisfies ReadonlyArray<keyof EvaluationFields>;

export type AfterScoreKey = (typeof AFTER_SCORE_KEYS)[number];

export function computeAverageScore(fields: EvaluationFields): string {
  const nums = AFTER_SCORE_KEYS.map((key) => Number(fields[key])).filter(
    (n) => Number.isFinite(n) && n >= 1 && n <= 5,
  );
  if (!nums.length) return "";
  const avg = nums.reduce((total, value) => total + value, 0) / nums.length;
  return String(Math.round(avg * 10) / 10);
}

export function withComputedAverage(fields: EvaluationFields): EvaluationFields {
  return {
    ...fields,
    averageScore: computeAverageScore(fields),
  };
}

export function afterScoreCount(fields: EvaluationFields) {
  return AFTER_SCORE_KEYS.filter((key) => {
    const n = Number(fields[key]);
    return Number.isFinite(n) && n >= 1 && n <= 5;
  }).length;
}
