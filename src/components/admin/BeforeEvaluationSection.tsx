"use client";

import { BudgetFieldInput } from "@/components/admin/BudgetFieldInput";
import { ListFieldInput } from "@/components/admin/ListFieldInput";
import {
  SECTION_TITLES,
  fieldsForPhase,
  type EvaluationFields,
  type WorkshopEvaluation,
} from "@/lib/followup/types";
import { isBudgetField, isListField } from "@/lib/followup/list-fields";

type Props = {
  fields: EvaluationFields;
  evaluatedBy: string;
  budgetDate: string;
  onFieldChange: (key: keyof EvaluationFields, value: string) => void;
  onEvaluatedByChange: (value: string) => void;
};

export function BeforeEvaluationSection({
  fields,
  evaluatedBy,
  budgetDate,
  onFieldChange,
  onEvaluatedByChange,
}: Props) {
  const beforeFields = fieldsForPhase("before");
  const sections = new Map<number, typeof beforeFields>();
  for (const field of beforeFields) {
    const list = sections.get(field.section) || [];
    list.push(field);
    sections.set(field.section, list);
  }

  return (
    <div className="space-y-4 border border-[color:var(--line)] bg-[color:var(--mist)]/40 p-4">
      <div>
        <h3 className="text-sm font-bold text-[color:var(--ink)]">
          Evaluación previa (antes de programar)
        </h3>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Propósito, logística, personal, presupuesto y planificación del taller
          o evento.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
          Quién completa la planificación
        </span>
        <input
          value={evaluatedBy}
          onChange={(event) => onEvaluatedByChange(event.target.value)}
          placeholder="Tu nombre"
          className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      </label>

      {[...sections.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sectionNumber, sectionFields]) => (
          <div
            key={sectionNumber}
            className="space-y-3 border border-[color:var(--line)] bg-white p-3"
          >
            <h4 className="text-xs font-bold text-[color:var(--ink)]">
              {sectionNumber}. {SECTION_TITLES[sectionNumber]}
            </h4>
            {sectionFields.map((field) => (
              <label key={field.key} className="block space-y-1.5">
                <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                  {field.letter ? `${field.letter} — ` : ""}
                  {field.label}
                </span>
                {isBudgetField(field) ? (
                  <BudgetFieldInput
                    value={fields[field.key]}
                    onChange={(value) => onFieldChange(field.key, value)}
                    rateDate={budgetDate}
                    placeholder={field.help}
                  />
                ) : isListField(field) ? (
                  <ListFieldInput
                    value={fields[field.key]}
                    onChange={(value) => onFieldChange(field.key, value)}
                    placeholder={field.help}
                  />
                ) : (
                  <textarea
                    value={fields[field.key]}
                    onChange={(event) =>
                      onFieldChange(field.key, event.target.value)
                    }
                    rows={2}
                    placeholder={field.help}
                    className="w-full border border-[color:var(--line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                )}
              </label>
            ))}
          </div>
        ))}
    </div>
  );
}

export function mergeBeforeIntoEvaluation(
  evaluation: WorkshopEvaluation,
  beforeFields: EvaluationFields,
  evaluatedBy: string,
): WorkshopEvaluation {
  const mergedFields = { ...evaluation.fields };
  for (const field of fieldsForPhase("before")) {
    mergedFields[field.key] = beforeFields[field.key];
  }
  const progress = fieldsForPhase("before").filter((f) =>
    mergedFields[f.key].trim(),
  ).length;
  return {
    ...evaluation,
    fields: mergedFields,
    evaluatedBy: evaluatedBy.trim() || evaluation.evaluatedBy,
    phaseStatus: {
      ...evaluation.phaseStatus,
      before:
        progress === fieldsForPhase("before").length
          ? "done"
          : progress > 0
            ? "in_progress"
            : "empty",
    },
    updatedAt: new Date().toISOString(),
  };
}
