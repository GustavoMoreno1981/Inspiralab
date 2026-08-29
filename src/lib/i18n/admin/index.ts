export { adminEs } from "./es";
export { adminEn } from "./en";
export type { AdminDictionary, AdminLocale } from "./types";
export { formatAdmin, getTaskStatuses, getTaskStatusColors } from "./helpers";

import { adminEs } from "./es";
import { adminEn } from "./en";
import type { AdminLocale } from "./types";

export const adminDictionaries = {
  es: adminEs,
  en: adminEn,
} as const;

export function getAdminDictionary(locale: AdminLocale) {
  return adminDictionaries[locale];
}
