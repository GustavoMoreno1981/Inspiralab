import type { FieldDef } from "./types";
import { formatBudgetFieldDisplay, formatBudgetFieldHtml } from "./budget-fields";

/** Separa ítems guardados (uno por línea). */
export function parseListField(value: string): string[] {
  return value
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeListField(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

export function isListField(field: Pick<FieldDef, "inputType">): boolean {
  return field.inputType === "list";
}

export function isBudgetField(field: Pick<FieldDef, "inputType">): boolean {
  return field.inputType === "budget";
}

export function isScoreField(field: Pick<FieldDef, "inputType">): boolean {
  return field.inputType === "score";
}

export function formatListFieldHtml(value: string, escapeHtml: (s: string) => string) {
  const items = parseListField(value);
  if (!items.length) return "—";
  return `<ul class="items">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

export function formatFieldDisplay(value: string, field: Pick<FieldDef, "inputType">) {
  if (isBudgetField(field)) {
    return formatBudgetFieldDisplay(value);
  }
  if (isScoreField(field)) {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    return `${trimmed} / 5`;
  }
  if (isListField(field)) {
    const items = parseListField(value);
    if (!items.length) return "—";
    return items.map((item) => `• ${item}`).join("\n");
  }
  return value.trim() || "—";
}

export function formatFieldHtml(
  value: string,
  field: Pick<FieldDef, "inputType">,
  escapeHtml: (s: string) => string,
) {
  if (isBudgetField(field)) {
    return formatBudgetFieldHtml(value, escapeHtml);
  }
  if (isListField(field)) {
    return formatListFieldHtml(value, escapeHtml);
  }
  if (isScoreField(field)) {
    const trimmed = value.trim();
    return trimmed ? escapeHtml(`${trimmed} / 5`) : "—";
  }
  return escapeHtml(value.trim() || "—").replaceAll("\n", "<br/>");
}
