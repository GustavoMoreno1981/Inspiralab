"use client";

import type { AdminDictionary } from "@/lib/i18n/admin/types";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import {
  SECURITY_QUESTIONS_PER_SESSION,
  pickRandomSecurityQuestions,
  shuffleSecurityQuestionKeys,
  type SecurityQuestionKey,
} from "@/lib/tasks/security-questions";
import { emptyPrivateSecurityAnswers } from "@/lib/tasks/security-questions";

export type PrivateSetupValues = {
  pin: string;
  pinConfirm: string;
  questionKeys: SecurityQuestionKey[];
  answers: Record<SecurityQuestionKey, string>;
};

export function createEmptyPrivateSetup(
  questionKeys = pickRandomSecurityQuestions(SECURITY_QUESTIONS_PER_SESSION),
): PrivateSetupValues {
  return {
    pin: "",
    pinConfirm: "",
    questionKeys,
    answers: emptyPrivateSecurityAnswers(),
  };
}

export const EMPTY_PRIVATE_SETUP = createEmptyPrivateSetup();

export function securityQuestionLabel(
  key: SecurityQuestionKey,
  p: AdminDictionary["private"],
) {
  switch (key) {
    case "motherName":
      return p.motherName;
    case "petName":
      return p.petName;
    case "birthYear":
      return p.birthYear;
    case "age":
      return p.age;
    case "spouseName":
      return p.spouseName;
    case "schoolName":
      return p.schoolName;
    default:
      return key;
  }
}

export function securityQuestionPlaceholder(
  key: SecurityQuestionKey,
  p: AdminDictionary["private"],
) {
  switch (key) {
    case "birthYear":
      return p.birthYearPlaceholder;
    case "age":
      return p.agePlaceholder;
    default:
      return "";
  }
}

export function validatePrivateSetup(
  values: PrivateSetupValues,
  p: AdminDictionary["private"],
  options?: { requirePin?: boolean },
): string | null {
  const requirePin = options?.requirePin !== false;
  if (requirePin) {
    if (!/^\d{4}$/.test(values.pin)) return p.pin4digits;
    if (values.pin !== values.pinConfirm) return p.pinsMismatch;
  }

  if (values.questionKeys.length !== SECURITY_QUESTIONS_PER_SESSION) {
    return p.securityQuestionsIncomplete;
  }

  for (const key of values.questionKeys) {
    const value = values.answers[key]?.trim() || "";
    if (!value) return p.securityQuestionRequired;
    if (key === "birthYear" && !/^\d{4}$/.test(value)) return p.birthYearRequired;
    if (key === "age" && !/^\d{1,3}$/.test(value.replace(/\D/g, ""))) {
      return p.ageRequired;
    }
  }

  return null;
}

type Props = {
  values: PrivateSetupValues;
  onChange: (values: PrivateSetupValues) => void;
  questionKeys: SecurityQuestionKey[];
  showPin?: boolean;
};

export function PrivateItemSetupFields({
  values,
  onChange,
  questionKeys,
  showPin = true,
}: Props) {
  const { t } = useAdminLanguage();
  const p = t.private;

  function patch(partial: Partial<PrivateSetupValues>) {
    onChange({ ...values, ...partial, questionKeys });
  }

  function patchAnswer(key: SecurityQuestionKey, answer: string) {
    onChange({
      ...values,
      questionKeys,
      answers: { ...values.answers, [key]: answer },
    });
  }

  return (
    <div className="space-y-3 border border-dashed border-[color:var(--line)] bg-[color:var(--mist)] p-3">
      <p className="text-xs font-semibold text-[color:var(--ink)]">{p.protection}</p>
      <p className="text-xs text-[color:var(--muted)]">{p.protectionDesc}</p>
      <p className="text-xs text-[color:var(--muted)]">{p.securityQuestionsHint}</p>

      {showPin ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
              {p.pin}
            </span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={values.pin}
              onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              placeholder="••••"
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm tracking-[0.3em]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
              {p.confirmPin}
            </span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={values.pinConfirm}
              onChange={(e) =>
                patch({ pinConfirm: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder="••••"
              className="w-full border border-[color:var(--line)] px-3 py-2 text-sm tracking-[0.3em]"
            />
          </label>
        </div>
      ) : null}

      {questionKeys.map((key) => (
        <label key={key} className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
            {securityQuestionLabel(key, p)}
          </span>
          <input
            inputMode={key === "birthYear" || key === "age" ? "numeric" : "text"}
            maxLength={key === "birthYear" ? 4 : key === "age" ? 3 : undefined}
            value={values.answers[key] || ""}
            onChange={(e) => {
              let next = e.target.value;
              if (key === "birthYear") {
                next = next.replace(/\D/g, "").slice(0, 4);
              } else if (key === "age") {
                next = next.replace(/\D/g, "").slice(0, 3);
              }
              patchAnswer(key, next);
            }}
            placeholder={securityQuestionPlaceholder(key, p)}
            className="w-full border border-[color:var(--line)] px-3 py-2 text-sm"
          />
        </label>
      ))}
    </div>
  );
}

export function shuffleRecoveryQuestions(
  configuredKeys: SecurityQuestionKey[],
): SecurityQuestionKey[] {
  return shuffleSecurityQuestionKeys(configuredKeys);
}
