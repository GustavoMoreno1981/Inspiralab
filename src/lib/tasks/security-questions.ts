export const SECURITY_QUESTION_KEYS = [
  "motherName",
  "petName",
  "birthYear",
  "age",
  "spouseName",
  "schoolName",
] as const;

export type SecurityQuestionKey = (typeof SECURITY_QUESTION_KEYS)[number];

export type PrivateSecurityAnswers = Record<SecurityQuestionKey, string>;

export function emptyPrivateSecurityAnswers(): PrivateSecurityAnswers {
  return {
    motherName: "",
    petName: "",
    birthYear: "",
    age: "",
    spouseName: "",
    schoolName: "",
  };
}

export const LEGACY_SECURITY_QUESTION_KEYS: SecurityQuestionKey[] = [
  "motherName",
  "petName",
  "birthYear",
];

export const SECURITY_QUESTIONS_PER_SESSION = 1;

export function isSecurityQuestionKey(value: string): value is SecurityQuestionKey {
  return (SECURITY_QUESTION_KEYS as readonly string[]).includes(value);
}

export function pickRandomSecurityQuestions(
  count = SECURITY_QUESTIONS_PER_SESSION,
  pool: readonly SecurityQuestionKey[] = SECURITY_QUESTION_KEYS,
): SecurityQuestionKey[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function shuffleSecurityQuestionKeys(
  keys: SecurityQuestionKey[],
): SecurityQuestionKey[] {
  return pickRandomSecurityQuestions(keys.length, keys);
}
